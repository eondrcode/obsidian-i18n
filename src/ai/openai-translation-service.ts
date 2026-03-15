
import { requestUrl } from "obsidian";
import OpenAI from "openai";
import { normalizeOpenAIUrl } from "../utils/ai/url-helper";
import { RegexItem, AstItem } from "../views/plugin_editor/types";
import { ThemeTranslationItem } from "../views/theme_editor/types";
import z from "zod";
import { useGlobalStoreInstance } from "~/utils";
import { estimateBatchTokens, estimateCost } from "../utils/ai/token-estimator";

// 自定义消息类型
interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

// 批次完成回调 (Regex)
type OnBatchComplete = (
    batchResult: RegexItem[],
    batchIndex: number,
    totalBatches: number
) => void | Promise<void>;

// 批次完成回调 (AST)
type OnAstBatchComplete = (
    batchResult: AstItem[],
    batchIndex: number,
    totalBatches: number
) => void | Promise<void>;

// 批次完成回调 (Theme)
type OnThemeBatchComplete = (
    batchResult: ThemeTranslationItem[],
    batchIndex: number,
    totalBatches: number
) => void | Promise<void>;

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

export class OpenAITranslationService {

    constructor() {
    }

    /**
     * 获取 OpenAI 实例 (动态获取最新配置)
     */
    private getOpenAIClient(): OpenAI {
        const settings = useGlobalStoreInstance.getState().i18n.settings;
        const rawBaseURL = normalizeOpenAIUrl(settings.llmOpenaiUrl);
        const baseURL = rawBaseURL ? `${rawBaseURL}/v1` : undefined;

        return new OpenAI({
            baseURL: baseURL,
            apiKey: settings.llmOpenaiKey,
            dangerouslyAllowBrowser: true,
            fetch: async (url, options) => {
                // 转换 Headers 为普通对象，确保 requestUrl 能识别
                const headers: Record<string, string> = {};
                if (options?.headers) {
                    if (options.headers instanceof Headers) {
                        options.headers.forEach((value, key) => {
                            headers[key] = value;
                        });
                    } else if (Array.isArray(options.headers)) {
                        options.headers.forEach(([key, value]) => {
                            headers[key] = value;
                        });
                    } else {
                        Object.assign(headers, options.headers as Record<string, string>);
                    }
                }

                // 创建一个可取消的包装，因为 requestUrl 不支持 signal
                const signal = options?.signal;

                return new Promise((resolve, reject) => {
                    const onAbort = () => {
                        reject(new Error('AbortError'));
                    };

                    if (signal?.aborted) {
                        return onAbort();
                    }

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

    /**
     * 获取并发限制数 (默认为 3，避免触发 API 限制，但仍能提供显著加速)
     */
    private getConcurrencyLimit(): number {
        const settings = useGlobalStoreInstance.getState().i18n.settings;
        return settings.llmConcurrencyLimit || 3;
    }

    /**
     * 通用的并行批处理执行器
     */
    private async executeParallelBatches<T>(
        items: T[],
        callApi: (batch: T[], signal?: AbortSignal) => Promise<T[]>,
        onBatchComplete: (batchResult: T[], batchIndex: number, totalBatches: number) => void | Promise<void>,
        signal?: AbortSignal
    ): Promise<T[]> {
        this.validateInput(items);
        const batches = this.splitIntoBatches(items);
        const totalBatches = batches.length;
        const resultsBuffer: T[][] = new Array(totalBatches);

        const limit = this.getConcurrencyLimit();
        let currentBatchIndex = 0;
        let completedBatchesCount = 0;

        // 并行执行函数
        const runBatch = async () => {
            while (currentBatchIndex < totalBatches) {
                if (signal?.aborted) return;

                const index = currentBatchIndex++;
                const batch = batches[index];

                try {
                    const batchResult = await callApi(batch, signal);
                    completedBatchesCount++;
                    await onBatchComplete(batchResult, completedBatchesCount, totalBatches);

                    resultsBuffer[index] = batchResult;
                } catch (error) {
                    console.error(`Batch ${index + 1} failed:`, error);
                    // 即使失败也需要填充占位，确保整体流程不中断
                    completedBatchesCount++;
                    resultsBuffer[index] = batch.map(item => ({ ...item, target: (item as any).source || '' })) as unknown as T[];
                }
            }
        };

        const workers = Array.from({ length: Math.min(limit, totalBatches) }, () => runBatch());
        await Promise.all(workers);

        if (signal?.aborted) throw new Error('翻译任务已取消');

        // 使用 concat 替代 flat 以获得更好的兼容性
        return ([] as T[]).concat(...resultsBuffer);
    }

    /**
     * 核心翻译流程 (Regex)
     */
    public async regexTranslate(regexItems: RegexItem[], onBatchComplete: OnBatchComplete, signal?: AbortSignal): Promise<RegexItem[]> {
        return this.executeParallelBatches(
            regexItems,
            (batch, sig) => this.callRegexTranslationAPI(batch, sig),
            onBatchComplete,
            signal
        );
    }

    /**
     * 核心翻译流程 (AST)
     */
    public async astTranslate(astItems: AstItem[], onBatchComplete: OnAstBatchComplete, signal?: AbortSignal): Promise<AstItem[]> {
        return this.executeParallelBatches(
            astItems,
            (batch, sig) => this.callAstTranslationAPI(batch, sig),
            onBatchComplete,
            signal
        );
    }

    /**
     * 核心翻译流程 (Theme)
     */
    public async themeTranslate(themeItems: ThemeTranslationItem[], onBatchComplete: OnThemeBatchComplete, signal?: AbortSignal): Promise<ThemeTranslationItem[]> {
        return this.executeParallelBatches(
            themeItems,
            (batch, sig) => this.callThemeTranslationAPI(batch, sig),
            onBatchComplete,
            signal
        );
    }

    /**
     * 验证输入数据
     */
    private validateInput(items: any[]): void {
        if (!Array.isArray(items) || items.length === 0) {
            throw new Error('翻译内容不能为空，且必须为数组格式');
        }
    }

    /**
     * 数组分段工具方法
     */
    private splitIntoBatches<T>(arr: readonly T[]): T[][] {
        if (arr.length === 0) return [];
        const validBatchSize = Number.isFinite(useGlobalStoreInstance.getState().i18n.settings.llmBatchSize)
            ? Math.max(1, Math.floor(useGlobalStoreInstance.getState().i18n.settings.llmBatchSize))
            : 1;
        const batches: T[][] = [];
        for (let i = 0; i < arr.length; i += validBatchSize) batches.push(arr.slice(i, i + validBatchSize));
        return batches;
    }

    /**
     * Regex 专用 API 调用
     */
    private async callRegexTranslationAPI(items: RegexItem[], signal?: AbortSignal): Promise<RegexItem[]> {
        const settings = useGlobalStoreInstance.getState().i18n.settings;
        const language = settings.llmLanguage;
        const style = settings.llmStyle;
        const template = settings.llmRegexPrompt || DEFAULT_REGEX_PROMPT_TEMPLATE;
        const systemPrompt = generateRegexSystemPrompt(template, language, style);

        // 调用 API 翻译项
        const simplifiedItems = items.map(item => ({ i: item.id, s: item.source }));
        const simplifiedResults = await this.callOpenAI(simplifiedItems, systemPrompt, SimplifiedOutputArraySchema, signal);

        // 转换结果
        return items.map(item => {
            const result = (simplifiedResults as any[]).find(r => r.i === item.id);
            const target = result ? result.t : (item.target || item.source);
            return { ...item, target };
        });
    }

    /**
     * AST 专用 API 调用
     */
    private async callAstTranslationAPI(items: AstItem[], signal?: AbortSignal): Promise<AstItem[]> {
        const settings = useGlobalStoreInstance.getState().i18n.settings;
        const language = settings.llmLanguage;
        const style = settings.llmStyle;
        const template = settings.llmAstPrompt || DEFAULT_AST_PROMPT_TEMPLATE;
        const systemPrompt = generateAstSystemPrompt(template, language, style);

        // 调用 API 翻译项
        const simplifiedItems = items.map(item => ({ i: item.id, s: item.source, y: item.type, n: item.name }));
        const simplifiedResults = await this.callOpenAI(simplifiedItems, systemPrompt, SimplifiedOutputArraySchema, signal);

        // 转换结果
        return items.map(item => {
            const result = (simplifiedResults as any[]).find(r => r.i === item.id);
            const target = result ? result.t : (item.target || item.source);
            return { ...item, target };
        });
    }

    /**
     * Theme 专用 API 调用
     */
    private async callThemeTranslationAPI(items: ThemeTranslationItem[], signal?: AbortSignal): Promise<ThemeTranslationItem[]> {
        const settings = useGlobalStoreInstance.getState().i18n.settings;
        const language = settings.llmLanguage;
        const style = settings.llmStyle;
        const template = settings.llmThemePrompt || DEFAULT_THEME_PROMPT_TEMPLATE;
        const systemPrompt = generateThemeSystemPrompt(template, language, style);

        // 调用 API 翻译项
        const simplifiedItems = items.map(item => ({ i: (item as any).id, s: item.source, y: item.type }));
        const simplifiedResults = await this.callOpenAI(simplifiedItems, systemPrompt, SimplifiedOutputArraySchema, signal);

        // 转换结果
        return items.map(item => {
            const result = (simplifiedResults as any[]).find(r => r.i === (item as any).id);
            const target = result ? result.t : (item.target || item.source);
            return { ...item, target };
        });
    }


    /**
     * 根据当前选中的模型估算 Token 数和成本
     */
    public estimateTokens(items: any[], type: 'regex' | 'ast' | 'theme'): { tokens: number, cost: number } {
        const settings = useGlobalStoreInstance.getState().i18n.settings;
        let systemPrompt = "";

        const language = settings.llmLanguage;
        const style = settings.llmStyle;

        if (type === 'regex') {
            const template = settings.llmRegexPrompt || DEFAULT_REGEX_PROMPT_TEMPLATE;
            systemPrompt = generateRegexSystemPrompt(template, language, style);
        } else if (type === 'ast') {
            const template = settings.llmAstPrompt || DEFAULT_AST_PROMPT_TEMPLATE;
            systemPrompt = generateAstSystemPrompt(template, language, style);
        } else if (type === 'theme') {
            const template = settings.llmThemePrompt || DEFAULT_THEME_PROMPT_TEMPLATE;
            systemPrompt = generateThemeSystemPrompt(template, language, style);
        }

        const tokens = estimateBatchTokens(items, systemPrompt);
        const cost = estimateCost(
            tokens,
            settings.llmOpenaiModel || 'gpt-4o-mini',
            settings.llmUseCustomPrice ? settings.llmPriceInputCustom : undefined
        );

        return { tokens, cost };
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
            // 创建一个内部的 AbortController 用于同时处理手动取消和超时
            const timeoutController = new AbortController();
            const timeoutMs = settings.llmTimeout || 60000;
            const timeoutId = setTimeout(() => {
                timeoutController.abort();
            }, timeoutMs);

            // 监听外部 signal 的取消并同步到内部 controller
            const abortHandler = () => timeoutController.abort();
            if (signal) {
                signal.addEventListener('abort', abortHandler);
            }

            try {
                if (signal?.aborted) throw new Error('翻译任务已取消');

                const openai = this.getOpenAIClient();
                const completion = await openai.chat.completions.create({
                    messages: messages as any,
                    model: settings.llmOpenaiModel,
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
        console.error(`[OpenAI API] 批次翻译API调用最终失败，已跳过该批次:`, errorMsg, `\n请求数据：${JSON.stringify(items)}`);

        // 既然最终失败了，我们构造一个与输入一致但未翻译的占位返回
        return items.map(item => ({ ...item, target: item.source || '' }));
    }
}

// =========================================================================================
//                                   Regex 提示词
// =========================================================================================

export const DEFAULT_REGEX_PROMPT_TEMPLATE = `
# Role & Context
You are an expert Software Localization Specialist & Technical Translator.
Your task is to translate extracted text snippets from source code and UI elements into the target language, while keeping all code-level syntax 100% intact.

# Core Output Rules (CRITICAL: Failure will crash the system)
1. ONLY return a valid JSON array string.
   - ❌ NO Markdown formatting (e.g., \`\`\`json).
   - ❌ NO conversational text.
   - ✅ Starts exactly with \`[\` and ends with \`]\`.
2. Array Structure & Integrity
   - Input: Array of objects with \`i\` (ID) and \`s\` (Source).
   - Output: Array of objects with EXACTLY two fields: \`i\` and \`t\` (Target/Translation).
   - The output MUST be an array of objects matching the input length exactly.
   - The \`i\` fields MUST be kept EXACTLY as they are. DO NOT MODIFY OR OMIT THEM.

# Translation & Safety Rules (CRITICAL)
1. Absolute Code Protection (Highest Priority)
   - DO NOT translate any non-natural language syntax. This includes:
     * \`camelCase\` or \`snake_case\` variables
     * Interpolated variables and formatters (e.g., \`\${filename}\`, \`{{val}}\`, \`%s\`, \`{0}\`)
     * HTML/XML tags (e.g., \`<span>\`, \`<br>\`)
     * URLs, file paths, and regex symbols
   - Example: \`Error occurred in \${moduleName}\` -> \`\${moduleName} 中发生错误\` (Variable preserved).
2. Pure Code Key Recognition
   - If the \`s\` string looks entirely like a code key (e.g., \`user_not_found_error\`), DO NOT force a translation. Output it exactly as it is in the \`t\` field.
3. Punctuation & Spacing Alignment
   - Preserve punctuation and spaces exactly.
4. Unicode Encoding Preservation (CRITICAL)
    - If the source string \`s\` is formatted using Unicode escape sequences (e.g., \`\\uXXXX\`), your translated text \`t\` MUST ALSO be converted entirely into Unicode escape sequences.
    - ❌ Never return standard plain text if the source is Unicode-escaped.
    - Example: If \`s\` is \`\u0048\u0065\u006c\u006c\u006f\` ("Hello"), and the translation is "Hola", \`t\` must be \`\u0048\u006f\u006c\u0061\`.

# Translation Requirements
- **Target Language:** {{targetLanguage}}
- **Translation Style:** {{translationStyle}}
- Output must read naturally in the {{targetLanguage}} while adhering strictly to software UI and technical documentation conventions.

{{glossarySection}}

# Quality Checklist (Self-Verify Before Output)
- [ ] Is the output a totally naked JSON array?
- [ ] Does each object ONLY contain \`i\` and \`t\`?
- [ ] Are all \`i\` fields present and unmodified?
- [ ] Are all code variables (\`\${...}\`) completely intact in the \`t\`?
- [ ] If \`s\` used Unicode escapes (\`\\uXXXX\`), is \`t\` correctly encoded as Unicode escapes?
`.trim();

/**
 * 生成 Regex 模式提示词
 */
export function generateRegexSystemPrompt(template: string, targetLanguage: string, translationStyle: string, customGlossary?: Record<string, string>): string {
    const glossarySection = customGlossary ? `
# Exclusive Glossary (CRITICAL)
You MUST strictly follow these translation mappings:
${Object.entries(customGlossary).map(([en, trans]) => `- "${en}" → "${trans}"`).join('\n')}
Under no circumstances should you alter the translation of these terms.`.trim() : '';

    return template.replace(/\{\{targetLanguage\}\}/g, targetLanguage).replace(/\{\{translationStyle\}\}/g, translationStyle).replace(/\{\{glossarySection\}\}/g, glossarySection);
}




// =========================================================================================
//                                     AST 提示词
// =========================================================================================

export const DEFAULT_AST_PROMPT_TEMPLATE = `
# Role & Context
You are an expert Software Localization Specialist & UI Translator.
Your task is to translate abstract syntax tree (AST) text nodes from a user interface into the target language, while keeping all code-level structure and syntax completely intact.

# Core Output Rules (CRITICAL: Failure will crash the system)
1. ONLY return a valid JSON array string.
   - ❌ NO Markdown formatting (e.g., \`\`\`json).
   - ❌ NO conversational text.
   - ✅ Starts exactly with \`[\` and ends with \`]\`.
2. Property Gatekeeper (CRITICAL)
   - Input structure: \`i\` (ID), \`s\` (Source), \`y\` (Type), \`n\` (Name).
   - Output structure: Return objects with EXACTLY two fields: \`i\` and \`t\` (Target/Translation).
   - DO NOT MODIFY \`i\`.
   - The \`y\` (type) and \`n\` (name) fields are for YOUR CONTEXT ONLY. Do not include them in output.

# Translation & Safety Rules (CRITICAL)
1. Absolute Code Protection
   - DO NOT translate any non-natural language syntax (e.g., \`{{count}}\`, \`<span/>\`, \`\\n\`).
2. Context Awareness via y & n Fields
   - Use the \`y\` (node type) and \`n\` (node name) fields to infer context.
   - Example: \`y="Button"\`, \`n="submit"\` -> Translate as an action verb.
3. Pure Code Key Handling
   - If \`s\` is a code key, return it as-is in \`t\`.

# Translation Requirements
- **Target Language:** {{targetLanguage}}
- **Translation Style:** {{translationStyle}}

{{glossarySection}}

# Quality Checklist (Self-Verify Before Output)
- [ ] Is the output a totally naked JSON array?
- [ ] Does each object ONLY contain \`i\` and \`t\`?
- [ ] Are \`i\` fields unaltered?
- [ ] Are code variables/tags intact in \`t\`?
`.trim();

/**
 * 生成 AST 模式提示词
 */
export function generateAstSystemPrompt(template: string, targetLanguage: string, translationStyle: string, customGlossary?: Record<string, string>): string {
    const glossarySection = customGlossary ? `
# Exclusive Glossary (CRITICAL)
You MUST strictly follow these translation mappings:
${Object.entries(customGlossary).map(([en, trans]) => `- "${en}" → "${trans}"`).join('\n')}
Under no circumstances should you alter the translation of these terms.`.trim() : '';

    return template.replace(/\{\{targetLanguage\}\}/g, targetLanguage).replace(/\{\{translationStyle\}\}/g, translationStyle).replace(/\{\{glossarySection\}\}/g, glossarySection);
}



// =========================================================================================
//                                   Theme 提示词
// =========================================================================================

export const DEFAULT_THEME_PROMPT_TEMPLATE = `
# Role & Context
You are an expert CSS Theme Localizer & UI Translator.
Your task is to translate Obsidian theme setting labels and descriptions into the target language.

# Core Output Rules (CRITICAL: Failure will crash the system)
1. ONLY return a valid JSON array string.
   - ❌ NO Markdown formatting (e.g., \`\`\`json).
   - ❌ NO conversational text.
   - ✅ Starts exactly with \`[\` and ends with \`]\`.
2. Property Gatekeeper (CRITICAL)
   - Input structure: \`i\` (ID), \`s\` (Source), \`y\` (Type).
   - Output structure: Return objects with EXACTLY two fields: \`i\` and \`t\` (Target/Translation).
   - DO NOT MODIFY \`i\`.
   - The \`y\` (type) field is for YOUR CONTEXT ONLY. Do not include it in output.

# Translation & Safety Rules (CRITICAL)
1. Context Awareness via y Field
   - \`y\` value tells you if text is a \`name\`, \`title\`, \`description\`, \`label\`, or \`markdown\`.
2. Code Protection
   - DO NOT translate CSS class names or variables.
3. Brevity for UI
   - Keep translations concise for settings UI.
4. Unicode Encoding Preservation (CRITICAL)
   - If the source string \`s\` is formatted using Unicode escape sequences (e.g., \`\\uXXXX\`), your translated text \`t\` MUST ALSO be converted entirely into Unicode escape sequences.
   - ❌ Never return standard plain text if the source is Unicode-escaped.
   - Example: If \`s\` is \`\\u0048\\u0065\\u006c\\u006c\\u006f\` ("Hello"), and the translation is "Hola", \`t\` must be \`\\u0048\\u006f\\u006c\\u0061\`.

# Translation Requirements
- **Target Language:** {{targetLanguage}}
- **Translation Style:** {{translationStyle}}

{{glossarySection}}

# Quality Checklist (Self-Verify Before Output)
- [ ] Is the output a totally naked JSON array?
- [ ] Does each object ONLY contain \`i\` and \`t\`?
- [ ] Are \`i\` fields unaltered?
- [ ] If \`s\` used Unicode escapes (\`\\uXXXX\`), is \`t\` correctly encoded as Unicode escapes?
`.trim();

/**
 * 生成 Theme 模式提示词
 */
export function generateThemeSystemPrompt(template: string, targetLanguage: string, translationStyle: string, customGlossary?: Record<string, string>): string {
    const glossarySection = customGlossary ? `
# Exclusive Glossary (CRITICAL)
You MUST strictly follow these translation mappings:
${Object.entries(customGlossary).map(([en, trans]) => `- "${en}" → "${trans}"`).join('\n')}
Under no circumstances should you alter the translation of these terms.`.trim() : '';

    return template.replace(/\{\{targetLanguage\}\}/g, targetLanguage).replace(/\{\{translationStyle\}\}/g, translationStyle).replace(/\{\{glossarySection\}\}/g, glossarySection);
}








