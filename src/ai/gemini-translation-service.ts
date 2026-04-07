/**
 * Google Gemini 翻译 Provider
 * 
 * 使用 @google/genai SDK 调用 Google AI Studio API。
 * 通过 Obsidian 的 requestUrl 代理绕过 CORS 限制。
 */

import { requestUrl } from "obsidian";
import { RegexItem, AstItem } from "../views/plugin_editor/types";
import { ThemeTranslationItem } from "../views/theme_editor/types";
import { useGlobalStoreInstance } from "~/utils";
import { BaseProvider } from "./base-provider";

/** Gemini API 基础 URL */
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiTranslationService extends BaseProvider {

    constructor() {
        super();
    }

    /** 覆写：返回当前 Gemini 模型名 */
    protected override getModelName(): string {
        const activeProfile = this.getActiveProfile();
        return activeProfile?.model || useGlobalStoreInstance.getState().i18n.settings.llmGeminiModel || 'gemini-2.0-flash';
    }

    // ======================== 核心 API 调用 ========================

    /**
     * 调用 Gemini API
     */
    private async callGemini(items: any[], systemPrompt: string, signal?: AbortSignal, maxRetries = 2): Promise<any[]> {
        const settings = useGlobalStoreInstance.getState().i18n.settings;
        const activeProfile = this.getActiveProfile();

        const apiKey = activeProfile?.key || settings.llmGeminiKey;
        const model = this.getModelName();

        if (!apiKey) throw new Error('请先配置 Gemini API Key');

        const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`;

        const requestBody = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: JSON.stringify(items) }]
                }
            ],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                temperature: 0.3,
                responseMimeType: 'application/json',
            }
        };

        let attempt = 0;
        let lastError: any = null;

        while (attempt <= maxRetries) {
            const timeoutController = new AbortController();
            const timeoutMs = this.getTimeout();
            const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

            const abortHandler = () => timeoutController.abort();
            if (signal) signal.addEventListener('abort', abortHandler);

            try {
                if (signal?.aborted) throw new Error('翻译任务已取消');

                const response = await requestUrl({
                    url,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                    throw: false
                });

                if (response.status !== 200) {
                    const errorBody = response.json;
                    const errorMsg = errorBody?.error?.message || `HTTP ${response.status}`;
                    throw new Error(`Gemini API 错误: ${errorMsg}`);
                }

                const data = response.json;
                const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;

                if (!content) throw new Error('Gemini 返回内容为空');

                let parsedData: unknown;
                try {
                    parsedData = JSON.parse(content);
                } catch {
                    // 尝试从 markdown 代码块提取
                    const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                    if (match) {
                        parsedData = JSON.parse(match[1]);
                    } else {
                        throw new Error(`Gemini 返回 JSON 解析失败`);
                    }
                }

                // 验证数据结构
                if (!Array.isArray(parsedData)) {
                    // 部分 Gemini 模型可能返回 { items: [...] } 格式
                    if ((parsedData as any)?.items && Array.isArray((parsedData as any).items)) {
                        parsedData = (parsedData as any).items;
                    } else {
                        throw new Error('Gemini 返回数据不是数组格式');
                    }
                }

                return parsedData as any[];
            } catch (error: any) {
                const isTimeout = error.name === 'AbortError' && !signal?.aborted;
                const isManualAbort = signal?.aborted || error.message === '翻译任务已取消';

                if (isManualAbort) throw new Error('翻译任务已取消');

                lastError = isTimeout ? new Error(`请求超时 (${timeoutMs}ms)`) : error;
                attempt++;

                if (attempt <= maxRetries) {
                    console.warn(`[Gemini API] ${isTimeout ? '请求超时' : '调用失败'}，正在尝试第 ${attempt} 次重试...`, lastError.message);
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            } finally {
                clearTimeout(timeoutId);
                if (signal) signal.removeEventListener('abort', abortHandler);
            }
        }

        throw new Error(lastError?.message || '未知错误');
    }

    // ======================== 翻译实现 ========================

    protected async callRegexTranslationAPI(items: RegexItem[], signal?: AbortSignal): Promise<RegexItem[]> {
        const systemPrompt = this.getRegexSystemPrompt();
        const simplifiedItems = items.map(item => ({ i: item.id, s: item.source }));
        const results = await this.callGemini(simplifiedItems, systemPrompt, signal);
        return this.mapResultsBack(items, results);
    }

    protected async callAstTranslationAPI(items: AstItem[], signal?: AbortSignal): Promise<AstItem[]> {
        const systemPrompt = this.getAstSystemPrompt();
        const simplifiedItems = items.map(item => ({ i: item.id, s: item.source, y: item.type, n: item.name }));
        const results = await this.callGemini(simplifiedItems, systemPrompt, signal);
        return this.mapResultsBack(items, results);
    }

    protected async callThemeTranslationAPI(items: ThemeTranslationItem[], signal?: AbortSignal): Promise<ThemeTranslationItem[]> {
        const systemPrompt = this.getThemeSystemPrompt();
        const simplifiedItems = items.map(item => ({ i: (item as any).id, s: item.source, y: item.type }));
        const results = await this.callGemini(simplifiedItems, systemPrompt, signal);
        return this.mapResultsBack(items as any[], results) as unknown as ThemeTranslationItem[];
    }
}
