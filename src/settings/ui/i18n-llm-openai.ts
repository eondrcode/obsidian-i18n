import { Setting, Notice } from "obsidian";
import BaseSetting from "../base-setting";
import OpenAI from "openai"; // 确保已安装：npm install openai
import { t } from "src/locales";
import { ConnectivityTester } from "src/utils/ai/connectivity-tester";
import { DiagnosticModal } from "./diagnostic-modal";

export default class I18nLLMOpenAI extends BaseSetting {
    main(): void {
        // 仅当接口服务为OpenAI时显示
        if (this.settings.llmApi !== 1) return;

        this.profileUI();
        this.configUI();
    }

    private refreshUI(): void {
        this.settingTab.llmDisplay();
    }

    private profileUI(): void {
        // OpenAI 方案管理 (Profile)
        const profileHeader = new Setting(this.containerEl)
            .setName(t('Settings.Ai.ProfileSelectTitle'))
            .setDesc(t('Settings.Ai.ProfileSelectDesc'));

        profileHeader.addDropdown(dropdown => {
            this.settings.llmOpenaiProfiles.forEach(p => {
                dropdown.addOption(p.id, p.name);
            });
            dropdown.setValue(this.settings.llmOpenaiActiveProfileId);
            dropdown.onChange(async (value) => {
                this.settings.llmOpenaiActiveProfileId = value;
                // 同步所选 Profile 到当前生效配置
                const profile = this.settings.llmOpenaiProfiles.find(p => p.id === value);
                if (profile) {
                    this.settings.llmOpenaiUrl = profile.url;
                    this.settings.llmOpenaiKey = profile.key;
                    this.settings.llmOpenaiModel = profile.model;
                    this.settings.llmUseCustomPrice = profile.useCustomPrice;
                    this.settings.llmPriceInputCustom = profile.priceInput;
                    this.settings.llmPriceOutputCustom = profile.priceOutput;
                }
                await this.i18n.saveSettings();
                this.refreshUI();
            });
        });

        // 新增方案
        profileHeader.addButton(btn => {
            btn.setIcon('plus')
                .setTooltip(t('Settings.Ai.ProfileAddBtn'))
                .onClick(async () => {
                    const id = Date.now().toString();
                    const newProfile = {
                        id,
                        name: `${t('Settings.Ai.ProfileAddBtn')} ${this.settings.llmOpenaiProfiles.length + 1}`,
                        url: '',
                        key: '',
                        model: 'gpt-3.5-turbo',
                        useCustomPrice: true,
                        priceInput: 1.1,
                        priceOutput: 4.4
                    };
                    this.settings.llmOpenaiProfiles.push(newProfile);
                    this.settings.llmOpenaiActiveProfileId = id;
                    this.settings.llmOpenaiUrl = newProfile.url;
                    this.settings.llmOpenaiKey = newProfile.key;
                    this.settings.llmOpenaiModel = newProfile.model;
                    this.settings.llmUseCustomPrice = newProfile.useCustomPrice;
                    this.settings.llmPriceInputCustom = newProfile.priceInput;
                    this.settings.llmPriceOutputCustom = newProfile.priceOutput;
                    
                    await this.i18n.saveSettings();
                    new Notice(t('Settings.Ai.ProfileAddNotice'));
                    this.refreshUI();
                });
        });

        // 删除方案
        profileHeader.addButton(btn => {
            btn.setIcon('trash')
                .setTooltip(t('Settings.Ai.ProfileDelBtn'))
                .onClick(async () => {
                    if (this.settings.llmOpenaiProfiles.length <= 1) {
                        new Notice("Cannot delete the last profile");
                        return;
                    }
                    if (!confirm(t('Settings.Ai.ProfileDelConfirm'))) return;

                    const activeId = this.settings.llmOpenaiActiveProfileId;
                    this.settings.llmOpenaiProfiles = this.settings.llmOpenaiProfiles.filter(p => p.id !== activeId);
                    
                    // 激活第一个
                    const nextProfile = this.settings.llmOpenaiProfiles[0];
                    this.settings.llmOpenaiActiveProfileId = nextProfile.id;
                    this.settings.llmOpenaiUrl = nextProfile.url;
                    this.settings.llmOpenaiKey = nextProfile.key;
                    this.settings.llmOpenaiModel = nextProfile.model;
                    this.settings.llmUseCustomPrice = nextProfile.useCustomPrice;
                    this.settings.llmPriceInputCustom = nextProfile.priceInput;
                    this.settings.llmPriceOutputCustom = nextProfile.priceOutput;
                    
                    await this.i18n.saveSettings();
                    this.refreshUI();
                });
        });

        const activeProfile = this.settings.llmOpenaiProfiles.find(p => p.id === this.settings.llmOpenaiActiveProfileId);

        // 方案名称修改 (直接在一行中编辑)
        if (activeProfile) {
            new Setting(this.containerEl)
                .setName(t('Settings.Ai.ProfileNameTitle'))
                .setDesc(t('Settings.Ai.ProfileNameDesc'))
                .addText(text => text
                    .setValue(activeProfile.name)
                    .setPlaceholder(t('Settings.Ai.ProfileNamePlaceholder'))
                    .onChange(async (value) => {
                        const val = value.trim();
                        if (val && val !== activeProfile.name) {
                            activeProfile.name = val;
                            await this.i18n.saveSettings();
                            // 注意：不刷新 UI，避免输入焦点丢失
                            // 只静态更新下拉框中的文字 (可选，或者告知用户刷新生效)
                            // 实际上 refreshUI 会导致输入框失去焦点，所以这里不调用 refreshUI
                            // 而是等下次界面重绘。
                        }
                    })
                );
        }

        // OpenAI接口地址配置
        new Setting(this.containerEl)
            .setName(t('Settings.Ai.OpenaiUrlTitle'))
            .setDesc(t('Settings.Ai.OpenaiUrlDesc'))
            .addText(text => text
                .setValue(this.settings.llmOpenaiUrl || '')
                .setPlaceholder(t('Settings.Ai.OpenaiUrlPlaceholder'))
                .onChange(async (value) => {
                    const val = value.trim();
                    this.settings.llmOpenaiUrl = val;
                    if (activeProfile) activeProfile.url = val;
                    await this.i18n.saveSettings();
                })
            );

        // OpenAI API Key配置 (使用密码框)
        new Setting(this.containerEl)
            .setName(t('Settings.Ai.OpenaiKeyTitle'))
            .setDesc(t('Settings.Ai.OpenaiKeyDescTip'))
            .addText(text => {
                text
                    .setValue(this.settings.llmOpenaiKey || '')
                    .setPlaceholder(t('Settings.Ai.OpenaiKeyPlaceholder'))
                    .onChange(async (value) => {
                        const val = value.trim();
                        this.settings.llmOpenaiKey = val;
                        if (activeProfile) activeProfile.key = val;
                        await this.i18n.saveSettings();
                    });
                text.inputEl.setAttribute('type', 'password');
            });

        this.modelUI(activeProfile);
        this.priceUI(activeProfile);
    }

