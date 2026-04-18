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
    concurrency?: DiagItem;
    logs: DiagnosticLog[];
}

export class ConnectivityTester {
    private url: string;
    private key: string;
    private model: string;
    private engine: 'openai' | 'gemini' | 'ollama';
    private responseFormat: string;
    private timeout: number;
    private logs: DiagnosticLog[] = [];

    constructor(url: string, key: string, model: string, engine?: 'openai' | 'gemini' | 'ollama', responseFormat?: string, timeout?: number) {
        this.url = (url || '').trim();
        this.key = key.trim();
        this.model = model.trim();
        this.engine = engine || 'openai';
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
            concurrency: { status: 'na', value: '未连通' },
            logs: this.logs
        };

        // --- Stage 1: Endpoint & Basic Network ---
        this.addLog('Endpoint', `正在测试到 ${this.url} 的连通性 (引擎: ${this.engine})`);
        onProgress?.(t('Settings.Ai.TestStageNetwork'));

        const startTime = Date.now();
        const baseUrl = normalizeOpenAIUrl(this.url);
        // 根据引擎类型选择默认测试地址
        const defaultUrls: Record<string, string> = {
            openai: 'https://api.openai.com/v1',
            gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
            ollama: 'http://localhost:11434/v1'
        };
        const testUrl = baseUrl || defaultUrls[this.engine] || defaultUrls.openai;

