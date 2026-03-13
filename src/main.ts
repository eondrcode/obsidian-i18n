import * as path from 'path';
import * as fs from 'fs-extra';
import './locales';     // 引入i18n配置

import { App, Plugin, PluginManifest } from 'obsidian';
import { DEFAULT_SETTINGS, I18nSettings } from './settings/data';
import { I18nSettingTab } from './settings';
import { t } from './locales';

import { icons } from '~/utils';
import commands from './command';

import { APIManager, ViewManager, NoticeManager, StateManager, BackupManager, SourceManager, InjectorManager, CoreManager } from './manager';
import { info } from './utils';
import { OBThemeManifest, Contributor, NameTranslationJSON } from '~/types';

import { LoggerManager } from './manager/logger';

import { EditorView, EDITOR_VIEW_TYPE } from './views/plugin_editor/editor';
import { ThemeEditorView, THEME_EDITOR_VIEW_TYPE } from './views/theme_editor/editor';
import { useGlobalStoreInstance } from './utils';
import { AgreementView, AGREEMENT_VIEW_TYPE } from './views/agreement';
import { ManagerView, MANAGER_VIEW_TYPE } from './views/manager/manager-view';
import { CloudView, CLOUD_VIEW_TYPE } from './views/cloud/cloud-view';
import { WizardView, WIZARD_VIEW_TYPE } from './views/wizard';


// ==============================
//          [入口] I18n
// ==============================
/**
 * Obsidian 国际化翻译插件主类
 */
export default class I18N extends Plugin {
    settings: I18nSettings;     // [变量] 总配置文件1
    css: string;
    sharedStyleSheet?: CSSStyleSheet; // [变量] 构建好后被各视图共享的只读 CSSStyleSheet 对象
    // [核心管理器] - 插件功能模块协调中心
    notice: NoticeManager;      // [管理器] 通知管理器
    logger: LoggerManager;      // [管理器] 日志管理器
    view: ViewManager;          // [管理器] 视图管理器
    api: APIManager;            // [管理器] API管理器
    stateManager: StateManager; // [管理器] 状态管理器
    backupManager: BackupManager; // [管理器] 备份管理器
    sourceManager: SourceManager; // [管理器] 翻译源管理器 
    injectorManager: InjectorManager; // [管理器] 注入管理器 
    coreManager: CoreManager; // [管理器] 核心管理器

    // [变量] 插件贡献者缓存列表
    contributorCache: Contributor[] | undefined;

    // [变量][共享云端] 选中译文对象
    sharePath: string;
    shareType: number;
    shareObj: PluginManifest | OBThemeManifest;

    nameTranslationJSON: NameTranslationJSON;
    originalPluginsManifests: PluginManifest[];

    async onload() {
        info(this);                     // [加载] 插件信息
        icons();                        // [加载] 图标类
        commands(this.app, this);       // [加载] 指令类
        await this.loadSettings();      // [加载] 配置类

        this.initManagers();            // [初始化] 管理器

        this.coreManager.getCss();      // [加载] 样式类

        if (this.settings.agreement) {
            this.initViews();           // [初始化] 视图
            this.initCores();           // [初始化] 核心函数
            this.coreManager.setupRibbonIcons();    // [初始化] 功能区图标 1

            this.addSettingTab(new I18nSettingTab(this.app, this));
            // 初始化完成赋值全局I18N实例
            useGlobalStoreInstance.getState().setI18n(this);
        } else {
            // 注册并打开协议视图
            this.view.addView(AGREEMENT_VIEW_TYPE, (leaf) => new AgreementView(leaf, this), true);
            this.view.activateView(AGREEMENT_VIEW_TYPE);
        }
    }

    async onunload() {
        this.view.deactivateAllViews(); // 卸载所有视图
        if (this.settings.modeImt) this.coreManager.deactivateIMT();  // 卸载沉浸式翻译
    }

    // [配置类] 加载
    public async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
    // [配置类] 保存
    public async saveSettings() { await this.saveData(this.settings); }


    /**
     * 初始化核心管理器
     */
    private initManagers() {
        this.logger = LoggerManager.getInstance();
        this.notice = NoticeManager.getInstance(this);
        this.view = ViewManager.getInstance(this);
        this.api = APIManager.getInstance(this);
        this.stateManager = new StateManager(this);

        // @ts-ignore
        const i18nPluginDirBase = path.join(path.normalize(this.app.vault.adapter.getBasePath()), this.manifest.dir);
        this.backupManager = new BackupManager(i18nPluginDirBase);

        // [管理器] 翻译源管理器
        // @ts-ignore
        const i18nPluginDir = path.join(path.normalize(this.app.vault.adapter.getBasePath()), this.manifest.dir);
        this.sourceManager = new SourceManager(i18nPluginDir);

        // [管理器] 注入管理器
        this.injectorManager = new InjectorManager(this);

        // [管理器] 核心管理器
        this.coreManager = new CoreManager(this);
    }

    /**
     * 注册插件自定义视图
     */
    private initViews() {
        this.view.addView(EDITOR_VIEW_TYPE, (leaf) => new EditorView(leaf, this), true);
        this.view.addView(THEME_EDITOR_VIEW_TYPE, (leaf) => new ThemeEditorView(leaf, this), true);
        this.view.addView(CLOUD_VIEW_TYPE, (leaf) => new CloudView(leaf, this), true);
        this.view.addView(MANAGER_VIEW_TYPE, (leaf) => new ManagerView(leaf, this), true);
        this.view.addView(WIZARD_VIEW_TYPE, (leaf) => new WizardView(leaf, this), true);
    }

    private async initCores() {
        this.coreManager.firstRun();
        if (this.settings.checkUpdates) this.coreManager.checkUpdates(false);

        if (this.settings.automaticUpdate) await this.injectorManager.run(this.app, false);
        if (this.settings.modeImt) this.coreManager.activateIMT();
    }

    public async onAgreementAccepted() {
        this.initViews();           // [初始化] 视图
        await this.initCores();           // [初始化] 核心函数
        this.coreManager.setupRibbonIcons();    // [初始化] 功能区图标

        this.addSettingTab(new I18nSettingTab(this.app, this));
        // 初始化完成赋值全局I18N实例
        useGlobalStoreInstance.getState().setI18n(this);

        this.view.deactivateView(AGREEMENT_VIEW_TYPE);
        this.view.activateView(WIZARD_VIEW_TYPE);
    }

    /** 加载共享视图。 */
    public shareLoad(type: number, path: string, obj: PluginManifest | any) {
        this.shareType = type;
        this.sharePath = path;
        this.shareObj = obj;
    }
}
