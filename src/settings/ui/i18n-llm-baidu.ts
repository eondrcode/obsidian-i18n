import { Setting, Notice } from "obsidian";
import BaseSetting from "../base-setting";
import { t } from "src/locales";
import { ConnectivityTester } from "src/utils/ai/connectivity-tester";
import { DiagnosticModal } from "./diagnostic-modal";

export default class I18nLLMBaidu extends BaseSetting {
    main(): void {
        if (this.settings.llmApi !== 8) return;

        this.configUI();
    }

    private configUI(): void {
        const settings = this.settings;

        new Setting(this.containerEl)
            .setName(t('Settings.Ai.BaiduKeyTitle'))
            .setDesc(t('Settings.Ai.OpenaiKeyDescTip'))
            .addText(text => {
                text
                    .setValue(settings.llmBaiduKey || '')
                    .setPlaceholder('sk-...')
                    .onChange(async (value) => {
                        settings.llmBaiduKey = value.trim();
                        await this.i18n.saveSettings();
                    });
                text.inputEl.setAttribute('type', 'password');
            });

        new Setting(this.containerEl)
            .setName(t('Settings.Ai.ModelTitle'))
            .setDesc(t('Settings.Ai.BaiduModelDesc'))
            .addDropdown(dropdown => {
                const models = ['ernie-4.0-8k-preview', 'ernie-4.0-8k-latest', 'ernie-3.5-8k', 'ernie-speed-128k'];
                dropdown.addOption('', t('Settings.Ai.ModelSelectPlaceholder'));
                models.forEach(m => dropdown.addOption(m, m));
                dropdown.setValue(settings.llmBaiduModel);
                dropdown.onChange(async (value) => {
                    if (value) {
                        settings.llmBaiduModel = value;
                        await this.i18n.saveSettings();
                        const inputEl = this.containerEl.querySelector('.baidu-model-input input') as HTMLInputElement;
                        if (inputEl) inputEl.value = value;
                    }
                });
            })
            .addText(text => {
                text.inputEl.addClass('baidu-model-input');
                text.setValue(settings.llmBaiduModel || '')
                    .setPlaceholder(t('Settings.Ai.ModelInputPlaceholder'))
                    .onChange(async (value) => {
                        settings.llmBaiduModel = value.trim();
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
                        const { llmBaiduKey, llmBaiduModel } = this.settings;
                        const url = "https://qianfan.baidubce.com/v2";
                        if (!llmBaiduKey) {
                            new Notice(t('Settings.Ai.TestNoticeMissing'));
                            return;
                        }
                        const tester = new ConnectivityTester(
                            url, llmBaiduKey, llmBaiduModel,
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
