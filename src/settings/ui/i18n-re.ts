import { Setting } from "obsidian"
import BaseSetting from "../base-setting"
import { t } from "src/locales";

export default class I18nRE extends BaseSetting {
    main(): void {
        const { containerEl } = this;
        containerEl.empty();

        // ==============================
        // 1. 正则参数配置
        // ==============================
        new Setting(containerEl)
            .setName(t('Settings.Re.ParamsHeader'))
            .setHeading();

        // RE 标志
        new Setting(containerEl)
            .setName(t('Settings.Re.FlagTitle'))
            .setDesc(t('Settings.Re.FlagDesc'))
            .addText(cb => cb
                .setValue(this.settings.reFlags)
                .setPlaceholder(t('Settings.Re.FlagPlaceholder'))
                .onChange(async (value) => {
                    this.settings.reFlags = value;
                    await this.i18n.saveSettings();
                })
            );

        // RE 长度
        new Setting(containerEl)
            .setName(t('Settings.Re.LenTitle'))
            .setDesc(t('Settings.Re.LenDesc'))
            .addSlider(cb => cb
                .setDynamicTooltip()
                .setLimits(0, 3000, 100)
                .setValue(this.settings.reLength)
                .onChange(async (value) => {
                    this.settings.reLength = value
                    await this.i18n.saveSettings();
                })
            );


        // ==============================
        // 3. 正则匹配数据管理
        // ==============================
        new Setting(containerEl)
            .setName(t('Settings.Re.DataHeader'))
            .setHeading();

        new Setting(containerEl)
            .setName(t('Settings.Re.DataEditTitle'))
            .setDesc(t('Settings.Re.DataEditDesc'))
            .addTextArea(text => {
                text.setValue((this.settings.reDatas || []).join('\n'))
                    .setPlaceholder(t('Settings.Re.DataPlaceholder'))
                    .onChange(async (value) => {
                        this.settings.reDatas = value.split('\n').map(s => s.trim()).filter(s => s !== '');
                        await this.i18n.saveSettings();
                    });
                text.inputEl.rows = 10;
                text.inputEl.style.width = '100%';
            });

        // ==============================
        // 4. 内容过滤规则 (正则)
        // ==============================
        new Setting(containerEl)
            .setName(t('Settings.Re.RegexHeader'))
            .setHeading();

        new Setting(containerEl)
            .setName(t('Settings.Re.RejectReTitle'))
            .setDesc(t('Settings.Re.RejectReDesc'))
            .addTextArea(text => {
                text.setValue((this.settings.reRejectRe || []).join('\n'))
                    .setPlaceholder(t('Settings.Re.RejectPlaceholder'))
                    .onChange(async (value) => {
                        this.settings.reRejectRe = value.split('\n').map(s => s.trim()).filter(s => s !== '');
                        await this.i18n.saveSettings();
                    });
                text.inputEl.rows = 6;
                text.inputEl.style.width = '100%';
            });

        new Setting(containerEl)
            .setName(t('Settings.Re.ValidReTitle'))
            .setDesc(t('Settings.Re.ValidReDesc'))
            .addTextArea(text => {
                text.setValue((this.settings.reValidRe || []).join('\n'))
                    .setPlaceholder(t('Settings.Re.ValidPlaceholder'))
                    .onChange(async (value) => {
                        this.settings.reValidRe = value.split('\n').map(s => s.trim()).filter(s => s !== '');
                        await this.i18n.saveSettings();
                    });
                text.inputEl.rows = 6;
                text.inputEl.style.width = '100%';
            });

        // ==============================
        // 5. 翻译提示词配置 (正则)
        // ==============================
        new Setting(containerEl)
            .setName(t('Settings.Re.PromptHeader'))
            .setHeading();

        // Regex Prompt 配置
        const regexPromptSetting = new Setting(containerEl)
            .setName(t('Settings.Re.PromptTitle'))
            .setDesc(t('Settings.Re.PromptDesc'));

        regexPromptSetting.addTextArea(text => {
            text.setValue(this.settings.llmRegexPrompt || '')
                .setPlaceholder(t('Settings.Re.PromptPlaceholder'))
                .onChange(async (value) => {
                    this.settings.llmRegexPrompt = value;
                    await this.i18n.saveSettings();
                });

            // 样式调整
            text.inputEl.rows = 8;
            text.inputEl.addClass('i18n-settings-textarea');
            text.inputEl.style.width = '100%';
        });
    }
}