    private configUI(): void {
        new Setting(this.containerEl).setName(t('Settings.Ai.TestHeader')).setHeading();
        
        // OpenAI 返回格式配置
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

        // 连通性测试 (UI优化 & 逻辑增强)
        new Setting(this.containerEl)
            .setName(t('Settings.Ai.TestTitle'))
            .setDesc(t('Settings.Ai.TestDesc'))
            .addButton(btn => {
                btn.setButtonText(t('Settings.Ai.TestBtn'))
                    .setCta()
                    .onClick(async () => {
                        const { llmOpenaiUrl, llmOpenaiKey, llmOpenaiModel } = this.settings;

                        if (!llmOpenaiUrl || !llmOpenaiKey) {
                            new Notice(t('Settings.Ai.TestNoticeMissing'));
                            return;
                        }

                        // 初始化测试器
                        const tester = new ConnectivityTester(llmOpenaiUrl, llmOpenaiKey, llmOpenaiModel);
                        
                        try {
                            btn.setDisabled(true).setButtonText(t('Settings.Ai.TestLoading'));

                            const report = await tester.runDeepDiagnostic((msg) => {
                                btn.setButtonText(msg);
                            });

                            // 显示深度诊断报告模态框
                            new DiagnosticModal(this.app, report).open();

                            if (report.overallStatus === 'healthy' || report.overallStatus === 'warning' || report.overallStatus === 'degraded') {
                                btn.setButtonText(t('Settings.Ai.TestSuccessBtn'));
                                setTimeout(() => btn.setButtonText(t('Settings.Ai.TestBtn')), 3000);
                            } else {
                                btn.setButtonText(t('Settings.Ai.TestFail'));
                                setTimeout(() => btn.setButtonText(t('Settings.Ai.TestBtn')), 3000);
                            }
                        } catch (error: any) {
                            console.error('Connection Test Unexpected Error:', error);
                            new Notice(`${t('Settings.Ai.TestFail')}: ${error.message || t('Settings.Ai.TestFailUnknown')}`);
                            btn.setButtonText(t('Settings.Ai.TestFail'));
                        } finally {
                            btn.setDisabled(false);
                        }
                    });
            });

        new Setting(this.containerEl).setName(t('Settings.Ai.PromptHeader')).setHeading();

        // Regex 自定义提示词
        new Setting(this.containerEl)
            .setName(t('Settings.Ai.RegexPromptTitle'))
            .setDesc(t('Settings.Ai.RegexPromptDesc'))
            .addTextArea(text => {
                text
                    .setValue(this.settings.llmRegexPrompt || '')
                    .setPlaceholder(t('Settings.Ai.RegexPromptPlaceholder'))
                    .onChange(async (value) => {
                        this.settings.llmRegexPrompt = value;
                        await this.i18n.saveSettings();
                    });
                text.inputEl.rows = 12;
                text.inputEl.style.width = '100%';
            });

        // AST 自定义提示词
        new Setting(this.containerEl)
            .setName(t('Settings.Ai.AstPromptTitle'))
            .setDesc(t('Settings.Ai.AstPromptDesc'))
            .addTextArea(text => {
                text
                    .setValue(this.settings.llmAstPrompt || '')
                    .setPlaceholder(t('Settings.Ai.AstPromptPlaceholder'))
                    .onChange(async (value) => {
                        this.settings.llmAstPrompt = value;
                        await this.i18n.saveSettings();
                    });
                text.inputEl.rows = 12;
                text.inputEl.style.width = '100%';
            });

        // Theme 自定义提示词
        new Setting(this.containerEl)
            .setName(t('Settings.Ai.ThemePromptTitle'))
            .setDesc(t('Settings.Ai.ThemePromptDesc'))
            .addTextArea(text => {
                text
                    .setValue(this.settings.llmThemePrompt || '')
                    .setPlaceholder(t('Settings.Ai.ThemePromptPlaceholder'))
                    .onChange(async (value) => {
                        this.settings.llmThemePrompt = value;
                        await this.i18n.saveSettings();
                    });
                text.inputEl.rows = 12;
                text.inputEl.style.width = '100%';
            });
    }

