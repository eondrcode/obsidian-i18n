import BaseSetting from "../base-setting";
import { Setting } from "obsidian";
import { SUPPORTED_LANGUAGES } from '@/src/constants/languages';
import { t } from "src/locales";

export default class I18nBasis extends BaseSetting {
    main(): void {
        // 1. 检查更新设置
        new Setting(this.containerEl)
            .setName(t('Settings.Basis.UpdateTitle'))
            .setDesc(t('Settings.Basis.UpdateDesc'))
            .addButton(cb => {
                cb.setButtonText(t('Settings.Basis.UpdateBtn'))
                    .onClick(async () => {
                        await this.i18n.coreManager.applyUpdate();
                        this.settingTab.basisDisplay();
                    });
                if (!this.i18n.coreManager.updatesMark) {
                    cb.buttonEl.style.display = 'none';
                }
            })
            .addToggle(cb => cb
                .setValue(this.settings.checkUpdates)
                .onChange(async () => {
                    this.settings.checkUpdates = !this.settings.checkUpdates;
                    await this.i18n.saveSettings();
                    if (this.settings.checkUpdates) {
                        await this.i18n.coreManager.checkUpdates(true);
                    } else {
                        this.i18n.coreManager.updatesMark = false;
                        this.i18n.coreManager.updatesVersion = '';
                    }
                    this.settingTab.basisDisplay();
                })
            );
        // 2. 目标语言设置
        new Setting(this.containerEl)
            .setName(t('Settings.Basis.LangTitle'))
            .setDesc(t('Settings.Basis.LangDesc'))
            .addDropdown(cb => cb
                .addOptions(
                    Object.fromEntries(SUPPORTED_LANGUAGES.map(lang => [lang.value, lang.label]))
                )
                .setValue(this.settings.language)
                .onChange(async (value) => {
                    this.settings.language = value;
                    await this.i18n.saveSettings();
                })
            );



        // 3. 自动迁移旧版本译文 (智能更新)
        new Setting(this.containerEl)
            .setName(t('Settings.Basis.SmartUpdateTitle'))
            .setDesc(t('Settings.Basis.SmartUpdateDesc'))
            .addToggle((cb) =>
                cb
                    .setValue(this.settings.automaticUpdate)
                    .onChange(async (value) => {
                        this.settings.automaticUpdate = value;
                        await this.i18n.saveSettings();
                    })
            );

        // 4. 编辑器自动保存
        new Setting(this.containerEl)
            .setName(t('Settings.Basis.AutoSaveTitle'))
            .setDesc(t('Settings.Basis.AutoSaveDesc'))
            .addToggle((cb) =>
                cb
                    .setValue(this.settings.autoSave)
                    .onChange(async (value) => {
                        this.settings.autoSave = value;
                        await this.i18n.saveSettings();
                    })
            );

        // 5. 默认作者署名
        new Setting(this.containerEl)
            .setName(t('Settings.Basis.AuthorTitle'))
            .setDesc(t('Settings.Basis.AuthorDesc'))
            .addText(cb => cb
                .setPlaceholder(t('Settings.Basis.AuthorPlaceholder'))
                .setValue(this.settings.author)
                .onChange(async (value) => {
                    this.settings.author = value;
                    await this.i18n.saveSettings();
                })
            );

        // 6. 插件管理器外部链接
        new Setting(this.containerEl)
            .setName(t('Settings.Basis.ManagerTitle'))
            .setDesc(t('Settings.Basis.ManagerDesc'))
            .addButton((cb) => {
                cb.setButtonText(t('Settings.Basis.ManagerBtn'))
                    .onClick(() => {
                        window.open('https://github.com/eondrcode/obsidian-manager');
                    });
            });
    }
}