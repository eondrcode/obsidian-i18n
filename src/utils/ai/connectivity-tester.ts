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
    systemRole: DiagItem;
    jsonMode: DiagItem;
    jsonSchema: DiagItem;
    translation: DiagItem;
    logs: DiagnosticLog[];
}

export class ConnectivityTester {
    private url: string;
    private key: string;
    private model: string;
    private responseFormat: string;
    private timeout: number;
    private logs: DiagnosticLog[] = [];

    constructor(url: string, key: string, model: string, responseFormat?: string, timeout?: number) {
        this.url = (url || '').trim();
        this.key = key.trim();
        this.model = model.trim();
        this.responseFormat = responseFormat || 'text';
        this.timeout = timeout || 60000;
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
            systemRole: { status: 'na', value: 'Not Tested' },
            jsonMode: { status: 'na', value: 'Not Tested' },
            jsonSchema: { status: 'na', value: 'Not Tested' },
            translation: { status: 'na', value: 'Not Tested' },
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

        // --- Stage 3: Model Availability ---
        if (!this.model) {
            report.model.status = 'warn';
            report.model.tip = 'No model name provided';
            this.addLog('Model', 'Skipping model-specific tests (no name)', 'warn');
            return report;
        }

        onProgress?.(t('Settings.Ai.TestStageModel'));
        this.addLog('Model', `Testing model availability: ${this.model}`);

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

        // --- Stage 3.5: System Role Support ---
        onProgress?.(t('Settings.Ai.DiagStageSystemRole'));
        this.addLog('SystemRole', 'Testing system role support');

        const sysRoleStartTime = Date.now();
        const sysRoleRes = await this.safeRequest(`${baseUrlV1}/chat/completions`, 'POST', true, {
            model: this.model,
            messages: [
                { role: 'system', content: 'You are a helpful assistant. Reply only with: OK' },
                { role: 'user', content: 'hi' }
            ],
            max_tokens: 5
        });
        report.systemRole.latency = Date.now() - sysRoleStartTime;

        if (sysRoleRes.status === 200) {
            report.systemRole.status = 'pass';
            report.systemRole.value = 'Supported';
            this.addLog('SystemRole', 'System role is supported');
        } else {
            report.systemRole.status = 'fail';
            report.systemRole.tip = t('Settings.Ai.DiagTipSystemRole');
            report.overallStatus = report.overallStatus === 'healthy' ? 'warning' : report.overallStatus;
            this.addLog('SystemRole', `System role test failed (${sysRoleRes.status})`, 'warn');
        }

        // --- Stage 4: JSON Mode Test ---
        this.addLog('Capabilities', 'Testing JSON Mode support');
        onProgress?.(`${t('Settings.Ai.DiagItemJsonMode')}…`);
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
            report.jsonMode.tip = 'JSON Mode not supported';
            report.overallStatus = report.overallStatus === 'healthy' ? 'warning' : report.overallStatus;
            this.addLog('Capabilities', `JSON Mode test failed (${jsonModeRes.status})`, 'warn');
        }

        // --- Stage 5: Structured Outputs (JSON Schema) Test ---
        this.addLog('Capabilities', 'Testing Structured Outputs (JSON Schema) support');
        onProgress?.(`${t('Settings.Ai.DiagItemJsonSchema')}…`);
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

        // --- Stage 6: Translation Simulation (End-to-End) ---
        onProgress?.(t('Settings.Ai.DiagStageTranslation'));
        this.addLog('Translation', 'Running translation simulation with real prompt');

        const translationBody: any = {
            model: this.model,
            messages: [
                {
                    role: 'system',
                    content: 'You are a translator. Translate the input JSON array. Each object has "i" (id, keep unchanged) and "s" (source text). Return a JSON array where each object has "i" and "t" (translated text). Target language: 简体中文. ONLY return the JSON array, no other text.'
                },
                {
                    role: 'user',
                    content: JSON.stringify([{ i: 1, s: "Settings" }, { i: 2, s: "Cancel" }])
                }
            ],
            max_tokens: 100,
            temperature: 0.3,
        };

