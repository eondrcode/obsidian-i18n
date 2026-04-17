/**
 * LLM 翻译 Provider 基类
 * 
 * 提取自 OpenAITranslationService 的通用逻辑：
 * - 并行批处理执行器
 * - 分段工具
 * - 输入校验
 * - Prompt 生成
 */

import { useGlobalStoreInstance } from '~/utils';
import { ITranslationProvider, OnRegexBatchComplete, OnAstBatchComplete, OnThemeBatchComplete } from './provider-types';
import { RegexItem, AstItem } from '../views/plugin_editor/types';
import { ThemeTranslationItem } from '../views/theme_editor/types';
import { parseTranslationResponse } from '../utils/ai/response-parser';
import { LLM_PROVIDERS } from './constants';
import { estimateBatchTokens, estimateCost } from '../utils/ai/token-estimator';
import {
    DEFAULT_REGEX_PROMPT_TEMPLATE, generateRegexSystemPrompt,
    DEFAULT_AST_PROMPT_TEMPLATE, generateAstSystemPrompt,
    DEFAULT_THEME_PROMPT_TEMPLATE, generateThemeSystemPrompt,
    generateFixSystemPrompt,
} from './prompts';

export abstract class BaseProvider implements ITranslationProvider {

    // ======================== 抽象方法（子类必须实现） ========================

    /** 子类实现：调用具体 API 翻译一个批次的 Regex 项 */
    protected abstract callRegexTranslationAPI(items: RegexItem[], signal?: AbortSignal): Promise<RegexItem[]>;

    /** 子类实现：调用具体 API 翻译一个批次的 AST 项 */
    protected abstract callAstTranslationAPI(items: AstItem[], signal?: AbortSignal): Promise<AstItem[]>;

    /** 子类实现：调用具体 API 翻译一个批次的 Theme 项 */
    protected abstract callThemeTranslationAPI(items: ThemeTranslationItem[], signal?: AbortSignal): Promise<ThemeTranslationItem[]>;

    // ======================== 公共接口 ========================

    /**
     * 获取当前服务商对应的激活方案 (Active Profile)
     */
    protected getActiveProfile(): any {
        const settings = useGlobalStoreInstance.getState().i18n.settings;
        const providerId = settings.llmApi;
        const config = LLM_PROVIDERS[providerId];
        if (!config) return null;

        const profilesField = `llm${config.labelKey}Profiles`;
        const activeIdField = `llm${config.labelKey}ActiveProfileId`;

        const profiles = (settings as any)[profilesField] as any[];
        const activeId = (settings as any)[activeIdField] as string;

        return profiles?.find((p: any) => p.id === activeId) || profiles?.[0];
    }

    public async regexTranslate(items: RegexItem[], onBatchComplete: OnRegexBatchComplete, signal?: AbortSignal): Promise<RegexItem[]> {
        return this.executeParallelBatches(
            items,
            (batch, sig) => this.callRegexTranslationAPI(batch, sig),
            onBatchComplete,
            signal
        );
    }

    public async astTranslate(items: AstItem[], onBatchComplete: OnAstBatchComplete, signal?: AbortSignal): Promise<AstItem[]> {
        return this.executeParallelBatches(
            items,
            (batch, sig) => this.callAstTranslationAPI(batch, sig),
            onBatchComplete,
            signal
        );
    }

    public async themeTranslate(items: ThemeTranslationItem[], onBatchComplete: OnThemeBatchComplete, signal?: AbortSignal): Promise<ThemeTranslationItem[]> {
        return this.executeParallelBatches(
            items,
            (batch, sig) => this.callThemeTranslationAPI(batch, sig),
            onBatchComplete,
            signal
        );
    }

    public estimateTokens(items: any[], type: 'regex' | 'ast' | 'theme'): { tokens: number; cost: number } {
        const settings = useGlobalStoreInstance.getState().i18n.settings;
        let systemPrompt = '';

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

        // 获取当前活跃方案的计费配置
        const activeProfile = this.getActiveProfile();
        const useCustomPrice = activeProfile?.useCustomPrice ?? settings.llmUseCustomPrice;
        const customPrice = activeProfile?.priceInput ?? settings.llmPriceInputCustom;

        const cost = estimateCost(
            tokens,
            this.getModelName(),
            useCustomPrice ? customPrice : undefined
        );

        return { tokens, cost };
    }

    // ======================== 辅助方法（子类可覆写） ========================


    /** 获取当前使用的模型名称（子类可覆写） */
    protected getModelName(): string {
        const activeProfile = this.getActiveProfile();
        if (activeProfile?.model) return activeProfile.model;

        const settings = useGlobalStoreInstance.getState().i18n.settings;
        const config = LLM_PROVIDERS[settings.llmApi];
        return (settings as any)[config?.modelField] || config?.defaultModel || 'gpt-4o-mini';
    }

    /** 获取并发限制数 */
    protected getConcurrencyLimit(): number {
        return useGlobalStoreInstance.getState().i18n.settings.llmConcurrencyLimit || 3;
    }

