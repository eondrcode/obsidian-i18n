import { Setting, Notice } from "obsidian";
import BaseSetting from "../base-setting";
import { t } from "src/locales";
import { GeminiProfile } from "../data";

export default class I18nLLMGemini extends BaseSetting {
    main(): void {
        // 仅当接口服务为 Gemini 时显示
        if (this.settings.llmApi !== 2) return;

        this.profileUI();
        this.configUI();
    }

    private refreshUI(): void {
        this.settingTab.llmDisplay();
    }

    private profileUI(): void {
        // Gemini 方案管理 (Profile)
        const profileHeader = new Setting(this.containerEl)
            .setName(t('Settings.Ai.ProfileSelectTitle'))
            .setDesc(t('Settings.Ai.ProfileSelectDesc'));

        profileHeader.addDropdown(dropdown => {
            this.settings.llmGeminiProfiles.forEach(p => {
                dropdown.addOption(p.id, p.name);
            });
            dropdown.setValue(this.settings.llmGeminiActiveProfileId);
            dropdown.onChange(async (value) => {
                this.settings.llmGeminiActiveProfileId = value;
                const profile = this.settings.llmGeminiProfiles.find(p => p.id === value);
                if (profile) {
                    this.settings.llmGeminiKey = profile.key;
                    this.settings.llmGeminiModel = profile.model;
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
                    const newProfile: GeminiProfile = {
                        id,
                        name: `${t('Settings.Ai.ProfileAddBtn')} ${this.settings.llmGeminiProfiles.length + 1}`,
                        key: '',
                        model: 'gemini-2.0-flash',
                        url: "",
                        useCustomPrice: false,
                        priceInput: 0,
                        priceOutput: 0
                    };
                    this.settings.llmGeminiProfiles.push(newProfile);
                    this.settings.llmGeminiActiveProfileId = id;
                    this.settings.llmGeminiKey = newProfile.key;
                    this.settings.llmGeminiModel = newProfile.model;

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
                    if (this.settings.llmGeminiProfiles.length <= 1) {
                        new Notice("Cannot delete the last profile");
                        return;
                    }
                    if (!confirm(t('Settings.Ai.ProfileDelConfirm'))) return;

                    const activeId = this.settings.llmGeminiActiveProfileId;
                    this.settings.llmGeminiProfiles = this.settings.llmGeminiProfiles.filter(p => p.id !== activeId);

                    const nextProfile = this.settings.llmGeminiProfiles[0];
                    this.settings.llmGeminiActiveProfileId = nextProfile.id;
                    this.settings.llmGeminiKey = nextProfile.key;
                    this.settings.llmGeminiModel = nextProfile.model;

                    await this.i18n.saveSettings();
                    this.refreshUI();
                });
        });

        const activeProfile = this.settings.llmGeminiProfiles.find(p => p.id === this.settings.llmGeminiActiveProfileId);

        // 方案名称修改
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
                        }
                    })
                );
        }

        // Gemini API Key 配置 (密码框)
        new Setting(this.containerEl)
            .setName(t('Settings.Ai.GeminiKeyTitle'))
            .setDesc(t('Settings.Ai.GeminiKeyDesc'))
            .addText(text => {
                text
                    .setValue(this.settings.llmGeminiKey || '')
                    .setPlaceholder('AIza...')
                    .onChange(async (value) => {
                        const val = value.trim();
                        this.settings.llmGeminiKey = val;
                        if (activeProfile) activeProfile.key = val;
                        await this.i18n.saveSettings();
                    });
                text.inputEl.setAttribute('type', 'password');
            });

        // 官网链接
        new Setting(this.containerEl)
            .setName(t('Settings.Ai.HomepageBtn'))
            .setDesc('https://aistudio.google.com/')
            .addButton(btn => {
                btn.setButtonText(t('Settings.Ai.HomepageBtn'))
                    .onClick(() => {
                        window.open('https://aistudio.google.com/');
                    });
            });

        // 模型选择
        this.modelUI(activeProfile);
    }

    private modelUI(activeProfile: any): void {
        const modelSetting = new Setting(this.containerEl)
            .setName(t('Settings.Ai.ModelTitle'))
            .setDesc(t('Settings.Ai.ModelDesc'));

        // 添加常用 Gemini 模型下拉框
        modelSetting.addDropdown(dropdown => {
            const commonModels = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
            dropdown.addOption('', t('Settings.Ai.ModelSelectPlaceholder'));
            commonModels.forEach(m => dropdown.addOption(m, m));
            dropdown.onChange(async (value) => {
                if (value) {
                    this.settings.llmGeminiModel = value;
                    if (activeProfile) activeProfile.model = value;
                    await this.i18n.saveSettings();
                    const inputEl = modelSetting.controlEl.querySelector('input');
                    if (inputEl) (inputEl as HTMLInputElement).value = value;
                }
            });
        });

        // 模型手动输入框
        modelSetting.addText(text => text
            .setValue(this.settings.llmGeminiModel || '')
            .setPlaceholder(t('Settings.Ai.ModelInputPlaceholder'))
            .onChange(async (value) => {
                const val = value.trim();
                this.settings.llmGeminiModel = val;
                if (activeProfile) activeProfile.model = val;
                await this.i18n.saveSettings();
            })
        );
    }

    private configUI(): void {
        new Setting(this.containerEl).setName(t('Settings.Ai.TestHeader')).setHeading();

        // 连通性测试
        new Setting(this.containerEl)
            .setName(t('Settings.Ai.TestTitle'))
            .setDesc(t('Settings.Ai.TestDesc'))
            .addButton(btn => {
                btn.setButtonText(t('Settings.Ai.TestBtn'))
                    .setCta()
                    .onClick(async () => {
                        const { llmGeminiKey, llmGeminiModel } = this.settings;

                        if (!llmGeminiKey) {
                            new Notice(t('Settings.Ai.GeminiKeyMissing'));
                            return;
                        }

                        try {
                            btn.setDisabled(true).setButtonText(t('Settings.Ai.TestLoading'));

                            // 简单的连通性测试：调用 models API
                            const { requestUrl } = await import('obsidian');
                            const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${llmGeminiModel || 'gemini-2.0-flash'}:generateContent?key=${llmGeminiKey}`;
                            const res = await requestUrl({
                                url: testUrl,
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
                                    generationConfig: { maxOutputTokens: 5 }
                                }),
                                throw: false
                            });

                            if (res.status === 200) {
                                btn.setButtonText(t('Settings.Ai.TestSuccessBtn'));
                                new Notice(t('Settings.Ai.TestSuccess'));
                            } else {
                                const errMsg = res.json?.error?.message || `HTTP ${res.status}`;
                                btn.setButtonText(t('Settings.Ai.TestFail'));
                                new Notice(`${t('Settings.Ai.TestFail')}: ${errMsg}`);
                            }
                        } catch (error: any) {
                            btn.setButtonText(t('Settings.Ai.TestFail'));
                            new Notice(`${t('Settings.Ai.TestFail')}: ${error.message}`);
                        } finally {
                            btn.setDisabled(false);
                            setTimeout(() => btn.setButtonText(t('Settings.Ai.TestBtn')), 3000);
                        }
                    });
            });

        // 提示词部分（复用通用 Prompt 区域）
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
}
