/**
 * Ollama 本地模型翻译 Provider
 * 
 * 复用 OpenAI 兼容协议（Ollama 原生支持 /v1/chat/completions）。
 * 主要区别：
 * - 预设默认端点 http://localhost:11434
 * - 无需 API Key
 * - 支持从 Ollama 获取已安装模型列表
 */

import { requestUrl } from "obsidian";
import { RegexItem, AstItem } from "../views/plugin_editor/types";
import { ThemeTranslationItem } from "../views/theme_editor/types";
import { useGlobalStoreInstance } from "~/utils";
import { BaseProvider } from "./base-provider";

/** Ollama 默认端点 */
export const OLLAMA_DEFAULT_URL = 'http://localhost:11434';

export class OllamaTranslationService extends BaseProvider {

    constructor() {
        super();
    }

    /** 覆写：返回当前 Ollama 模型名 */
    protected override getModelName(): string {
        const activeProfile = this.getActiveProfile();
        return activeProfile?.model || useGlobalStoreInstance.getState().i18n.settings.llmOllamaModel || 'qwen2.5';
    }

    /** 获取 Ollama 端点地址 */
    private getBaseUrl(): string {
        const activeProfile = this.getActiveProfile();
        const url = activeProfile?.url || useGlobalStoreInstance.getState().i18n.settings.llmOllamaUrl || OLLAMA_DEFAULT_URL;
        return url.replace(/\/+$/, '');
    }

    // ======================== 核心 API 调用 ========================

    /**
     * 调用 Ollama 的 OpenAI 兼容 API
     */
    private async callOllama(items: any[], systemPrompt: string, signal?: AbortSignal, maxRetries = 2): Promise<any[]> {
        const baseUrl = this.getBaseUrl();
        const model = this.getModelName();
        const url = `${baseUrl}/v1/chat/completions`;

        const requestBody = {
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: JSON.stringify(items) }
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' },
            stream: false,
        };

        let attempt = 0;
        let lastError: any = null;

        while (attempt <= maxRetries) {
            const timeoutMs = this.getTimeout();
            const timeoutId = { id: null as any };

            try {
                if (signal?.aborted) throw new Error('翻译任务已取消');

                // Ollama 本地模型可能较慢，超时设高一些
                const effectiveTimeout = Math.max(timeoutMs, 120000);

                const responsePromise = requestUrl({
                    url,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                    throw: false
                });

                // 手动实现超时
                const timeoutPromise = new Promise<never>((_, reject) => {
                    timeoutId.id = setTimeout(() => reject(new Error(`请求超时 (${effectiveTimeout}ms)`)), effectiveTimeout);
                });

                const response = await Promise.race([responsePromise, timeoutPromise]);

                if (response.status !== 200) {
                    const errorMsg = response.json?.error?.message || `HTTP ${response.status}`;
                    throw new Error(`Ollama API 错误: ${errorMsg}`);
                }

                const data = response.json;
                const content = data?.choices?.[0]?.message?.content;

                if (!content) throw new Error('Ollama 返回内容为空');

                let parsedData: unknown;
                try {
                    parsedData = JSON.parse(content);
                } catch {
                    const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                    if (match) {
                        parsedData = JSON.parse(match[1]);
                    } else {
                        throw new Error('Ollama 返回 JSON 解析失败');
                    }
                }

                if (!Array.isArray(parsedData)) {
                    if ((parsedData as any)?.items && Array.isArray((parsedData as any).items)) {
                        parsedData = (parsedData as any).items;
                    } else {
                        throw new Error('Ollama 返回数据不是数组格式');
                    }
                }

                return parsedData as any[];
            } catch (error: any) {
                const isManualAbort = signal?.aborted || error.message === '翻译任务已取消';
                if (isManualAbort) throw new Error('翻译任务已取消');

                lastError = error;
                attempt++;

                if (attempt <= maxRetries) {
                    console.warn(`[Ollama API] 调用失败，正在尝试第 ${attempt} 次重试...`, lastError.message);
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            } finally {
                if (timeoutId.id) clearTimeout(timeoutId.id);
            }
        }

        throw new Error(lastError?.message || '未知错误');
    }

    // ======================== 翻译实现 ========================

    protected async callRegexTranslationAPI(items: RegexItem[], signal?: AbortSignal): Promise<RegexItem[]> {
        const systemPrompt = this.getRegexSystemPrompt();
        const simplifiedItems = items.map(item => ({ i: item.id, s: item.source }));
        const results = await this.callOllama(simplifiedItems, systemPrompt, signal);
        return this.mapResultsBack(items, results);
    }

    protected async callAstTranslationAPI(items: AstItem[], signal?: AbortSignal): Promise<AstItem[]> {
        const systemPrompt = this.getAstSystemPrompt();
        const simplifiedItems = items.map(item => ({ i: item.id, s: item.source, y: item.type, n: item.name }));
        const results = await this.callOllama(simplifiedItems, systemPrompt, signal);
        return this.mapResultsBack(items, results);
    }

    protected async callThemeTranslationAPI(items: ThemeTranslationItem[], signal?: AbortSignal): Promise<ThemeTranslationItem[]> {
        const systemPrompt = this.getThemeSystemPrompt();
        const simplifiedItems = items.map(item => ({ i: (item as any).id, s: item.source, y: item.type }));
        const results = await this.callOllama(simplifiedItems, systemPrompt, signal);
        return this.mapResultsBack(items as any[], results) as unknown as ThemeTranslationItem[];
    }

    // ======================== 公共工具方法 ========================

    /**
     * 从 Ollama 获取已安装的模型列表
     */
    public static async fetchModels(baseUrl?: string): Promise<string[]> {
        const url = (baseUrl || OLLAMA_DEFAULT_URL).replace(/\/+$/, '');
        try {
            const response = await requestUrl({
                url: `${url}/api/tags`,
                method: 'GET',
                throw: false
            });

            if (response.status === 200 && response.json?.models) {
                return response.json.models.map((m: any) => m.name || m.model);
            }
            return [];
        } catch {
            return [];
        }
    }
}
