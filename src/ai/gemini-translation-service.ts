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
        return activeProfile?.model || 'gemini-2.0-flash';
    }

    // ======================== 核心 API 调用 ========================

    /**
     * 调用 Gemini API
     */
    private async callGemini(items: any[], systemPrompt: string, signal?: AbortSignal, maxRetries = 2): Promise<any[]> {
        const activeProfile = this.getActiveProfile();
        if (!activeProfile) throw new Error('Missing active profile for Gemini');
        
        const apiKey = activeProfile.key;
        const model = this.getModelName();

        if (!apiKey) throw new Error('请先配置 Gemini API Key');

        let baseUrl = activeProfile.url?.trim() || GEMINI_API_BASE;
        baseUrl = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
        
        const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

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

                return this.parseResponseContent(content);
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
        const simplifiedItems = items.map(item => {
            const simplified: any = { i: item.id, s: item.source };
            return simplified;
        });
        const results = await this.callGemini(simplifiedItems, systemPrompt, signal);
        return this.mapResultsBack(items, results);
    }

    protected async callAstTranslationAPI(items: AstItem[], signal?: AbortSignal): Promise<AstItem[]> {
        const systemPrompt = this.getAstSystemPrompt();
        const simplifiedItems = items.map(item => {
            const simplified: any = { i: item.id, s: item.source, y: item.type, n: item.name };
            return simplified;
        });
        const results = await this.callGemini(simplifiedItems, systemPrompt, signal);
        return this.mapResultsBack(items, results);
    }

    protected async callThemeTranslationAPI(items: ThemeTranslationItem[], signal?: AbortSignal): Promise<ThemeTranslationItem[]> {
        const systemPrompt = this.getThemeSystemPrompt();
        const simplifiedItems = items.map(item => ({ i: (item as any).id, s: item.source, y: item.type }));
        const results = await this.callGemini(simplifiedItems, systemPrompt, signal);
        return this.mapResultsBack(items as any[], results) as unknown as ThemeTranslationItem[];
    }

    /**
     * Fix API — 修复单条翻译 (Gemini 实现)
     */
    protected override async callFixAPI(
        source: string,
        target: string,
        errorMessage: string,
        systemPrompt: string,
        signal?: AbortSignal
    ): Promise<string> {
        const activeProfile = this.getActiveProfile();
        if (!activeProfile) throw new Error('Missing active profile for Gemini');
        
        const apiKey = activeProfile.key;
        const model = this.getModelName();

        if (!apiKey) throw new Error('请先配置 Gemini API Key');

        let baseUrl = activeProfile.url?.trim() || GEMINI_API_BASE;
        baseUrl = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes

        const userContent = `Source: ${source}\nBroken Translation: ${target}\nError: ${errorMessage}\n\nPlease return ONLY the fixed translation string.`;

        const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;
        const requestBody = {
            contents: [{ role: 'user', parts: [{ text: userContent }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { temperature: 0.2 }
        };

        const response = await requestUrl({
            url,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            throw: false
        });

        if (response.status !== 200) {
            const errorMsg = response.json?.error?.message || `HTTP ${response.status}`;
            throw new Error(`Gemini API 错误: ${errorMsg}`);
        }

        const content = response.json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!content || content.trim() === '') throw new Error('AI 返回的修复结果为空');

        let cleaned = content.trim();
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) cleaned = cleaned.slice(1, -1);
        if (cleaned.startsWith("'") && cleaned.endsWith("'")) cleaned = cleaned.slice(1, -1);

        return cleaned;
    }
}
