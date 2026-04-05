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

/**
 * 创建当前配置对应的翻译 Provider 实例
 */
export function createTranslationProvider(): ITranslationProvider {
    const settings = useGlobalStoreInstance.getState().i18n.settings;

    switch (settings.llmApi) {
        case 1:
        case 4:
        case 5:
        case 6:
        case 7:
        case 8:
        case 9:
        case 10:
        case 11:
            return new OpenAITranslationService();
        case 2:
            return new GeminiTranslationService();
        case 3:
            return new OllamaTranslationService();
        default:
            return new OpenAITranslationService();
    }
}