    private modelUI(activeProfile: any): void {
        // OpenAI模型配置 (下拉选择 + 手动输入)
        const modelSetting = new Setting(this.containerEl)
            .setName(t('Settings.Ai.ModelTitle'))
            .setDesc(t('Settings.Ai.ModelDesc'));

        // 添加常用模型下拉框
        modelSetting.addDropdown(dropdown => {
            const commonModels = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini'];
            dropdown.addOption('', t('Settings.Ai.ModelSelectPlaceholder'));
            commonModels.forEach(m => dropdown.addOption(m, m));
            dropdown.onChange(async (value) => {
                if (value) {
                    this.settings.llmOpenaiModel = value;
                    if (activeProfile) activeProfile.model = value;
                    await this.i18n.saveSettings();
                    // 更新输入框的值
                    const inputEl = modelSetting.controlEl.querySelector('input');
                    if (inputEl) (inputEl as HTMLInputElement).value = value;
                }
            });
        });

        // 模型手动输入框
        modelSetting.addText(text => text
            .setValue(this.settings.llmOpenaiModel || '')
            .setPlaceholder(t('Settings.Ai.ModelInputPlaceholder'))
            .onChange(async (value) => {
                const val = value.trim();
                this.settings.llmOpenaiModel = val;
                if (activeProfile) activeProfile.model = val;
                await this.i18n.saveSettings();
            })
        );
    }

    private priceUI(activeProfile: any): void {
        // 价格配置 - 直接在一行中根据输入激活
        
        // 输入价格
        new Setting(this.containerEl)
            .setName(t('Settings.Ai.PriceInputTitle'))
            .setDesc(t('Settings.Ai.PriceInputDesc'))
            .addText(text => text
                .setValue(this.settings.llmPriceInputCustom?.toString() || '')
                .setPlaceholder('1.1')
                .onChange(async (value) => {
                    const val = parseFloat(value);
                    const isValid = !isNaN(val) && value.trim() !== '';
                    
                    this.settings.llmPriceInputCustom = isValid ? val : 0;
                    if (activeProfile) activeProfile.priceInput = this.settings.llmPriceInputCustom;
                    
                    // 自动判断是否启用自定义计费
                    this.updateCustomPriceFlag(activeProfile);
                    await this.i18n.saveSettings();
                })
            );

        // 输出价格
        new Setting(this.containerEl)
            .setName(t('Settings.Ai.PriceOutputTitle'))
            .setDesc(t('Settings.Ai.PriceOutputDesc'))
            .addText(text => text
                .setValue(this.settings.llmPriceOutputCustom?.toString() || '')
                .setPlaceholder('4.4')
                .onChange(async (value) => {
                    const val = parseFloat(value);
                    const isValid = !isNaN(val) && value.trim() !== '';
                    
                    this.settings.llmPriceOutputCustom = isValid ? val : 0;
                    if (activeProfile) activeProfile.priceOutput = this.settings.llmPriceOutputCustom;
                    
                    // 自动判断是否启用自定义计费
                    this.updateCustomPriceFlag(activeProfile);
                    await this.i18n.saveSettings();
                })
            );
    }

    private updateCustomPriceFlag(activeProfile: any): void {
        const hasInput = this.settings.llmPriceInputCustom > 0;
        const hasOutput = this.settings.llmPriceOutputCustom > 0;
        const enable = hasInput || hasOutput;
        
        this.settings.llmUseCustomPrice = enable;
        if (activeProfile) activeProfile.useCustomPrice = enable;
    }
}