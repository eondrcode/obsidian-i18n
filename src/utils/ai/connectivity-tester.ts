import { requestUrl } from "obsidian";
import { t } from "src/locales";
import { normalizeOpenAIUrl } from "./url-helper";

export interface DiagItem {
    status: 'pass' | 'fail' | 'warn' | 'na';
    value: string;
    latency?: number;
    tip?: string;
}

export interface DiagnosticLog {
    stage: string;
    message: string;
    level: 'info' | 'warn' | 'error';
}

export interface DeepDiagnosticReport {
    overallStatus: 'healthy' | 'warning' | 'degraded' | 'failed';
    endpoint: DiagItem;
    auth: DiagItem;
    model: DiagItem;
    jsonMode: DiagItem;
    jsonSchema: DiagItem;
    logs: DiagnosticLog[];
}

export class ConnectivityTester {
    private url: string;
    private key: string;
    private model: string;
    private logs: DiagnosticLog[] = [];

    constructor(url: string, key: string, model: string) {
        this.url = (url || '').trim();
        this.key = key.trim();
        this.model = model.trim();
    }

    private addLog(stage: string, message: string, level: 'info' | 'warn' | 'error' = 'info') {
        this.logs.push({ stage, message, level });
        console.log(`[Diagnostic][${stage}] ${message}`);
    }

