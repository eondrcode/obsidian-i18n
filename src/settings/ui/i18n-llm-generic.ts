import { Setting, Notice } from "obsidian";
import BaseSetting from "../base-setting";
import { t } from "src/locales";
import { ConnectivityTester } from "src/utils/ai/connectivity-tester";
import { DiagnosticModal } from "./diagnostic-modal";
import { LLM_PROVIDERS, LLMProviderConfig } from "../../ai/constants";
import { I18nSettings, LLMProfile } from "../data";
import { OllamaTranslationService, OLLAMA_DEFAULT_URL } from "src/ai/ollama-translation-service";

export default class I18nLLMGeneric extends BaseSetting {
    private config: LLMProviderConfig;

    main(): void {
        const providerId = this.settings.llmApi;
        this.config = LLM_PROVIDERS[providerId];

        if (!this.config) return;

        this.profileUI();
        this.configUI();
        
        // OpenAI 专属配置：响应格式
        if (providerId === 1) {
            this.openaiSpecialUI();
        }

        this.priceUI();
        this.testUI();
        this.promptUI();
    }

    private get activeProfile(): LLMProfile | undefined {
        const profilesField = `llm${this.config.labelKey}Profiles` as keyof I18nSettings;
        const activeIdField = `llm${this.config.labelKey}ActiveProfileId` as keyof I18nSettings;
        const profiles = this.settings[profilesField] as LLMProfile[];
        const activeId = this.settings[activeIdField] as string;
        return profiles?.find(p => p.id === activeId) || profiles?.[0];
    }

    private profileUI(): void {
        const profilesField = `llm${this.config.labelKey}Profiles` as keyof I18nSettings;
        const activeIdField = `llm${this.config.labelKey}ActiveProfileId` as keyof I18nSettings;
        let profiles = this.settings[profilesField] as LLMProfile[];
        let activeId = this.settings[activeIdField] as string;

        // 确保至少有一个默认方案
        if (!profiles || profiles.length === 0) {
            profiles = [{
                id: 'default',
                name: 'Default',
                url: this.config.baseUrl || '',
                key: '',
                model: this.config.defaultModel,
                useCustomPrice: false,
                priceInput: 0,
                priceOutput: 0
            }];
            (this.settings as any)[profilesField] = profiles;
            (this.settings as any)[activeIdField] = 'default';
        }

        const container = this.containerEl;

        // 方案选择下拉框
        const profileSetting = new Setting(container)
            .setName(t('Settings.Ai.ProfileSelectTitle'))
            .setDesc(t('Settings.Ai.ProfileSelectDesc'))
            .addDropdown(dropdown => {
                profiles.forEach(p => dropdown.addOption(p.id, p.name));
                dropdown.setValue(activeId);
                dropdown.onChange(async (value) => {
                    (this.settings as any)[activeIdField] = value;
                    await this.i18n.saveSettings();
                    this.settingTab.llmDisplay();
                });
            });

        // 管理按钮
        profileSetting.addExtraButton(btn => {
            btn.setIcon('plus')
                .setTooltip(t('Settings.Ai.ProfileAddBtn'))
                .onClick(async () => {
                    const newId = Date.now().toString();
                    profiles.push({
                        id: newId,
                        name: `${t('Settings.Ai.ProfileNamePlaceholder')} ${profiles.length + 1}`,
                        url: this.config.baseUrl || '',
                        key: '',
                        model: this.config.defaultModel,
                        useCustomPrice: false,
                        priceInput: 0,
                        priceOutput: 0
                    });
                    (this.settings as any)[activeIdField] = newId;
                    await this.i18n.saveSettings();
                    this.settingTab.llmDisplay();
                });
        });

        const activeProfile = this.activeProfile;
        if (activeProfile) {
            profileSetting.addExtraButton(btn => {
                btn.setIcon('pencil')
                    .setTooltip(t('Settings.Ai.ProfileRenameBtn'))
                    .onClick(() => {
                        const renameSetting = new Setting(container)
                            .setName(t('Settings.Ai.ProfileRenameNotice'))
                            .addText(text => {
                                text.setValue(activeProfile.name)
                                    .onChange(async (val) => {
                                        activeProfile.name = val.trim();
                                        await this.i18n.saveSettings();
                                    });
                                text.inputEl.addEventListener('blur', () => this.settingTab.llmDisplay());
                            });
                        renameSetting.controlEl.querySelector('input')?.focus();
                    });
            });

            if (profiles.length > 1) {
                profileSetting.addExtraButton(btn => {
                    btn.setIcon('trash')
                        .setTooltip(t('Settings.Ai.ProfileDelBtn'))
                        .onClick(async () => {
                            if (confirm(t('Settings.Ai.ProfileDelConfirm'))) {
                                const index = profiles.findIndex(p => p.id === activeProfile.id);
                                profiles.splice(index, 1);
                                (this.settings as any)[activeIdField] = profiles[0].id;
                                await this.i18n.saveSettings();
                                this.settingTab.llmDisplay();
                            }
                        });
                });
            }
        }
    }

