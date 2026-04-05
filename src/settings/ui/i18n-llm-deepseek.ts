import { Setting, Notice } from "obsidian";
import BaseSetting from "../base-setting";
import { t } from "src/locales";
import { ConnectivityTester } from "src/utils/ai/connectivity-tester";
import { DiagnosticModal } from "./diagnostic-modal";

export default class I18nLLMDeepSeek extends BaseSetting {
    main(): void {
        if (this.settings.llmApi !== 4) return;

        this.configUI();
    }

    private configUI(): void {
        const settings = this.settings;

        // API Key
        new Setting(this.containerEl)
            .setName(t('Settings.Ai.DeepseekKeyTitle'))
            .setDesc(t('Settings.Ai.OpenaiKeyDescTip'))
            .addText(text => {
                text
                    .setValue(settings.llmDeepseekKey || '')
                    .setPlaceholder('sk-...')
                    .onChange(async (value) => {
                        settings.llmDeepseekKey = value.trim();
                        await this.i18n.saveSettings();
                    });
                text.inputEl.setAttribute('type', 'password');
            });

        // Model
        new Setting(this.containerEl)
            .setName(t('Settings.Ai.ModelTitle'))
            .setDesc(t('Settings.Ai.DeepseekModelDesc'))
            .addDropdown(dropdown => {
                const models = ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'];
                dropdown.addOption('', t('Settings.Ai.ModelSelectPlaceholder'));
                models.forEach(m => dropdown.addOption(m, m));
                dropdown.setValue(settings.llmDeepseekModel);
                dropdown.onChange(async (value) => {
                    if (value) {
                        settings.llmDeepseekModel = value;
                        await this.i18n.saveSettings();
                        const inputEl = this.containerEl.querySelector('.deepseek-model-input input') as HTMLInputElement;
                        if (inputEl) inputEl.value = value;
                    }
                });
            })
            .addText(text => {
                text.inputEl.addClass('deepseek-model-input');
                text.setValue(settings.llmDeepseekModel || '')
                    .setPlaceholder(t('Settings.Ai.ModelInputPlaceholder'))
                    .onChange(async (value) => {
                        settings.llmDeepseekModel = value.trim();
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
                        const { llmDeepseekKey, llmDeepseekModel } = this.settings;
                        const url = "https://api.deepseek.com/v1";

                        if (!llmDeepseekKey) {
                            new Notice(t('Settings.Ai.TestNoticeMissing'));
                            return;
                        }

                        const tester = new ConnectivityTester(
                            url, llmDeepseekKey, llmDeepseekModel,
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
