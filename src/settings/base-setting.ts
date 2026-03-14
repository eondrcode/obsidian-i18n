import I18N from 'src/main';
import { I18nSettingTab } from '.';
import { I18nSettings } from './data';
import { App } from 'obsidian';

export default abstract class BaseSetting {
    protected settingTab: I18nSettingTab;
    protected i18n: I18N;
    protected settings: I18nSettings;
    public containerEl: HTMLElement;
    protected a: HTMLElement;
    protected app: App;

    constructor(obj: I18nSettingTab) {
        this.settingTab = obj;
        this.i18n = obj.i18n;
        this.settings = obj.i18n.settings;
        this.a = obj.containerEl;
        this.containerEl = obj.contentEl;
        this.app = obj.app;
    }

    public abstract main(): void;
    public display(): void { this.main() }
}