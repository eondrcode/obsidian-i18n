import { Setting, Notice } from "obsidian";
import BaseSetting from "../base-setting";
import { t } from "src/locales";
import { OllamaTranslationService, OLLAMA_DEFAULT_URL } from "src/ai/ollama-translation-service";

export default class I18nLLMOllama extends BaseSetting {
    main(): void {
        // 仅当接口服务为 Ollama 时显示
        if (this.settings.llmApi !== 3) return;

        this.connectionUI();
        this.configUI();
    }

    private refreshUI(): void {
        this.settingTab.llmDisplay();
    }

    private connectionUI(): void {
        // Ollama 端点地址配置
        new Setting(this.containerEl)
            .setName(t('Settings.Ai.OllamaUrlTitle'))
            .setDesc(t('Settings.Ai.OllamaUrlDesc'))
            .addText(text => text
                .setValue(this.settings.llmOllamaUrl || OLLAMA_DEFAULT_URL)
                .setPlaceholder(OLLAMA_DEFAULT_URL)
                .onChange(async (value) => {
                    const val = value.trim() || OLLAMA_DEFAULT_URL;
                    this.settings.llmOllamaUrl = val;
                    await this.i18n.saveSettings();
                })
            );

        // 官网链接
        new Setting(this.containerEl)
            .setName(t('Settings.Ai.HomepageBtn'))
            .setDesc('https://ollama.com/')
            .addButton(btn => {
                btn.setButtonText(t('Settings.Ai.HomepageBtn'))
                    .onClick(() => {
                        window.open('https://ollama.com/');
                    });
            });

        // 模型选择
        const modelSetting = new Setting(this.containerEl)
            .setName(t('Settings.Ai.ModelTitle'))
            .setDesc(t('Settings.Ai.OllamaModelDesc'));

        // 刷新按钮：从 Ollama 获取模型列表
        modelSetting.addButton(btn => {
            btn.setIcon('refresh-cw')
                .setTooltip(t('Settings.Ai.OllamaFetchModelsBtn'))
                .onClick(async () => {
                    btn.setDisabled(true);
                    try {
                        const models = await OllamaTranslationService.fetchModels(this.settings.llmOllamaUrl);
                        if (models.length === 0) {
                            new Notice(t('Settings.Ai.OllamaNoModels'));
                        } else {
                            new Notice(t('Settings.Ai.OllamaModelsLoaded', { count: models.length }));
                            this.refreshUI();
                        }
                    } catch {
                        new Notice(t('Settings.Ai.OllamaFetchFailed'));
                    } finally {
                        btn.setDisabled(false);
                    }
                });
        });

        // 下拉列表 (动态填充)
        modelSetting.addDropdown(async dropdown => {
            dropdown.addOption('', t('Settings.Ai.ModelSelectPlaceholder'));

            // 尝试从 Ollama 获取模型列表
            try {
                const models = await OllamaTranslationService.fetchModels(this.settings.llmOllamaUrl);
                models.forEach(m => dropdown.addOption(m, m));
            } catch {
                // 静默失败，用户可以手动输入
            }

            dropdown.setValue(this.settings.llmOllamaModel || '');
            dropdown.onChange(async (value) => {
                if (value) {
                    this.settings.llmOllamaModel = value;
                    await this.i18n.saveSettings();
                    // 同步输入框
                    const inputEl = modelSetting.controlEl.querySelector('input');
                    if (inputEl) (inputEl as HTMLInputElement).value = value;
                }
            });
        });

        // 手动输入模型名
        modelSetting.addText(text => text
            .setValue(this.settings.llmOllamaModel || '')
            .setPlaceholder(t('Settings.Ai.OllamaModelPlaceholder'))
            .onChange(async (value) => {
                this.settings.llmOllamaModel = value.trim();
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
                        const { llmOllamaUrl, llmOllamaModel } = this.settings;
                        const baseUrl = (llmOllamaUrl || OLLAMA_DEFAULT_URL).replace(/\/+$/, '');

                        try {
                            btn.setDisabled(true).setButtonText(t('Settings.Ai.TestLoading'));

                            // 1. 测试端点连通
                            const { requestUrl } = await import('obsidian');
                            const tagsRes = await requestUrl({
                                url: `${baseUrl}/api/tags`,
                                method: 'GET',
                                throw: false
                            });

                            if (tagsRes.status !== 200) {
                                btn.setButtonText(t('Settings.Ai.TestFail'));
                                new Notice(`${t('Settings.Ai.OllamaConnectFail')}: HTTP ${tagsRes.status}`);
                                return;
                            }

                            // 2. 检查指定模型是否存在
                            const models: string[] = (tagsRes.json?.models || []).map((m: any) => m.name || m.model);
                            if (llmOllamaModel && !models.some(m => m.startsWith(llmOllamaModel))) {
                                btn.setButtonText(t('Settings.Ai.TestFail'));
                                new Notice(t('Settings.Ai.OllamaModelNotFound', { model: llmOllamaModel }));
                                return;
                            }

                            // 3. 简单推理测试
                            const chatRes = await requestUrl({
                                url: `${baseUrl}/v1/chat/completions`,
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    model: llmOllamaModel || models[0] || 'llama3',
                                    messages: [{ role: 'user', content: 'hi' }],
                                    max_tokens: 5,
                                    stream: false,
                                }),
                                throw: false
                            });

                            if (chatRes.status === 200) {
                                btn.setButtonText(t('Settings.Ai.TestSuccessBtn'));
                                new Notice(`${t('Settings.Ai.TestSuccess')} (${models.length} 个模型可用)`);
                            } else {
                                btn.setButtonText(t('Settings.Ai.TestFail'));
                                new Notice(`${t('Settings.Ai.TestFail')}: HTTP ${chatRes.status}`);
                            }
                        } catch (error: any) {
                            btn.setButtonText(t('Settings.Ai.TestFail'));
                            new Notice(`${t('Settings.Ai.OllamaConnectFail')}: ${error.message}`);
                        } finally {
                            btn.setDisabled(false);
                            setTimeout(() => btn.setButtonText(t('Settings.Ai.TestBtn')), 3000);
                        }
                    });
            });

        // 提示词部分
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