    private configUI(): void {
        const activeProfile = this.activeProfile;
        if (!activeProfile) return;

        const { labelKey, models, defaultModel, id: providerId } = this.config;

        // Base URL
        new Setting(this.containerEl)
            .setName(providerId === 3 ? t('Settings.Ai.OllamaUrlTitle') : t('Settings.Ai.OpenaiUrlTitle'))
            .setDesc(providerId === 3 ? t('Settings.Ai.OllamaUrlDesc') : t('Settings.Ai.OpenaiUrlDesc'))
            .addText(text => {
                text.setValue(activeProfile.url || this.config.baseUrl || '')
                    .setPlaceholder(this.config.baseUrl || 'https://...')
                    .onChange(async (val) => {
                        activeProfile.url = val.trim();
                        await this.i18n.saveSettings();
                    });
            });

        // API Key (Ollama 3 通常不需要 Key)
        if (providerId !== 3) {
            new Setting(this.containerEl)
                .setName(t(`Settings.Ai.${labelKey}KeyTitle` as any) || `${this.config.name} API Key`)
                .setDesc(t('Settings.Ai.OpenaiKeyDescTip'))
                .addText(text => {
                    text.setValue(activeProfile.key || '')
                        .setPlaceholder('sk-...')
                        .onChange(async (value) => {
                            activeProfile.key = value.trim();
                            await this.i18n.saveSettings();
                        });
                    text.inputEl.setAttribute('type', 'password');
                });
        }

        // 官网链接
        if (this.config.homepage) {
            new Setting(this.containerEl)
                .setName(t('Settings.Ai.HomepageBtn'))
                .setDesc(this.config.homepage)
                .addButton(btn => {
                    btn.setButtonText(t('Settings.Ai.HomepageBtn'))
                        .onClick(() => window.open(this.config.homepage));
                });
        }

        // Model
        const modelSetting = new Setting(this.containerEl)
            .setName(t('Settings.Ai.ModelTitle'))
            .setDesc(providerId === 3 ? t('Settings.Ai.OllamaModelDesc') : (t(`Settings.Ai.${labelKey}ModelDesc` as any) || t('Settings.Ai.ModelDesc')));

        // Ollama 特有：刷新模型列表
        if (providerId === 3) {
            modelSetting.addButton(btn => {
                btn.setIcon('refresh-cw')
                    .setTooltip(t('Settings.Ai.OllamaFetchModelsBtn'))
                    .onClick(async () => {
                        btn.setDisabled(true);
                        try {
                            const fetchedModels = await OllamaTranslationService.fetchModels(activeProfile.url || OLLAMA_DEFAULT_URL);
                            if (fetchedModels.length === 0) {
                                new Notice(t('Settings.Ai.OllamaNoModels'));
                            } else {
                                new Notice(t('Settings.Ai.OllamaModelsLoaded', { count: fetchedModels.length }));
                                this.settingTab.llmDisplay();
                            }
                        } catch {
                            new Notice(t('Settings.Ai.OllamaFetchFailed'));
                        } finally {
                            btn.setDisabled(false);
                        }
                    });
            });
        }

        modelSetting.addDropdown(async dropdown => {
            dropdown.addOption('', t('Settings.Ai.ModelSelectPlaceholder'));
            
            let finalModels = models;
            if (providerId === 3) {
                try {
                    finalModels = await OllamaTranslationService.fetchModels(activeProfile.url || OLLAMA_DEFAULT_URL);
                } catch { /* ignore */ }
            }
            
            finalModels.forEach(m => dropdown.addOption(m, m));
            dropdown.setValue(activeProfile.model);
            dropdown.onChange(async (value) => {
                if (value) {
                    activeProfile.model = value;
                    await this.i18n.saveSettings();
                    this.settingTab.llmDisplay();
                }
            });
        });

        modelSetting.addText(text => {
            text.setValue(activeProfile.model || defaultModel)
                .setPlaceholder(providerId === 3 ? t('Settings.Ai.OllamaModelPlaceholder') : t('Settings.Ai.ModelInputPlaceholder'))
                .onChange(async (value) => {
                    activeProfile.model = value.trim();
                    await this.i18n.saveSettings();
                });
        });
    }