    /** 获取超时时间 */
    protected getTimeout(): number {
        return useGlobalStoreInstance.getState().i18n.settings.llmTimeout || 60000;
    }

    // ======================== 内部工具方法 ========================

    /** 验证输入数据 */
    protected validateInput(items: any[]): void {
        if (!Array.isArray(items) || items.length === 0) {
            throw new Error('翻译内容不能为空，且必须为数组格式');
        }
    }

    /** 数组分段工具方法 */
    protected splitIntoBatches<T>(arr: readonly T[]): T[][] {
        if (arr.length === 0) return [];
        const validBatchSize = Number.isFinite(useGlobalStoreInstance.getState().i18n.settings.llmBatchSize)
            ? Math.max(1, Math.floor(useGlobalStoreInstance.getState().i18n.settings.llmBatchSize))
            : 1;
        const batches: T[][] = [];
        for (let i = 0; i < arr.length; i += validBatchSize) batches.push(arr.slice(i, i + validBatchSize));
        return batches;
    }

    /** 通用的并行批处理执行器 */
    protected async executeParallelBatches<T>(
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
                    if ((error as Error).message !== '翻译任务已取消') {
                        console.error(`Batch ${index + 1} failed:`, error);
                        useGlobalStoreInstance.getState().i18n.notice.error(`AI翻译批次 ${index + 1} 失败: ${(error as Error).message}`);
                    }
                    completedBatchesCount++;
                    resultsBuffer[index] = batch.map(item => ({ ...item, target: (item as any).source || '' })) as unknown as T[];
                }
            }
        };

        const workers = Array.from({ length: Math.min(limit, totalBatches) }, () => runBatch());
        await Promise.all(workers);

        if (signal?.aborted) throw new Error('翻译任务已取消');

        return ([] as T[]).concat(...resultsBuffer);
    }

    // ======================== Prompt 工具 ========================

    /** 生成 Regex System Prompt */
    protected getRegexSystemPrompt(): string {
        const settings = useGlobalStoreInstance.getState().i18n.settings;
        const template = settings.llmRegexPrompt || DEFAULT_REGEX_PROMPT_TEMPLATE;
        return generateRegexSystemPrompt(template, settings.llmLanguage, settings.llmStyle);
    }

    /** 生成 AST System Prompt */
    protected getAstSystemPrompt(): string {
        const settings = useGlobalStoreInstance.getState().i18n.settings;
        const template = settings.llmAstPrompt || DEFAULT_AST_PROMPT_TEMPLATE;
        return generateAstSystemPrompt(template, settings.llmLanguage, settings.llmStyle);
    }

    /** 生成 Theme System Prompt */
    protected getThemeSystemPrompt(): string {
        const settings = useGlobalStoreInstance.getState().i18n.settings;
        const template = settings.llmThemePrompt || DEFAULT_THEME_PROMPT_TEMPLATE;
        return generateThemeSystemPrompt(template, settings.llmLanguage, settings.llmStyle);
    }

    // ======================== 统一响应解析 ========================

    /**
     * 统一解析 LLM 返回的文本内容，提取翻译结果数组。
     *
     * 处理管线：
     * 1. 剥离 Markdown 代码块包裹
     * 2. 清除控制字符后 JSON.parse
     * 3. 智能数组提取（兼容各种模型/服务商的返回格式）
     * 4. 结构校验（确保每项包含 i 和 t 字段）
     *
     * @param content LLM 返回的原始字符串
     * @returns 符合 { i: number, t: string } 结构的数组
     */
    protected parseResponseContent(content: string): Array<{ i: number; t: string }> {
        return parseTranslationResponse(content);
    }

    // ======================== 结果映射 ========================

    /** 将 AI 返回的简化结果映射回完整的翻译项 */
    protected mapResultsBack<T extends { id: number; source: string; target: string }>(
        items: T[],
        simplifiedResults: Array<{ i: number; t: string }>
    ): T[] {
        return items.map(item => {
            const result = simplifiedResults.find(r => r.i === item.id);
            let target = result ? result.t : undefined;
            if (!target || target.trim() === '' || target.trim() === '空') {
                target = item.target || item.source;
            }
            return { ...item, target };
        });
    }

    // ======================== Fix (修复) 功能 ========================

    /** 子类可覆写：调用具体 API 修复单条翻译 */
    protected async callFixAPI(source: string, target: string, errorMessage: string, systemPrompt: string, signal?: AbortSignal): Promise<string> {
        // 默认实现：抛出未实现异常，子类应覆写
        throw new Error('fixTranslation is not implemented for this provider');
    }

    /** 生成 Fix System Prompt */
    protected getFixSystemPrompt(): string {
        const settings = useGlobalStoreInstance.getState().i18n.settings;
        return generateFixSystemPrompt(settings.llmLanguage);
    }

    /**
     * 修复单条翻译 (公共接口实现)
     */
    public async fixTranslation(source: string, target: string, errorMessage: string): Promise<string> {
        const systemPrompt = this.getFixSystemPrompt();
        return this.callFixAPI(source, target, errorMessage, systemPrompt);
    }
}
