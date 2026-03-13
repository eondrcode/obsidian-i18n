import { Setting } from "obsidian";
import BaseSetting from "../base-setting";
import { t } from "src/locales";

export const apiType = {
	1: 'OpenAI'
}

// 自动更新
export default class I18nLLM extends BaseSetting {
	main(): void {
		new Setting(this.containerEl).setName(t('Settings.Ai.Provider')).setHeading();

		const llmApiDropdown = new Setting(this.containerEl);
		llmApiDropdown.setName(`${t('Settings.Ai.Provider')} (Provider)`);
		llmApiDropdown.setDesc(t('Settings.Ai.ProviderDesc'));
		llmApiDropdown.addDropdown((cb) => cb
			.addOptions(apiType)
			.setValue(String(this.settings.llmApi))
			.onChange(async (value) => {
				this.settings.llmApi = Number(value);;
				await this.i18n.saveSettings();
				this.settingTab.llmDisplay();
			})
		);
		new Setting(this.containerEl).setName(t('Settings.Ai.ConfigHeader')).setHeading();

	}
}