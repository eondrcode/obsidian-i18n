
import { requestUrl } from "obsidian";
import OpenAI from "openai";
import { normalizeOpenAIUrl } from "../utils/ai/url-helper";
import { RegexItem, AstItem } from "../views/plugin_editor/types";
import { ThemeTranslationItem } from "../views/theme_editor/types";
import z from "zod";
import { useGlobalStoreInstance } from "~/utils";
import { BaseProvider } from "./base-provider";
import { LLM_PROVIDERS } from "./constants";
import {
    DEFAULT_REGEX_PROMPT_TEMPLATE, generateRegexSystemPrompt,
    DEFAULT_AST_PROMPT_TEMPLATE, generateAstSystemPrompt,
    DEFAULT_THEME_PROMPT_TEMPLATE, generateThemeSystemPrompt,
} from "./prompts";

// 自定义消息类型
interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

// --- 优化后的 Zod Schema (用于 API 传输和校验) ---

// 输入数据的精简结构 (发送给 AI)
const SimplifiedInputSchema = z.object({
    i: z.number(),       // id
    s: z.string(),       // source
    y: z.string().optional(), // type (context)
    n: z.string().optional(), // name (context)
});

// 输出数据的精简结构 (从 AI 接收)
const SimplifiedOutputSchema = z.object({
    i: z.number(),       // id
    t: z.string(),       // target
});
const SimplifiedOutputArraySchema = z.array(SimplifiedOutputSchema);

// 保持原始数据类型的校验 (用于还原后的最终校验)
const RegexItemSchema = z.object({ id: z.number(), source: z.string(), target: z.string() });
const RegexItemArraySchema = z.array(RegexItemSchema);

const AstItemSchema = z.object({ id: z.number(), source: z.string(), target: z.string(), type: z.string(), name: z.string() });
const AstItemArraySchema = z.array(AstItemSchema);

const ThemeItemSchema = z.object({ id: z.number(), source: z.string(), target: z.string(), type: z.string().optional() });
const ThemeItemArraySchema = z.array(ThemeItemSchema);

export class OpenAITranslationService extends BaseProvider {

    constructor() {
        super();
    }

    /**
     * 获取 OpenAI 实例 (动态获取最新配置)
     */
    private getOpenAIClient(): OpenAI {
        const settings = useGlobalStoreInstance.getState().i18n.settings;
        const activeProfile = this.getActiveProfile();

        let baseURL: string | undefined = undefined;
        let apiKey: string = "";

        if (activeProfile) {
            apiKey = activeProfile.key;
            const rawUrl = normalizeOpenAIUrl(activeProfile.url || LLM_PROVIDERS[settings.llmApi]?.baseUrl || "");
            baseURL = rawUrl ? `${rawUrl}/v1` : undefined;
        } else {
            // 回退到以前的单字段配置 (仅为了极致兼容)
            const config = LLM_PROVIDERS[settings.llmApi];
            if (config) {
                apiKey = (settings as any)[config.keyField] as string;
                baseURL = config.baseUrl;
            }
        }

        return new OpenAI({
            baseURL: baseURL,
            apiKey: apiKey,
            dangerouslyAllowBrowser: true,
            fetch: async (url, options) => {
                // ... (Headers handling remains same)
                const headers: Record<string, string> = {};
                if (options?.headers) {
                    if (options.headers instanceof Headers) {
                        options.headers.forEach((value, key) => { headers[key] = value; });
                    } else if (Array.isArray(options.headers)) {
                        options.headers.forEach(([key, value]) => { headers[key] = value; });
                    } else {
                        Object.assign(headers, options.headers as Record<string, string>);
                    }
                }

                const signal = options?.signal;
                return new Promise((resolve, reject) => {
                    const onAbort = () => reject(new Error('AbortError'));
                    if (signal?.aborted) return onAbort();
                    signal?.addEventListener('abort', onAbort);

                    requestUrl({
                        url: url.toString(),
                        method: options?.method || 'POST',
                        headers: headers,
                        body: options?.body as string,
                        throw: false
                    }).then(response => {
                        signal?.removeEventListener('abort', onAbort);
                        resolve({
                            ok: response.status >= 200 && response.status < 300,
                            status: response.status,
                            statusText: response.status.toString(),
                            headers: new Headers(response.headers as any),
                            json: () => Promise.resolve(response.json),
                            text: () => Promise.resolve(response.text),
                            arrayBuffer: () => Promise.resolve(response.arrayBuffer),
                        } as Response);
                    }).catch(err => {
                        signal?.removeEventListener('abort', onAbort);
                        reject(err);
                    });
                });
            }
        });
    }

    /** 覆写：返回当前服务对应的模型名 */
    protected override getModelName(): string {
        const activeProfile = this.getActiveProfile();
        if (activeProfile?.model) return activeProfile.model;

        const settings = useGlobalStoreInstance.getState().i18n.settings;
        const config = LLM_PROVIDERS[settings.llmApi];
        if (config) {
            const model = (settings as any)[config.modelField] as string;
            return model || config.defaultModel;
        }
        return 'gpt-4o-mini';
    }