        // 使用用户实际选择的 response_format
        if (this.responseFormat === 'json_object') {
            translationBody.response_format = { type: 'json_object' };
        } else if (this.responseFormat === 'json_schema') {
            translationBody.response_format = {
                type: 'json_schema',
                json_schema: {
                    name: "translation_result",
                    schema: {
                        type: "object",
                        properties: {
                            items: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: { i: { type: "number" }, t: { type: "string" } },
                                    required: ["i", "t"],
                                    additionalProperties: false
                                }
                            }
                        },
                        required: ["items"],
                        additionalProperties: false
                    },
                    strict: true
                }
            };
        }
        // 'text' 模式不设置 response_format

        const transStartTime = Date.now();
        try {
            const transRes = await this.safeRequest(`${baseUrlV1}/chat/completions`, 'POST', true, translationBody);
            const transLatency = Date.now() - transStartTime;
            report.translation.latency = transLatency;

            if (transRes.status !== 200) {
                report.translation.status = 'fail';
                report.translation.tip = `API 返回 ${transRes.status}`;
                report.overallStatus = 'failed';
                this.addLog('Translation', `Translation simulation failed with status ${transRes.status}`, 'error');
            } else {
                // 尝试解析返回内容
                let parseSuccess = false;
                try {
                    const body = typeof transRes.json === 'object' ? transRes.json : JSON.parse(transRes.text);
                    const content = body?.choices?.[0]?.message?.content;
                    if (content) {
                        let parsed: any;
                        try {
                            parsed = JSON.parse(content);
                        } catch {
                            // 尝试提取 markdown 代码块
                            const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                            if (match) parsed = JSON.parse(match[1]);
                        }

                        // 处理 json_schema 包裹格式
                        const resultArray = Array.isArray(parsed) ? parsed : (parsed?.items ? parsed.items : null);

                        if (resultArray && Array.isArray(resultArray) && resultArray.length > 0) {
                            const hasCorrectFields = resultArray.every((item: any) =>
                                typeof item.i === 'number' && typeof item.t === 'string'
                            );
                            const idsMatch = resultArray.some((item: any) => item.i === 1 || item.i === 2);

                            if (hasCorrectFields && idsMatch) {
                                parseSuccess = true;
                                report.translation.status = 'pass';
                                report.translation.value = `OK (${transLatency}ms)`;
                                this.addLog('Translation', `Simulation passed: received ${resultArray.length} items in ${transLatency}ms`);
                            }
                        }
                    }
                } catch (e: any) {
                    this.addLog('Translation', `Response parse error: ${e.message}`, 'error');
                }

                if (!parseSuccess) {
                    report.translation.status = 'fail';
                    report.translation.tip = t('Settings.Ai.DiagTipTranslationFail');
                    report.overallStatus = 'failed';
                    this.addLog('Translation', 'Translation simulation returned unparseable or incorrect format', 'error');
                }

                // 延迟预警：如果简单 2 条翻译已接近超时阈值的 80%
                if (parseSuccess && transLatency > this.timeout * 0.8) {
                    report.translation.status = 'warn';
                    report.translation.tip = t('Settings.Ai.DiagTipLatencyWarn');
                    report.overallStatus = report.overallStatus === 'healthy' ? 'warning' : report.overallStatus;
                    this.addLog('Translation', `Latency warning: ${transLatency}ms is close to timeout ${this.timeout}ms`, 'warn');
                }
            }
        } catch (err: any) {
            report.translation.status = 'fail';
            report.translation.latency = Date.now() - transStartTime;
            report.translation.tip = err.message?.includes('timeout') ? t('Settings.Ai.TestFailTimeout') : t('Settings.Ai.DiagTipTranslationFail');
            report.overallStatus = 'failed';
            this.addLog('Translation', `Translation simulation error: ${err.message}`, 'error');
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
