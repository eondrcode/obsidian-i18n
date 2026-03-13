import { Setting, Notice } from "obsidian";
import BaseSetting from "../base-setting";
import OpenAI from "openai"; // 确保已安装：npm install openai
import { t } from "src/locales";

export default class I18nLLMOpenAI extends BaseSetting {
    main(): void {
        // 仅当接口服务为OpenAI时显示
        if (this.settings.llmApi !== 1) return;

        // OpenAI接口地址配置
        new Setting(this.containerEl)
            .setName(t('Settings.Ai.OpenaiUrlTitle'))
            .setDesc(t('Settings.Ai.OpenaiUrlDesc'))
            .addText(text => text
                .setValue(this.settings.llmOpenaiUrl)
                .setPlaceholder(t('Settings.Ai.OpenaiUrlPlaceholder'))
                .onChange(async (value) => {
                    this.settings.llmOpenaiUrl = value.trim();
                    await this.i18n.saveSettings();
                })
            );

        // OpenAI API Key配置 (使用密码框)
        new Setting(this.containerEl)
            .setName(t('Settings.Ai.OpenaiKeyTitle'))
            .setDesc(t('Settings.Ai.OpenaiKeyDescTip'))
            .addText(text => {
                text
                    .setValue(this.settings.llmOpenaiKey)
                    .setPlaceholder(t('Settings.Ai.OpenaiKeyPlaceholder'))
                    .onChange(async (value) => {
                        this.settings.llmOpenaiKey = value.trim();
                        await this.i18n.saveSettings();
                    });
                text.inputEl.setAttribute('type', 'password');
            });

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
                    await this.i18n.saveSettings();
                    // 更新输入框的值
                    const inputEl = modelSetting.controlEl.querySelector('input');
                    if (inputEl) (inputEl as HTMLInputElement).value = value;
                }
            });
        });

        // 模型手动输入框
        modelSetting.addText(text => text
            .setValue(this.settings.llmOpenaiModel)
            .setPlaceholder(t('Settings.Ai.ModelInputPlaceholder'))
            .onChange(async (value) => {
                this.settings.llmOpenaiModel = value.trim();
                await this.i18n.saveSettings();
            })
        );


        new Setting(this.containerEl).setName(t('Settings.Ai.TestHeader')).setHeading();

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

                        try {
                            btn.setDisabled(true).setButtonText(t('Settings.Ai.TestLoading'));

                            // 配置 OpenAI 客户端
                            const openai = new OpenAI({
                                baseURL: llmOpenaiUrl.replace(/\/+$/, ''), // 移除末尾斜杠
                                apiKey: llmOpenaiKey,
                                timeout: 10000,
                                dangerouslyAllowBrowser: true
                            });

                            // 优先尝试 list models，这通常是免费且快速的验证方式
                            await openai.models.list();

                            // 如果 list 成功，再尝试一个极简的 chat (可选，验证模型是否有权限)
                            // 这里仅做 models.list 校验通常足够证明 Key 和 URL 是通的

                            new Notice(t('Settings.Ai.TestSuccess'));
                            btn.setButtonText(t('Settings.Ai.TestSuccessBtn'));
                            setTimeout(() => btn.setButtonText(t('Settings.Ai.TestBtn')), 2000);
                        } catch (error: any) {
                            console.error('Connection Test Failed:', error);
                            let msg = error.message || '';
                            if (msg.includes('401')) msg = t('Settings.Ai.TestFail401');
                            else if (msg.includes('404')) msg = t('Settings.Ai.TestFail404');
                            else msg = msg ? `${t('Settings.Ai.TestFailUnknown')}: ${msg}` : t('Settings.Ai.TestFailUnknown');

                            new Notice(`${t('Settings.Ai.TestFail')}: ${msg}`, 5000);
                            btn.setButtonText(t('Settings.Ai.TestFail'));
                        } finally {
                            btn.setDisabled(false);
                            if (btn.buttonEl.innerText === t('Settings.Ai.TestLoading')) {
                                btn.setButtonText(t('Settings.Ai.TestBtn'));
                            }
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
}