import { Notice, Setting } from "obsidian";
import BaseSetting from "../base-setting";
import { t } from "src/locales";

// 自动更新
export default class I18nModIMT extends BaseSetting {
    main(): void {

        const modeToggle = new Setting(this.containerEl);
        modeToggle.setName(`${t('Settings.Immersive.Title')}`);
        modeToggle.setDesc(t('Settings.Immersive.Desc'));
        modeToggle.addToggle(cb => {
            cb.setValue(this.settings.modeImt)
                .onChange(async (value) => {
                    this.settings.modeImt = value;
                    await this.i18n.saveSettings();
                    this.settingTab.imtDisplay();
                    value ? this.i18n.coreManager.activateIMT() : this.i18n.coreManager.deactivateIMT();
                });
        });

        // [设置组] 沉浸式翻译配置
        new Setting(this.containerEl).setName(t('Settings.Immersive.CoreControl')).setDesc(t('Settings.Immersive.CoreControlDesc')).setHeading();

        // [设置项] 精确指定需要翻译和排除的页面元素
        const selectorsTextArea = new Setting(this.containerEl);
        selectorsTextArea.setName(t('Settings.Immersive.MatchTitle'));
        selectorsTextArea.setDesc(createStructuredDesc({
            type: 'string[]',
            desc: t('Settings.Immersive.MatchDesc'),
            example: '',
            notice: t('Settings.Immersive.MatchNotice')
        }));
        selectorsTextArea.addTextArea(cb => cb
            .setValue(this.settings.imtPagerule.selectors ? this.settings.imtPagerule.selectors.join('\n') : '')
            .onChange(async (v) => {
                this.settings.imtPagerule.selectors = v.split('\n').filter(item => typeof item === 'string' && item.trim() !== '');
                await this.i18n.saveSettings();
            })
            .inputEl.onblur = () => { new Notice(t('Settings.Immersive.RestartNotice'), 5000); }
        );

        // [设置项] 精确指定需要排除的页面元素
        const excludeSelectorsTextArea = new Setting(this.containerEl);
        excludeSelectorsTextArea.setName(t('Settings.Immersive.ExcludeTitle'));
        excludeSelectorsTextArea.setDesc(createStructuredDesc({
            type: 'string[]',
            desc: t('Settings.Immersive.ExcludeDesc'),
            example: '',
            notice: ''
        }));
        excludeSelectorsTextArea.addTextArea(cb => cb
            .setValue(this.settings.imtPagerule.excludeSelectors ? this.settings.imtPagerule.excludeSelectors.join('\n') : '')
            .onChange(async (v) => {
                this.settings.imtPagerule.excludeSelectors = v.split('\n').filter(item => typeof item === 'string' && item.trim() !== '');;
                await this.i18n.saveSettings();
            })
            .inputEl.onblur = () => { new Notice(t('Settings.Immersive.RestartNotice'), 5000); }
        );
    }
}

type FieldConfig = {
    type: string;
    desc: string;
    example: string;
    notice?: string;
};

// 创建通用的描述生成函数
const createStructuredDesc = (config: FieldConfig) => {
    const fragment = new DocumentFragment();
    fragment.createDiv({ text: `${t('Settings.Immersive.DescLabel')} ${config.desc}` });
    if (config.notice) {
        fragment.createDiv({ text: config.notice });
    }
    return fragment;
};