    async runDeepDiagnostic(onProgress?: (msg: string) => void): Promise<DeepDiagnosticReport> {
        this.logs = [];
        const report: DeepDiagnosticReport = {
            overallStatus: 'healthy',
            endpoint: { status: 'na', value: this.url },
            auth: { status: 'na', value: '***' },
            model: { status: 'na', value: this.model || 'N/A' },
            jsonMode: { status: 'na', value: 'Not Tested' },
            jsonSchema: { status: 'na', value: 'Not Tested' },
            logs: this.logs
        };

        // --- Stage 1: Endpoint & Basic Network ---
        this.addLog('Endpoint', `Testing connectivity to ${this.url}`);
        onProgress?.(t('Settings.Ai.TestStageNetwork'));

        const startTime = Date.now();
        const baseUrl = normalizeOpenAIUrl(this.url)!;
        const baseUrlV1 = `${baseUrl}/v1`;
        try {
            // 启发式检查
            if (!this.url.match(/^https?:\/\//)) {
                report.endpoint.status = 'warn';
                report.endpoint.tip = 'URL must start with http:// or https://';
                this.addLog('Endpoint', 'Invalid URL protocol', 'warn');
            }

            const res = await this.safeRequest(`${baseUrlV1}/models`, 'GET');
            const latency = Date.now() - startTime;
            report.endpoint.latency = latency;

            if (res.status >= 200 || [401, 403, 405, 429].includes(res.status)) {
                report.endpoint.status = report.endpoint.status === 'warn' ? 'warn' : 'pass';
                report.endpoint.value = `${this.url} (${res.status})`;
                this.addLog('Endpoint', `Reachable (Latency: ${latency}ms, Status: ${res.status})`);

                // 检查是否缺少 /v1 (现在会自动补全，但可以提示由于没输 /v1 导致基础连接尝试的状态)
                if (!this.url.includes('/v1') && !this.url.includes('openai.com') && !this.url.includes('anthropic')) {
                    this.addLog('Endpoint', 'Base URL does not contain /v1, automatically appending for API calls', 'info');
                }
            } else {
                report.endpoint.status = 'fail';
                report.endpoint.tip = t('Settings.Ai.TestFail404');
                report.overallStatus = 'failed';
                this.addLog('Endpoint', `Unreachable or returns error status: ${res.status}`, 'error');
                return report;
            }
        } catch (err: any) {
            report.endpoint.status = 'fail';
            report.endpoint.tip = t('Settings.Ai.TestFailNetwork');
            report.overallStatus = 'failed';
            this.addLog('Endpoint', `Network error: ${err.message}`, 'error');
            return report;
        }

        // --- Stage 2: Auth ---
        onProgress?.(t('Settings.Ai.TestStageAuth'));
        this.addLog('Auth', 'Verifying API Key');
        const authStartTime = Date.now();
        const authRes = await this.safeRequest(`${baseUrlV1}/models`, 'GET', true);
        report.auth.latency = Date.now() - authStartTime;

        if (authRes.status === 200) {
            report.auth.status = 'pass';
            report.auth.value = 'Valid';
            this.addLog('Auth', 'API Key verified successfully');
        } else {
            report.auth.status = 'fail';
            report.auth.value = `Error ${authRes.status}`;
            report.auth.tip = authRes.status === 401 ? t('Settings.Ai.TestFail401') : (authRes.status === 429 ? t('Settings.Ai.DiagTipQuota') : t('Settings.Ai.TestFailUnknown'));
            report.overallStatus = 'failed';
            this.addLog('Auth', `Authentication failed with status ${authRes.status}`, 'error');
            return report;
        }

        // --- Stage 3: Model & Capabilities ---
        if (!this.model) {
            report.model.status = 'warn';
            report.model.tip = 'No model name provided';
            this.addLog('Model', 'Skipping model-specific tests (no name)', 'warn');
            return report;
        }

        onProgress?.(t('Settings.Ai.TestStageModel'));
        this.addLog('Model', `Testing model availability: ${this.model}`);

        // 3.1 Standard Chat Test
        const modelStartTime = Date.now();
        const modelRes = await this.safeRequest(`${baseUrlV1}/chat/completions`, 'POST', true, {
            model: this.model,
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 1
        });
        report.model.latency = Date.now() - modelStartTime;

        if (modelRes.status === 200) {
            report.model.status = 'pass';
            this.addLog('Model', `Model ${this.model} is available`);
        } else {
            report.model.status = 'fail';
            report.model.tip = modelRes.status === 404 ? t('Settings.Ai.TestFail404') : t('Settings.Ai.TestFailModel');
            report.overallStatus = 'failed';
            this.addLog('Model', `Model test failed with status ${modelRes.status}`, 'error');
            return report;
        }

        // 3.2 JSON Mode Test
        this.addLog('Capabilities', 'Testing JSON Mode support');
        onProgress?.(`${t('Settings.Ai.DiagItemJsonMode')}...`);
        const jsonModeRes = await this.safeRequest(`${baseUrlV1}/chat/completions`, 'POST', true, {
            model: this.model,
            messages: [{ role: 'user', content: 'respond with json: {"ok":true}' }],
            response_format: { type: 'json_object' },
            max_tokens: 10
        });
        if (jsonModeRes.status === 200) {
            report.jsonMode.status = 'pass';
            report.jsonMode.value = 'Supported';
            this.addLog('Capabilities', 'JSON Mode is supported');
        } else {
            report.jsonMode.status = 'fail';
            report.jsonMode.tip = 'This model or endpoint does not support json_object format';
            report.overallStatus = report.overallStatus === 'healthy' ? 'warning' : report.overallStatus;
            this.addLog('Capabilities', `JSON Mode test failed (${jsonModeRes.status})`, 'warn');
        }

        // 3.3 Structured Outputs (JSON Schema) Test
        this.addLog('Capabilities', 'Testing Structured Outputs (JSON Schema) support');
        onProgress?.(`${t('Settings.Ai.DiagItemJsonSchema')}...`);
        const jsonSchemaRes = await this.safeRequest(`${baseUrlV1}/chat/completions`, 'POST', true, {
            model: this.model,
            messages: [{ role: 'user', content: 'respond with schema' }],
            response_format: {
                type: 'json_schema',
                json_schema: {
                    name: "test",
                    schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false },
                    strict: true
                }
            },
            max_tokens: 10
        });
        if (jsonSchemaRes.status === 200) {
            report.jsonSchema.status = 'pass';
            report.jsonSchema.value = 'Supported';
            this.addLog('Capabilities', 'Structured Outputs (JSON Schema) is supported');
        } else {
            report.jsonSchema.status = 'fail';
            report.jsonSchema.tip = t('Settings.Ai.DiagTipModelFallback');
            report.overallStatus = 'degraded';
            this.addLog('Capabilities', `Structured Outputs test failed (${jsonSchemaRes.status})`, 'warn');
        }

        return report;
    }

    private async safeRequest(url: string, method: string, includeAuth = false, body?: any) {
        const headers: Record<string, string> = {};
        if (includeAuth) headers['Authorization'] = `Bearer ${this.key}`;
        if (body) headers['Content-Type'] = 'application/json';

        try {
            return await requestUrl({
                url,
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                throw: false
            });
        } catch (err: any) {
            if (err.message?.includes('timeout')) return { status: 408 } as any;
            throw err;
        }
    }
}
