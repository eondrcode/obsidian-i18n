/**
 * 翻译 Provider 工厂
 * 
 * 根据当前用户设置中选择的 LLM 服务商，创建对应的 Provider 实例。
 * 消费方（编辑器 Hook）统一通过此工厂获取 Provider，无需关心具体实现。
 */

import { useGlobalStoreInstance } from '~/utils';
import { ITranslationProvider } from './provider-types';
import { OpenAITranslationService } from './openai-translation-service';
import { GeminiTranslationService } from './gemini-translation-service';
import { OllamaTranslationService } from './ollama-translation-service';
import { LLM_PROVIDERS } from './constants';

/**
 * 创建当前配置对应的翻译 Provider 实例
 */
export function createTranslationProvider(): ITranslationProvider {
    const settings = useGlobalStoreInstance.getState().i18n.settings;
    const config = LLM_PROVIDERS[settings.llmApi as string];

    if (!config) return new OpenAITranslationService(); // 兜底

    switch (config.engine) {
        case 'gemini':
            return new GeminiTranslationService();
        case 'ollama':
            return new OllamaTranslationService();
        case 'openai':
        default:
            return new OpenAITranslationService();
    }
}
