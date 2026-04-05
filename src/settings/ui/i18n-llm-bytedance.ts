import { Setting, Notice } from "obsidian";
import BaseSetting from "../base-setting";
import { t } from "../../locales";
import { ConnectivityTester } from "../../utils/ai/connectivity-tester";
import { DiagnosticModal } from "./diagnostic-modal";

export default class I18nLLMBytedance extends BaseSetting {
    main(): void {
        if (this.settings.llmApi !== 9) return;

        this.configUI();
    }

    private configUI(): void {
        const settings = this.settings;

        new Setting(this.containerEl)
            .setName(t('Settings.Ai.BytedanceKeyTitle'))
            .setDesc(t('Settings.Ai.OpenaiKeyDescTip'))
            .addText(text => {
                text
                    .setValue(settings.llmBytedanceKey || '')
                    .setPlaceholder('sk-...')
                    .onChange(async (value) => {
                        settings.llmBytedanceKey = value.trim();
                        await this.i18n.saveSettings();
                    });
                text.inputEl.setAttribute('type', 'password');
            });

        new Setting(this.containerEl)
            .setName(t('Settings.Ai.ModelTitle'))
            .setDesc(t('Settings.Ai.BytedanceModelDesc'))
            .addDropdown(dropdown => {
                const models = ['doubao-pro-4k', 'doubao-pro-32k', 'doubao-lite-4k'];
                dropdown.addOption('', t('Settings.Ai.ModelSelectPlaceholder'));
                models.forEach(m => dropdown.addOption(m, m));
                dropdown.setValue(settings.llmBytedanceModel);
                dropdown.onChange(async (value) => {
                    if (value) {
                        settings.llmBytedanceModel = value;
                        await this.i18n.saveSettings();
                        const inputEl = this.containerEl.querySelector('.bytedance-model-input input') as HTMLInputElement;
                        if (inputEl) inputEl.value = value;
                    }
                });
            })
            .addText(text => {
                text.inputEl.addClass('bytedance-model-input');
                text.setValue(settings.llmBytedanceModel || '')
                    .setPlaceholder(t('Settings.Ai.ModelInputPlaceholder'))
                    .onChange(async (value) => {
                        settings.llmBytedanceModel = value.trim();
                        await this.i18n.saveSettings();
                    });
            });

        this.testUI();
    }

    private testUI(): void {
        new Setting(this.containerEl).setName(t('Settings.Ai.TestHeader')).setHeading();
        new Setting(this.containerEl)
            .setName(t('Settings.Ai.TestTitle'))
            .setDesc(t('Settings.Ai.TestDesc'))
            .addButton(btn => {
                btn.setButtonText(t('Settings.Ai.TestBtn'))
                    .setCta()
                    .onClick(async () => {
                        const { llmBytedanceKey, llmBytedanceModel } = this.settings;
                        const url = "https://ark.cn-beijing.volces.com/api/v3";
                        if (!llmBytedanceKey) {
                            new Notice(t('Settings.Ai.TestNoticeMissing'));
                            return;
                        }
                        const tester = new ConnectivityTester(
                            url, llmBytedanceKey, llmBytedanceModel,
                            this.settings.llmResponseFormat, this.settings.llmTimeout
                        );
                        try {
                            btn.setDisabled(true).setButtonText(t('Settings.Ai.TestLoading'));
                            const report = await tester.runDeepDiagnostic((msg) => btn.setButtonText(msg));
                            new DiagnosticModal(this.app, report).open();
                            btn.setButtonText(report.overallStatus === 'healthy' ? t('Settings.Ai.TestSuccessBtn') : t('Settings.Ai.TestFail'));
                            setTimeout(() => btn.setButtonText(t('Settings.Ai.TestBtn')), 3000);
                        } catch (error: any) {
                            new Notice(`${t('Settings.Ai.TestFail')}: ${error.message}`);
                            btn.setButtonText(t('Settings.Ai.TestFail'));
                        } finally {
                            btn.setDisabled(false);
                        }
                    });
            });
    }
}
