import { requestUrl } from "obsidian";
import { t } from "src/locales";
import { normalizeOpenAIUrl } from "./url-helper";
import { parseTranslationResponse } from "./response-parser";

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
            systemRole: { status: 'na', value: '未连通' },
            jsonMode: { status: 'na', value: '未连通' },
            jsonSchema: { status: 'na', value: '未连通' },
            translation: { status: 'na', value: '未连通' },
            logs: this.logs
        };

        // --- Stage 1: Endpoint & Basic Network ---
        this.addLog('Endpoint', `Testing connectivity to ${this.url}`);
        onProgress?.(t('Settings.Ai.TestStageNetwork'));

        const startTime = Date.now();
        const baseUrl = normalizeOpenAIUrl(this.url);
        // 如果 url 为空，默认按 OpenAI 的测试地址
        const testUrl = baseUrl || 'https://api.openai.com/v1';

        try {
            // 启发式检查
            if (this.url && !this.url.match(/^https?:\/\//)) {
                report.endpoint.status = 'warn';
                report.endpoint.tip = 'URL must start with http:// or https://';
                this.addLog('Endpoint', '协议异常 (请检查 http/https 头)', 'warn');
            }

            const res = await this.safeRequest(`${testUrl}/models`, 'GET');
            const latency = Date.now() - startTime;
            report.endpoint.latency = latency;

            if (res.status >= 200 && res.status < 300 || [401, 403, 405, 429].includes(res.status)) {
                report.endpoint.status = report.endpoint.status === 'warn' ? 'warn' : 'pass';
                report.endpoint.value = `${testUrl} (${res.status})`;
                this.addLog('Endpoint', `成功连通 (耗时: ${latency}ms, 状态码: ${res.status})`);
            } else if (res.status === 404) {
                // 部分兼容的 API 可能未实现 /models，仅提示警告并继续
                report.endpoint.status = 'warn';
                report.endpoint.value = `${testUrl} (${res.status})`;
                report.endpoint.tip = t('Settings.Ai.TestFail404') || '/models endpoint not found, continuing tests...';
                this.addLog('Endpoint', `/models 端点未找到 (404)，忽略并继续以兼容非规范 API 代理...`, 'warn');
            } else if (res.status === 406) {
                // 常见错误：用户填写了带有网页界面的根域名而不是具体带 /v1 的 API 地址
                report.endpoint.status = 'fail';
                report.endpoint.tip = '该地址返回了网页前端而非接口数据。通常是因为填成了官网地址或漏加了 /v1 路径';
                report.endpoint.value = 'HTML 冲突';
                report.overallStatus = 'failed';
                this.addLog('Endpoint', `检测到 HTML：地址返回了网页而非标准的 JSON 接口数据，疑似截胡`, 'error');
                return report;
            } else {
                report.endpoint.status = 'fail';
                report.endpoint.tip = t('Settings.Ai.TestFail404');
                report.overallStatus = 'failed';
                this.addLog('Endpoint', `无法连通或返回不符合周期的错误码: ${res.status}`, 'error');
                return report;
            }
        } catch (err: any) {
            report.endpoint.status = 'fail';
            report.endpoint.tip = t('Settings.Ai.TestFailNetwork');
            report.overallStatus = 'failed';
            this.addLog('Endpoint', `网络层握手崩溃: ${err.message}`, 'error');
            return report;
        }

        // --- Stage 2: Auth ---
        onProgress?.(t('Settings.Ai.TestStageAuth'));
        this.addLog('Auth', '尝试验证 API Key / Token 可用性');
        const authStartTime = Date.now();
        const authRes = await this.safeRequest(`${testUrl}/models`, 'GET', true);
        report.auth.latency = Date.now() - authStartTime;

        if (authRes.status === 200) {
            report.auth.status = 'pass';
            report.auth.value = '有效';
            this.addLog('Auth', 'API Key 校验通过 (受认可)');
        } else if (authRes.status === 404 && report.endpoint.status === 'warn') {
            report.auth.status = 'warn';
            report.auth.value = '跳过 (404)';
            report.auth.tip = 'Authentication will be verified in subsequent chat tests';
            this.addLog('Auth', '缺少 /models 端点，被迫跳过鉴权，将在下一步补偿', 'warn');
        } else {
            report.auth.status = 'fail';
            report.auth.value = `Error ${authRes.status}`;
            report.auth.tip = authRes.status === 401 ? t('Settings.Ai.TestFail401') : (authRes.status === 429 ? t('Settings.Ai.DiagTipQuota') : t('Settings.Ai.TestFailUnknown'));
            report.overallStatus = 'failed';
            this.addLog('Auth', `身份鉴权失败，服务器拒绝接入，状态码: ${authRes.status}`, 'error');
            return report;
        }

        // --- Stage 3: Model Availability ---
        if (!this.model) {
            report.model.status = 'warn';
            report.model.tip = 'No model name provided';
            this.addLog('Model', '未填写模型名称编码，放弃针对特定模型的专项联通检测', 'warn');
            return report;
        }

        onProgress?.(t('Settings.Ai.TestStageModel'));
        this.addLog('Model', `探测所选模型服务节点: [${this.model}]`);

        const modelStartTime = Date.now();
        const modelRes = await this.safeRequest(`${testUrl}/chat/completions`, 'POST', true, {
            model: this.model,
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 1
        });
        report.model.latency = Date.now() - modelStartTime;

        if (modelRes.status === 200) {
            report.model.status = 'pass';
            this.addLog('Model', `模型 ${this.model} 通道畅通，已能够生成对话`);
        } else {
            report.model.status = 'fail';
            report.model.tip = modelRes.status === 404 ? t('Settings.Ai.TestFail404') : t('Settings.Ai.TestFailModel');
            report.overallStatus = 'failed';
            this.addLog('Model', `向模型发送探针被拒绝或找不到该模型，状态码 ${modelRes.status}`, 'error');
            return report;
        }

        // --- Stage 3.5: System Role Support ---
        onProgress?.(t('Settings.Ai.DiagStageSystemRole'));
        this.addLog('SystemRole', '投递包含 system 前置角色的对白以测试其服从度');

        const sysRoleStartTime = Date.now();
        const sysRoleRes = await this.safeRequest(`${testUrl}/chat/completions`, 'POST', true, {
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
            report.systemRole.value = '已支持';
            this.addLog('SystemRole', 'System 身份槽响应正常，允许承载系统提示词');
        } else {
            report.systemRole.status = 'fail';
            report.systemRole.tip = t('Settings.Ai.DiagTipSystemRole');
            report.overallStatus = report.overallStatus === 'healthy' ? 'warning' : report.overallStatus;
            this.addLog('SystemRole', `模型拒绝了 system 角色扮演输入 (${sysRoleRes.status})`, 'warn');
        }

        // --- Stage 4: JSON Mode Test ---
        this.addLog('Capabilities', '探测原生 JSON_OBJECT 强制输出特性适配程度');
        onProgress?.(`${t('Settings.Ai.DiagItemJsonMode')}…`);
        const jsonModeRes = await this.safeRequest(`${testUrl}/chat/completions`, 'POST', true, {
            model: this.model,
            messages: [{ role: 'user', content: 'respond with json: {"ok":true}' }],
            response_format: { type: 'json_object' },
            max_tokens: 10
        });
        if (jsonModeRes.status === 200) {
            report.jsonMode.status = 'pass';
            report.jsonMode.value = '已支持';
            this.addLog('Capabilities', '探测通过：原生 JSON_OBJECT 强制输出工作正常');
        } else {
            report.jsonMode.status = 'warn';
            report.jsonMode.tip = '该模型不支持原生 JSON_OBJECT，建议在“响应格式”中回退为 Text';
            report.overallStatus = report.overallStatus === 'healthy' ? 'warning' : report.overallStatus;
            this.addLog('Capabilities', `模型明确拒绝或不支持 JSON 模式强制约束，状态码: ${jsonModeRes.status}`, 'warn');
        }

        // --- Stage 5: Structured Outputs (JSON Schema) Test ---
        this.addLog('Capabilities', '探测高级特性：结构化输出 (JSON Schema 严格遵循)');
        onProgress?.(`${t('Settings.Ai.DiagItemJsonSchema')}…`);
        const jsonSchemaRes = await this.safeRequest(`${testUrl}/chat/completions`, 'POST', true, {
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
            report.jsonSchema.value = '已支持';
            this.addLog('Capabilities', '探测通过：基于 JSON Schema 的高度结构化约束功能完好');
        } else {
            report.jsonSchema.status = 'warn';
            // 使用具体指导替换原先的提示词变量
            report.jsonSchema.tip = '该模型不支持原生 JSON_SCHEMA。若实际翻译报错，建议将响应格式改回 Text';
            report.overallStatus = report.overallStatus === 'healthy' ? 'warning' : report.overallStatus;
            this.addLog('Capabilities', `高级结构化输出功能遭拒或未实现，降级为常规生成 ${jsonSchemaRes.status}`, 'warn');
        }

        // --- Stage 6: Translation Simulation (End-to-End) ---
        onProgress?.(t('Settings.Ai.DiagStageTranslation'));
        this.addLog('Translation', '发起微型翻译沙盒进行 E2E 全链路终极模拟...');

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
            const transRes = await this.safeRequest(`${testUrl}/chat/completions`, 'POST', true, translationBody);
            const transLatency = Date.now() - transStartTime;
            report.translation.latency = transLatency;

            if (transRes.status !== 200) {
                report.translation.status = 'fail';
                // 添加针对格式相关的 400 错误的强引导
                if (transRes.status === 400 && this.responseFormat !== 'text') {
                    report.translation.tip = `API 返回 ${transRes.status}。这通常是因为当前模型不支持所选的响应格式 (${this.responseFormat})，请尝试改为 Text。`;
                } else {
                    report.translation.tip = `API 返回 ${transRes.status}`;
                }
                report.overallStatus = 'failed';
                this.addLog('Translation', `翻译沙盒全链路模拟失败，网关或模型返回异常状态码: ${transRes.status}`, 'error');
            } else {
                // 尝试解析返回内容 (引入统一的三级自愈机制)
                let parseSuccess = false;
                try {
                    const body = typeof transRes.json === 'object' ? transRes.json : JSON.parse(transRes.text);
                    const content = body?.choices?.[0]?.message?.content;
                    if (content) {
                        let resultArray: any[] = [];
                        try {
                            resultArray = parseTranslationResponse(content);
                        } catch (e: any) {
                            this.addLog('Translation', `三级自愈解析器通报：数据格式受损严重，强制抢救时抛出异常: ${e.message}`, 'warn');
                        }

                        if (resultArray && resultArray.length > 0) {
                            const hasCorrectFields = resultArray.every((item: any) =>
                                typeof item.i === 'number' && typeof item.t === 'string'
                            );
                            const idsMatch = resultArray.some((item: any) => item.i === 1 || item.i === 2);

                            if (hasCorrectFields && idsMatch) {
                                parseSuccess = true;
                                report.translation.status = 'pass';
                                report.translation.value = `OK (${transLatency}ms)`;
                                this.addLog('Translation', `✔ 沙盒全链路通过：系统成功捕获并重组出 ${resultArray.length} 条翻译元数据 (经三级自愈体系处理)，响应耗时 ${transLatency}ms`);
                            }
                        }
                    }
                } catch (e: any) {
                    this.addLog('Translation', `底层提取极其恶劣的返回载荷时直接崩溃 (不属于常规 JSON 解析错): ${e.message}`, 'error');
                }

                if (!parseSuccess) {
                    report.translation.status = 'fail';
                    report.translation.tip = t('Settings.Ai.DiagTipTranslationFail');
                    report.overallStatus = 'failed';
                    this.addLog('Translation', '模型生成了毫无逻辑的随机废话格式，数据彻底断裂，无法重组出任何翻译项目', 'error');
                }

                // 延迟预警：如果简单 2 条翻译已接近超时阈值的 80%
                if (parseSuccess && transLatency > this.timeout * 0.8) {
                    report.translation.status = 'warn';
                    report.translation.tip = t('Settings.Ai.DiagTipLatencyWarn');
                    report.overallStatus = report.overallStatus === 'healthy' ? 'warning' : report.overallStatus;
                    this.addLog('Translation', `速率警报：最简单的模拟请求已消耗 ${transLatency}ms，极度逼近硬性超时极值 ${this.timeout}ms，批量实兵翻译时大概率会崩盘。`, 'warn');
                }
            }
        } catch (err: any) {
            report.translation.status = 'fail';
            report.translation.latency = Date.now() - transStartTime;
            report.translation.tip = err.message?.includes('timeout') ? t('Settings.Ai.TestFailTimeout') : t('Settings.Ai.DiagTipTranslationFail');
            report.overallStatus = 'failed';
            this.addLog('Translation', `全链路测试握手直接抛出底层请求错误: ${err.message}`, 'error');
        }

        return report;
    }

    private async safeRequest(url: string, method: string, includeAuth = false, body?: any) {
        const headers: Record<string, string> = {};
        if (includeAuth) headers['Authorization'] = `Bearer ${this.key}`;
        if (body) headers['Content-Type'] = 'application/json';

        try {
            const res = await requestUrl({
                url,
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                throw: false
            });

            // 安全防御：如果接口返回的是带有 HTML 的网页文件，说明填错了基础地址（比如误填了官网主页）
            if (res.status >= 200 && res.status < 300 && res.text) {
                const head = res.text.trim().toLowerCase();
                if (head.startsWith('<!doctype') || head.startsWith('<html')) {
                    this.addLog('Network', `高危拦截！向 ${url} 请求时却收到了巨长的一坨 HTML 网页代码，鉴定为错误配成了官网地址或漏加了 /v1 路径。当场拦截变造为 406 并阻断后续蠢事。`, 'warn');
                    return { status: 406, text: res.text, json: undefined } as any;
                }
            }

            return res;
        } catch (err: any) {
            if (err.message?.includes('timeout')) return { status: 408 } as any;
            throw err;
        }
    }
}
