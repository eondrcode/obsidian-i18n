import { Setting } from "obsidian";
import BaseSetting from "../base-setting";
import { t } from "src/locales";
import { LLM_PROVIDERS } from "src/ai/constants";

export default class I18nLLM extends BaseSetting {
    main(): void {
        new Setting(this.containerEl).setName(t('Settings.Ai.Provider')).setHeading();

        const llmApiSetting = new Setting(this.containerEl);
        llmApiSetting.setName(`${t('Settings.Ai.Provider')} (Provider)`);
        llmApiSetting.setDesc(t('Settings.Ai.ProviderDesc'));
        llmApiSetting.addDropdown((dropdown) => {
            
            const categories = [
                { id: 'international', title: '── 🌍 国际主流 (International) ──' },
                { id: 'domestic', title: '── 🇨🇳 国产大模型 (Domestic) ──' },
                { id: 'aggregated', title: '── 🚀 聚合平台 (Aggregated) ──' },
                { id: 'local', title: '── 🏠 本地部署 (Local) ──' }
            ];

            const providerValues = Object.values(LLM_PROVIDERS);

            categories.forEach(cat => {
                const groups = providerValues.filter(p => p.category === cat.id);
                if (groups.length > 0) {
                    dropdown.addOption(`header-${cat.id}`, cat.title);
                    groups.forEach(p => {
                        dropdown.addOption(p.id, p.name);
                    });
                }
            });

            dropdown.setValue(String(this.settings.llmApi));

            // 禁用分类标题
            const selectEl = dropdown.selectEl;
            if (selectEl) {
                Array.from(selectEl.options).forEach(option => {
                    if (option.value.startsWith('header-')) {
                        option.disabled = true;
                        option.style.backgroundColor = 'var(--background-secondary)';
                        // 重置文字颜色为较暗的颜色，表现 disabled 状态
                        option.style.color = 'var(--text-muted)';
                    }
                });
            }

            dropdown.onChange(async (value) => {
                // 忽略分类标题
                if (value.startsWith('header-')) {
                    dropdown.setValue(String(this.settings.llmApi));
                    return;
                }
                this.settings.llmApi = value;
                await this.i18n.saveSettings();
                this.settingTab.llmDisplay();
            });
        });

        new Setting(this.containerEl).setName(t('Settings.Ai.ConfigHeader')).setHeading();
    }
}