        try {
            // 启发式检查
            if (this.url && !this.url.match(/^https?:\/\//)) {
                report.endpoint.status = 'warn';
                report.endpoint.tip = 'URL 必须以 http:// 或 https:// 开头';
                this.addLog('Endpoint', '协议异常 (请检查 http/https 头)', 'warn');
            }

            // Ollama 本地服务不走 /models 探测，而是直接 ping 根路径
            const probeUrl = this.engine === 'ollama' ? `${testUrl.replace(/\/v1$/, '')}/api/tags` : `${testUrl}/models`;
            const res = await this.safeRequest(probeUrl, 'GET', this.engine !== 'ollama');
            const latency = Date.now() - startTime;
            report.endpoint.latency = latency;

            if (res.status >= 200 && res.status < 300 || [401, 403, 405, 429].includes(res.status)) {
                report.endpoint.status = report.endpoint.status === 'warn' ? 'warn' : 'pass';
                report.endpoint.value = `${testUrl} (${res.status})`;
                this.addLog('Endpoint', `成功连通 (耗时: ${latency}ms, 状态码: ${res.status})`);
            } else if (res.status === 404) {
                report.endpoint.status = 'warn';
                report.endpoint.value = `${testUrl} (${res.status})`;
                const tip404 = this.engine === 'gemini'
                    ? '端点返回 404，Gemini 使用 /v1beta 路径，请确认接口地址正确'
                    : (t('Settings.Ai.TestFail404') || '端点未找到，将继续后续测试...');
                report.endpoint.tip = tip404;
                this.addLog('Endpoint', `探测端点返回 404，忽略并继续...`, 'warn');
            } else if (res.status === 406) {
                report.endpoint.status = 'fail';
                report.endpoint.tip = '该地址返回了网页前端而非接口数据。通常是因为填成了官网地址或漏加了 /v1 路径';
                report.endpoint.value = 'HTML 冲突';
                report.overallStatus = 'failed';
                this.addLog('Endpoint', `检测到 HTML 响应，地址可能配置为官网主页`, 'error');
                return report;
            } else {
                report.endpoint.status = 'fail';
                report.endpoint.tip = t('Settings.Ai.TestFail404');
                report.overallStatus = 'failed';
                this.addLog('Endpoint', `无法连通，返回状态码: ${res.status}`, 'error');
                return report;
            }
        } catch (err: any) {
            report.endpoint.status = 'fail';
            report.overallStatus = 'failed';
            // 精细化网络错误诊断
            const msg = err.message || '';
            if (msg.includes('ECONNREFUSED') || msg.includes('ERR_CONNECTION_REFUSED')) {
                report.endpoint.tip = this.engine === 'ollama'
                    ? 'Ollama 服务未启动或端口被占用。请确认已运行 ollama serve 并监听在正确端口。'
                    : '目标服务器拒绝连接，请检查地址和端口是否正确。';
                this.addLog('Endpoint', `连接被拒绝 (ECONNREFUSED): ${msg}`, 'error');
            } else if (msg.includes('ENOTFOUND') || msg.includes('ERR_NAME_NOT_RESOLVED') || msg.includes('getaddrinfo')) {
                report.endpoint.tip = '域名无法解析，请检查拼写或确认网络/代理规则已放行该域名。';
                this.addLog('Endpoint', `DNS 解析失败: ${msg}`, 'error');
            } else if (msg.includes('ETIMEDOUT') || msg.includes('timeout')) {
                report.endpoint.tip = '连接超时，服务器无响应。请检查网络环境或是否需要配置代理。';
                this.addLog('Endpoint', `连接超时: ${msg}`, 'error');
            } else if (msg.includes('ERR_TLS') || msg.includes('CERT') || msg.includes('SSL')) {
                report.endpoint.tip = 'TLS/SSL 证书校验失败，如使用自签名证书的代理可能引发此错误。';
                this.addLog('Endpoint', `TLS 证书错误: ${msg}`, 'error');
            } else {
                report.endpoint.tip = t('Settings.Ai.TestFailNetwork');
                this.addLog('Endpoint', `网络异常: ${msg}`, 'error');
            }
            return report;
        }

        // --- Stage 2: Auth ---
        onProgress?.(t('Settings.Ai.TestStageAuth'));
        this.addLog('Auth', '尝试验证 API Key / Token 可用性');

        // Ollama 本地部署通常无需鉴权，直接跳过
        if (this.engine === 'ollama') {
            report.auth.status = 'pass';
            report.auth.value = '本地服务 (免鉴权)';
            report.auth.latency = 0;
            this.addLog('Auth', 'Ollama 本地引擎，跳过 API Key 鉴权');
        } else {
            const authStartTime = Date.now();
            const authProbeUrl = `${testUrl}/models`;
            const authRes = await this.safeRequest(authProbeUrl, 'GET', true);
            report.auth.latency = Date.now() - authStartTime;

            if (authRes.status === 200) {
                report.auth.status = 'pass';
                report.auth.value = '有效';
                this.addLog('Auth', 'API Key 校验通过');
            } else if (authRes.status === 404 && report.endpoint.status === 'warn') {
                report.auth.status = 'warn';
                report.auth.value = '跳过 (404)';
                report.auth.tip = '鉴权端点不可用，将在后续对话测试中验证密钥有效性';
                this.addLog('Auth', '缺少 /models 端点，跳过鉴权，将在后续步骤中补偿', 'warn');
            } else {
                report.auth.status = 'fail';
                report.auth.value = `错误 ${authRes.status}`;
                report.auth.tip = authRes.status === 401 ? t('Settings.Ai.TestFail401') : (authRes.status === 429 ? t('Settings.Ai.DiagTipQuota') : t('Settings.Ai.TestFailUnknown'));
                report.overallStatus = 'failed';
                this.addLog('Auth', `身份鉴权失败，状态码: ${authRes.status}`, 'error');
                return report;
            }
        }

        // --- Stage 3: Model Availability ---
        if (!this.model) {
            report.model.status = 'warn';
            report.model.tip = '未填写模型名称，跳过模型可用性检测';
            this.addLog('Model', '未填写模型名称，跳过模型可用性检测', 'warn');
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

        // --- Stage 7: Concurrency Burst Test ---
        if (report.translation.status === 'pass') {
            onProgress?.(t('Settings.Ai.DiagStageConcurrency'));
            this.addLog('Concurrency', '正在模拟并发连发以探测频率限制...');

            const burstCount = 3;
            const burstStart = Date.now();
            try {
                const burstBody = {
                    model: this.model,
                    messages: [{ role: 'user', content: 'hi' }],
                    max_tokens: 1
                };
                const burstPromises = Array.from({ length: burstCount }, () =>
                    this.safeRequest(`${testUrl}/chat/completions`, 'POST', true, burstBody)
                );
                const burstResults = await Promise.all(burstPromises);
                report.concurrency!.latency = Date.now() - burstStart;

                const has429 = burstResults.some(r => r.status === 429);
                const allOk = burstResults.every(r => r.status === 200);

                if (allOk) {
                    report.concurrency!.status = 'pass';
                    report.concurrency!.value = `${burstCount} 并发全部通过`;
                    this.addLog('Concurrency', `${burstCount} 个并发请求全部成功 (${report.concurrency!.latency}ms)`);
                } else if (has429) {
                    report.concurrency!.status = 'warn';
                    report.concurrency!.value = '触发频率限制 (429)';
                    report.concurrency!.tip = t('Settings.Ai.DiagTipConcurrency');
                    report.overallStatus = report.overallStatus === 'healthy' ? 'warning' : report.overallStatus;
                    this.addLog('Concurrency', `${burstCount} 并发中检测到 429 频率限制，建议降低并发数`, 'warn');
                } else {
                    const statuses = burstResults.map(r => r.status).join(', ');
                    report.concurrency!.status = 'warn';
                    report.concurrency!.value = `部分异常 (${statuses})`;
                    report.concurrency!.tip = '并发请求部分失败，批量翻译可能不稳定';
                    report.overallStatus = report.overallStatus === 'healthy' ? 'warning' : report.overallStatus;
                    this.addLog('Concurrency', `并发测试返回混合状态: ${statuses}`, 'warn');
                }
            } catch (err: any) {
                report.concurrency!.status = 'warn';
                report.concurrency!.value = '测试异常';
                report.concurrency!.tip = '并发测试过程中出错，无法判定频率限制情况';
                report.concurrency!.latency = Date.now() - burstStart;
                this.addLog('Concurrency', `并发测试异常: ${err.message}`, 'warn');
            }
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
