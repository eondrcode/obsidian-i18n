import { Setting } from "obsidian";
import BaseSetting from "../base-setting";
import { t } from "src/locales";

export const apiType = {
    1: 'OpenAI',
    2: 'Gemini',
    3: 'Ollama',
    4: 'DeepSeek',
    5: '智谱 AI (GLM)',
    6: '月之暗面 (Kimi)',
    7: '通义千问 (Aliyun)',
    8: '百度千帆 (ERNIE)',
    9: '字节跳动 (豆包)',
    10: 'Groq (极速)',
    11: 'SiliconFlow (硅基流动)',
    12: 'OpenRouter (聚合全球)',
    13: 'DeepInfra',
    14: 'Mistral AI',
    15: 'MiniMax (海螺 AI)',
    16: '阶跃星辰 (StepFun)'
}

// 自动更新
export default class I18nLLM extends BaseSetting {
    main(): void {
        new Setting(this.containerEl).setName(t('Settings.Ai.Provider')).setHeading();

        const llmApiSetting = new Setting(this.containerEl);
        llmApiSetting.setName(`${t('Settings.Ai.Provider')} (Provider)`);
        llmApiSetting.setDesc(t('Settings.Ai.ProviderDesc'));
        llmApiSetting.addDropdown((dropdown) => {
            // --- 🌍 国际主流 (International) ---
            dropdown.addOption('header-international', '── 🌍 国际主流 (International) ──');
            dropdown.addOption('1', 'OpenAI');
            dropdown.addOption('2', 'Gemini');
            dropdown.addOption('14', 'Mistral AI');
            dropdown.addOption('10', 'Groq');

            // --- 🇨🇳 国产大模型 (Domestic) ---
            dropdown.addOption('header-domestic', '── 🇨🇳 国产大模型 (Domestic) ──');
            dropdown.addOption('4', 'DeepSeek');
            dropdown.addOption('5', '智谱 AI (GLM)');
            dropdown.addOption('6', '月之暗面 (Kimi)');
            dropdown.addOption('7', '通义千问 (Aliyun)');
            dropdown.addOption('8', '百度千帆 (ERNIE)');
            dropdown.addOption('9', '字节跳动 (豆包)');
            dropdown.addOption('15', 'MiniMax (海螺 AI)');
            dropdown.addOption('16', '阶跃星辰 (StepFun)');

            // --- 🚀 聚合平台 (Aggregated) ---
            dropdown.addOption('header-aggregated', '── 🚀 聚合平台 (Aggregated) ──');
            dropdown.addOption('11', 'SiliconFlow (硅基流动)');
            dropdown.addOption('12', 'OpenRouter (聚合全球)');
            dropdown.addOption('13', 'DeepInfra (高性价比)');

            // --- 🏠 本地部署 (Local) ---
            dropdown.addOption('header-local', '── 🏠 本地部署 (Local) ──');
            dropdown.addOption('3', 'Ollama');

            dropdown.setValue(String(this.settings.llmApi));
            dropdown.onChange(async (value) => {
                // 忽略分类标题
                if (value.startsWith('header-')) {
                    dropdown.setValue(String(this.settings.llmApi));
                    return;
                }
                this.settings.llmApi = Number(value);
                await this.i18n.saveSettings();
                this.settingTab.llmDisplay();
            });
        });

        new Setting(this.containerEl).setName(t('Settings.Ai.ConfigHeader')).setHeading();
    }
}