import * as path from 'path';
import * as fs from 'fs-extra';
import { t } from '../locales';
import I18N from '../main';
import { activateIMT, deactivateIMT, AstTranslator, RegexTranslator } from '../utils';
import { MANAGER_VIEW_TYPE } from '../views/manager/manager-view';

export class CoreManager {
    private i18n: I18N;

    // [更新相关] - 插件版本更新状态
    updatesMark = false;        // [变量] 是否存在更新标记
    updatesVersion: string;     // [变量] 更新版本


    // [变量] 样式
    css: string;

    i18nReviewEl: HTMLElement;

    // [管理相关] - 翻译器实例复用
    private _astTranslator: AstTranslator | null = null;
    private _regexTranslator: RegexTranslator | null = null;

    constructor(i18n: I18N) {
        this.i18n = i18n;
    }

    // [UI] 注册功能区图标
    public setupRibbonIcons() {
        // [功能] 翻译
        this.i18n.addRibbonIcon('i18n_translate', t('common.i18n'), () => {
            this.i18n.view.activateView(MANAGER_VIEW_TYPE);
        });
    }

    public async firstRun() {
    }

    public async checkUpdates() {
        // 使用 GitHub API 获取最新 Release
        const owner = 'eondrcode'; // 插件所有者
        const repo = 'obsidian-i18n'; // 插件仓库名
        const res = await this.i18n.api.github.getLatestRelease(owner, repo);

        if (res.state) {
            const latestVersion = res.data.tag_name.replace(/^v/, '');
            if (this.i18n.manifest.version !== latestVersion) {
                const noticeStr = `${t('Settings.Basis.CheckUpdateNotice')}(${latestVersion})\n${res.data.body || ''}`;
                this.i18n.notice.primaryPrefix(t('Settings.Basis.CheckUpdatePrefix'), noticeStr, 15000);
                this.updatesMark = true;
                this.updatesVersion = latestVersion;
            }
        }
    }




    // 激活沉浸式翻译
    public async activateIMT() {
        await activateIMT(this.i18n.settings);
        this.i18n.settings.modeImt = true;
        this.i18n.saveSettings();
    }

    // 停用沉浸式翻译
    public deactivateIMT() {
        deactivateIMT()
        this.i18n.settings.modeImt = false;
        this.i18n.saveSettings();
    }

    public getCss() {
        //@ts-ignore
        const stylesDoc = path.join(path.join(path.normalize(this.i18n.app.vault.adapter.getBasePath()), this.i18n.manifest.dir), 'styles.css');
        this.css = fs.readFileSync(stylesDoc).toString();
        this.i18n.css = this.css;

        try {
            this.i18n.sharedStyleSheet = new CSSStyleSheet();
            this.i18n.sharedStyleSheet.replaceSync(this.css);
        } catch (e) {
            this.i18n.logger.error('Failed to precompile CSSStyleSheet:', e);
        }
    }

    /**
     * 获取 AST 翻译器实例 (懒加载/复用)
     */
    public getAstTranslator(): AstTranslator {
        if (!this._astTranslator) {
            this._astTranslator = new AstTranslator(this.i18n.settings);
        }
        return this._astTranslator;
    }

    /**
     * 获取 Regex 翻译器实例 (懒加载/复用)
     */
    public getRegexTranslator(): RegexTranslator {
        if (!this._regexTranslator) {
            this._regexTranslator = new RegexTranslator(this.i18n.settings);
        }
        return this._regexTranslator;
    }

    /**
     * 重置翻译器实例 (当设置变更等情况下调用)
     */
    public resetTranslators() {
        this._astTranslator = null;
        this._regexTranslator = null;
    }

}
