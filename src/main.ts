import * as path from 'path';
import * as fs from 'fs-extra';
import './locales';     // 引入i18n配置

import { App, Plugin, PluginManifest } from 'obsidian';
import { DEFAULT_SETTINGS, I18nSettings, LLMProfile } from './settings/data';
import { LLM_PROVIDERS } from './ai/constants';
import { I18nSettingTab } from './settings';
import { t } from './locales';

import { icons } from '~/utils';
import commands from './command';

import { APIManager, ViewManager, NoticeManager, StateManager, BackupManager, SourceManager, InjectorManager, CoreManager, ExtractManager, AutoManager } from './manager';
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

import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { DevDebugCard } from './views/manager/dev-debug-card';

// ==============================
//          [入口] I18n
// ==============================
/**
 * Obsidian 国际化翻译插件主类
 */
export default class I18N extends Plugin {
    settings: I18nSettings;     // [变量] 总配置文件
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
    extractManager: ExtractManager; // [管理器] 提取助手管理器1
    autoManager: AutoManager; // [管理器] 自动化管理器
    activeSettingTab: string = 'basis'; // [变量] 当前设置页激活的选项卡

    private devRoot: ReactDOM.Root | null = null;


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

        if (process.env.DEV_MODE) {
            this.initDevDebug();
        }

        this.initManagers();            // [初始化] 管理器

        this.coreManager.getCss();      // [加载] 样式类

        if (this.settings.agreement) {
            this.initViews();           // [初始化] 视图
            this.initCores();           // [初始化] 核心函数
            this.coreManager.setupRibbonIcons();    // [初始化] 功能区图标 1

            useGlobalStoreInstance.getState().setI18n(this);
            this.addSettingTab(new I18nSettingTab(this.app, this));

            // [自动化] 注册定时扫描任务 (每 30 分钟检查一次是否到达设定的间隔)
            this.registerInterval(
                (window as any).setInterval(() => {
                    this.autoManager.checkAndRunDiscovery();
                }, 30 * 60 * 1000)
            );

            // 启动时延迟 30 秒执行一次增量检查 (避免拥塞启动过程)
            setTimeout(() => {
                this.autoManager.checkAndRunDiscovery();
            }, 30 * 1000);
        } else {
            // 注册并打开协议视图
            this.view.addView(AGREEMENT_VIEW_TYPE, (leaf) => new AgreementView(leaf, this), true);
            this.view.activateView(AGREEMENT_VIEW_TYPE);
        }
    }

    async onunload() {
        this.view.deactivateAllViews(); // 卸载所有视图
        if (this.settings.modeImt) this.coreManager.deactivateIMT();  // 卸载沉浸式翻译
        this.cleanupDevDebug();
    }

    // [配置类] 加载
    public async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

        // 旧版数字 ID 升级迁移
        if (typeof this.settings.llmApi === 'number') {
            const legacyApiMap: Record<number, string> = {
                1: 'openai', 2: 'gemini', 3: 'ollama', 4: 'deepseek', 5: 'zhipu', 
                6: 'moonshot', 7: 'aliyun', 8: 'baidu', 9: 'bytedance', 10: 'groq', 
                11: 'siliconflow', 12: 'openrouter', 13: 'deepinfra', 14: 'mistral', 
                15: 'minimax', 16: 'stepfun'
            };
            this.settings.llmApi = legacyApiMap[this.settings.llmApi as number] || 'openai';
            await this.saveSettings();
        }

        await this.migrateLLMProfiles();
    }
    // [配置类] 保存
    public async saveSettings() { await this.saveData(this.settings); }

    /**
     * 统一迁移所有旧版服务商配置到多 Profile 结构
     */
    private async migrateLLMProfiles() {
        let modified = false;

        Object.values(LLM_PROVIDERS).forEach(config => {
            const profilesField = `llm${config.labelKey}Profiles` as keyof I18nSettings;
            const activeIdField = `llm${config.labelKey}ActiveProfileId` as keyof I18nSettings;
            
            let profiles = this.settings[profilesField] as LLMProfile[];
            
            if (!profiles || profiles.length === 0) {
                const legacyUrlField = `llm${config.labelKey}Url` as keyof I18nSettings;
                const legacyKeyField = `llm${config.labelKey}Key` as keyof I18nSettings;
                const legacyModelField = `llm${config.labelKey}Model` as keyof I18nSettings;

                const defaultProfile: LLMProfile = {
                    id: 'default',
                    name: 'Default',
                    url: (this.settings[legacyUrlField] as string) || config.baseUrl || '',
                    key: (this.settings[legacyKeyField] as string) || '',
                    model: (this.settings[legacyModelField] as string) || config.defaultModel,
                    useCustomPrice: false,
                    priceInput: 0,
                    priceOutput: 0
                };
                
                (this.settings as any)[profilesField] = [defaultProfile];
                (this.settings as any)[activeIdField] = 'default';
                modified = true;
            } else {
                profiles.forEach(p => {
                    if (p.useCustomPrice === undefined) {
                        p.useCustomPrice = false;
                        p.priceInput = 0;
                        p.priceOutput = 0;
                        modified = true;
                    }
                });
            }

            // 删除旧字段，防止数据冗余并完成终极迭代 (使用 as any 将其从 settings 对象中彻底移除)
            const legacyUrlField = `llm${config.labelKey}Url`;
            const legacyKeyField = `llm${config.labelKey}Key`;
            const legacyModelField = `llm${config.labelKey}Model`;
            if ((this.settings as any)[legacyUrlField] !== undefined) { delete (this.settings as any)[legacyUrlField]; modified = true; }
            if ((this.settings as any)[legacyKeyField] !== undefined) { delete (this.settings as any)[legacyKeyField]; modified = true; }
            if ((this.settings as any)[legacyModelField] !== undefined) { delete (this.settings as any)[legacyModelField]; modified = true; }
        });

        // 清理全局冗余自定义价格字段
        if ((this.settings as any).llmUseCustomPrice !== undefined) { delete (this.settings as any).llmUseCustomPrice; modified = true; }
        if ((this.settings as any).llmPriceInputCustom !== undefined) { delete (this.settings as any).llmPriceInputCustom; modified = true; }
        if ((this.settings as any).llmPriceOutputCustom !== undefined) { delete (this.settings as any).llmPriceOutputCustom; modified = true; }

        if (modified) await this.saveSettings();
    }


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

        // [管理器] 自动化管理器
        this.autoManager = new AutoManager(this);

        // [管理器] 提取助手管理器 (暂时隐藏)
        // this.extractManager = new ExtractManager(this);
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
        if (this.settings.checkUpdates) this.coreManager.checkUpdates();

        if (this.settings.automaticUpdate) await this.injectorManager.run(this.app);
        await this.autoManager.initialize();
        if (this.settings.autoDiscovery) await this.autoManager.runDiscovery();
        if (this.settings.modeImt) this.coreManager.activateIMT();

        // [清理] 检查并清理已卸载插件的冗余备份与状态
        await this.stateManager.cleanupRemovedResources(this.app);
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

    private initDevDebug() {
        if (!process.env.DEV_MODE) return;
        const container = document.body.createDiv({ cls: 'i18n-dev-debug-container' });
        this.devRoot = ReactDOM.createRoot(container);
        this.devRoot.render(React.createElement(DevDebugCard, { i18n: this }));
    }

    private cleanupDevDebug() {
        if (this.devRoot) {
            this.devRoot.unmount();
            const container = document.body.querySelector('.i18n-dev-debug-container');
            if (container) container.remove();
            this.devRoot = null;
        }
    }
}