    /**
     * Regex 专用 API 调用
     */
    protected async callRegexTranslationAPI(items: RegexItem[], signal?: AbortSignal): Promise<RegexItem[]> {
        const systemPrompt = this.getRegexSystemPrompt();
        const simplifiedItems = items.map(item => ({ i: item.id, s: item.source }));
        const simplifiedResults = await this.callOpenAI(simplifiedItems, systemPrompt, SimplifiedOutputArraySchema, signal);
        return this.mapResultsBack(items, simplifiedResults as any[]);
    }

    /**
     * AST 专用 API 调用
     */
    protected async callAstTranslationAPI(items: AstItem[], signal?: AbortSignal): Promise<AstItem[]> {
        const systemPrompt = this.getAstSystemPrompt();
        const simplifiedItems = items.map(item => ({ i: item.id, s: item.source, y: item.type, n: item.name }));
        const simplifiedResults = await this.callOpenAI(simplifiedItems, systemPrompt, SimplifiedOutputArraySchema, signal);
        return this.mapResultsBack(items, simplifiedResults as any[]);
    }

    /**
     * Theme 专用 API 调用
     */
    protected async callThemeTranslationAPI(items: ThemeTranslationItem[], signal?: AbortSignal): Promise<ThemeTranslationItem[]> {
        const systemPrompt = this.getThemeSystemPrompt();
        const simplifiedItems = items.map(item => ({ i: (item as any).id, s: item.source, y: item.type }));
        const simplifiedResults = await this.callOpenAI(simplifiedItems, systemPrompt, SimplifiedOutputArraySchema, signal);
        return this.mapResultsBack(items as any[], simplifiedResults as any[]) as unknown as ThemeTranslationItem[];
    }


    /**
     * 统一的 OpenAI 调用逻辑
     */
    private async callOpenAI(items: any[], systemPrompt: string, schema: z.ZodType<any>, signal?: AbortSignal, maxRetries = 2): Promise<any[]> {
        const settings = useGlobalStoreInstance.getState().i18n.settings;
        const messages: ChatMessage[] = [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify(items) },
        ];

        let attempt = 0;
        let lastError: any = null;

        while (attempt <= maxRetries) {
            const timeoutController = new AbortController();
            const timeoutMs = settings.llmTimeout || 60000;
            const timeoutId = setTimeout(() => {
                timeoutController.abort();
            }, timeoutMs);

            const abortHandler = () => timeoutController.abort();
            if (signal) {
                signal.addEventListener('abort', abortHandler);
            }

            try {
                if (signal?.aborted) throw new Error('翻译任务已取消');

                const openai = this.getOpenAIClient();
                const completion = await openai.chat.completions.create({
                    messages: messages as any,
                    model: this.getModelName(),
                    temperature: 0.3,
                    response_format: { type: settings.llmResponseFormat as any },
                }, { signal: timeoutController.signal });

                let assistantContent = completion.choices[0].message.content;
                if (!assistantContent) { throw new Error('翻译结果为空'); }

                let parsedData: unknown;
                try {
                    parsedData = JSON.parse(assistantContent);
                } catch (parseError) {
                    // 尝试初步修复通常的截断或者特殊符号引起的 JSON 问题
                    try {
                        let fixedContent = assistantContent;
                        const jsonMatch = fixedContent.match(/```json\s*([\s\S]*?)\s*```/) || fixedContent.match(/```\s*([\s\S]*?)\s*```/);
                        if (jsonMatch) fixedContent = jsonMatch[1];
                        fixedContent = fixedContent.replace(/[\u0000-\u001F]+/g, " ");
                        parsedData = JSON.parse(fixedContent);
                    } catch (e) {
                        throw new Error(`JSON语法错误: ${(e as Error).message}`);
                    }
                }

                return schema.parse(parsedData);
            } catch (error: any) {
                // 检查是否是因为超时导致的取消
                const isTimeout = error.name === 'AbortError' && !signal?.aborted;
                const isManualAbort = signal?.aborted || error.message === '翻译任务已取消';

                if (isManualAbort) {
                    throw new Error('翻译任务已取消');
                }

                lastError = isTimeout ? new Error(`请求超时 (${timeoutMs}ms)`) : error;
                attempt++;

                if (attempt <= maxRetries) {
                    console.warn(`[OpenAI API] ${isTimeout ? '请求超时' : '调用失败'}，正在尝试第 ${attempt} 次重试...`, lastError.message);
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            } finally {
                // 清理资源
                clearTimeout(timeoutId);
                if (signal) {
                    signal.removeEventListener('abort', abortHandler);
                }
            }
        }

        const errorMsg = lastError ? (lastError as Error).message : '未知错误';
        console.error(`[OpenAI API] 批次翻译API调用最终失败:`, errorMsg, `\n请求数据：${JSON.stringify(items)}`);

        // 抛出错误，交由上层的 executeParallelBatches 统一捕获并执行界面提醒
        throw new Error(errorMsg);
    }
}