    private openaiSpecialUI(): void {
        new Setting(this.containerEl)
            .setName(t('Settings.Ai.ResponseFormatTitle'))
            .setDesc(t('Settings.Ai.ResponseFormatDesc'))
            .addDropdown(dropdown => {
                dropdown
                    .addOption('text', t('Settings.Ai.ResponseFormatText'))
                    .addOption('json_object', t('Settings.Ai.ResponseFormatJsonObject'))
                    .addOption('json_schema', t('Settings.Ai.ResponseFormatJsonSchema'))
                    .setValue(this.settings.llmResponseFormat)
                    .onChange(async (value) => {
                        this.settings.llmResponseFormat = value;
                        await this.i18n.saveSettings();
                    });
            });
    }

    private priceUI(): void {
        const activeProfile = this.activeProfile;
        if (!activeProfile) return;

        new Setting(this.containerEl).setName(t('Settings.Ai.PriceHeader')).setHeading();

        new Setting(this.containerEl)
            .setName(t('Settings.Ai.CustomPriceTitle'))
            .setDesc(t('Settings.Ai.CustomPriceDesc'))
            .addToggle(toggle => {
                toggle.setValue(activeProfile.useCustomPrice)
                    .onChange(async (val) => {
                        activeProfile.useCustomPrice = val;
                        await this.i18n.saveSettings();
                        this.settingTab.llmDisplay();
                    });
            });

        if (activeProfile.useCustomPrice) {
            new Setting(this.containerEl)
                .setName(t('Settings.Ai.PriceInputTitle'))
                .setDesc(t('Settings.Ai.PriceInputDesc'))
                .addText(text => {
                    text.setValue(activeProfile.priceInput?.toString() || '0')
                        .onChange(async (val) => {
                            activeProfile.priceInput = parseFloat(val) || 0;
                            await this.i18n.saveSettings();
                        });
                });

            new Setting(this.containerEl)
                .setName(t('Settings.Ai.PriceOutputTitle'))
                .setDesc(t('Settings.Ai.PriceOutputDesc'))
                .addText(text => {
                    text.setValue(activeProfile.priceOutput?.toString() || '0')
                        .onChange(async (val) => {
                            activeProfile.priceOutput = parseFloat(val) || 0;
                            await this.i18n.saveSettings();
                        });
                });
        }
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
                        const activeProfile = this.activeProfile;
                        if (!activeProfile) return;

                        const isOllama = this.config.id === 3;
                        if (!isOllama && !activeProfile.key) {
                            new Notice(t('Settings.Ai.TestNoticeMissing'));
                            return;
                        }

                        const tester = new ConnectivityTester(
                            activeProfile.url || this.config.baseUrl || '',
                            activeProfile.key,
                            activeProfile.model || this.config.defaultModel,
                            this.settings.llmResponseFormat,
                            this.settings.llmTimeout
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

    private promptUI(): void {
        new Setting(this.containerEl).setName(t('Settings.Ai.PromptHeader')).setHeading();

        const prompts = [
            { id: 'llmRegexPrompt', name: t('Settings.Ai.RegexPromptTitle'), desc: t('Settings.Ai.RegexPromptDesc'), placeholder: t('Settings.Ai.RegexPromptPlaceholder') },
            { id: 'llmAstPrompt', name: t('Settings.Ai.AstPromptTitle'), desc: t('Settings.Ai.AstPromptDesc'), placeholder: t('Settings.Ai.AstPromptPlaceholder') },
            { id: 'llmThemePrompt', name: t('Settings.Ai.ThemePromptTitle'), desc: t('Settings.Ai.ThemePromptDesc'), placeholder: t('Settings.Ai.ThemePromptPlaceholder') }
        ];

        prompts.forEach(p => {
            new Setting(this.containerEl)
                .setName(p.name)
                .setDesc(p.desc)
                .addTextArea(text => {
                    text.setValue((this.settings as any)[p.id] || '')
                        .setPlaceholder(p.placeholder)
                        .onChange(async (val) => {
                            (this.settings as any)[p.id] = val;
                            await this.i18n.saveSettings();
                        });
                    text.inputEl.rows = 8;
                    text.inputEl.style.width = '100%';
                });
        });
    }
}
