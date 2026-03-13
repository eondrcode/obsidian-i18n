import { PluginManifest } from 'obsidian';
import * as path from 'path';
import * as fs from 'fs-extra';
import { t } from '../locales';
import I18N from '../main';
import { activateIMT, deactivateIMT } from '../utils';
import { MANAGER_VIEW_TYPE } from '../views/manager/manager-view';

export class CoreManager {
    private i18n: I18N;

    // [更新相关] - 插件版本更新状态
    updatesMark = false;        // [变量] 是否存在更新标记
    updatesVersion: string;     // [变量] 更新版本
    latestRelease: any;         // [变量] 最新 Release 数据


    // [变量] 样式
    css: string;

    i18nReviewEl: HTMLElement;

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

    public async checkUpdates(isManual: boolean = false) {
        // 使用 GitHub API 获取最新 Release
        const owner = 'eondrcode'; // 插件所有者
        const repo = 'obsidian-i18n'; // 插件仓库名
        const res = await this.i18n.api.github.getLatestRelease(owner, repo);

        if (res.state) {
            const latestVersion = res.data.tag_name.replace(/^v/, '');
            if (this.i18n.manifest.version !== latestVersion) {
                const noticeStr = `${t('func.check_update_notice')}(${latestVersion})\n${res.data.body || ''}`;
                this.i18n.notice.primaryPrefix(t('func.check_update_prefix'), noticeStr, 15000);

                // 添加点击更新功能（如果 NoticeManager 支持或通过设置界面触发）
                this.updatesMark = true;
                this.updatesVersion = latestVersion;
                this.latestRelease = res.data; // 暂存最新 Release 数据以供下载
            } else if (isManual) {
                this.i18n.notice.successPrefix(t('func.check_update_prefix'), t('common.is_latest'));
            }
        } else if (isManual) {
            this.i18n.notice.resultPrefix(t('func.check_update_prefix'), false, String(res.data));
        }
    }

    /**
     * 应用更新：下载并覆盖插件文件
     */
    public async applyUpdate() {
        if (!this.latestRelease) {
            this.i18n.notice.error(t('common.no_updates_found'));
            return;
        }

        this.i18n.notice.info(t('common.updating'));
        try {
            const assets = this.latestRelease.assets;
            const filesToDownload = ['main.js', 'manifest.json', 'styles.css'];

            // @ts-ignore
            const pluginDir = path.join(path.normalize(this.i18n.app.vault.adapter.getBasePath()), this.i18n.manifest.dir);

            for (const fileName of filesToDownload) {
                const asset = assets.find((a: any) => a.name === fileName);
                if (asset) {
                    const downloadRes = await this.i18n.api.github.downloadAsset(asset.browser_download_url);
                    if (downloadRes.state) {
                        const targetPath = path.join(pluginDir, fileName);
                        // 如果是编译后的 JS 或 CSS，通常是文本或二进制
                        const content = downloadRes.data;
                        if (content instanceof ArrayBuffer) {
                            await fs.writeFile(targetPath, Buffer.from(content));
                        } else {
                            await fs.writeFile(targetPath, content);
                        }
                    }
                }
            }

            this.i18n.notice.success(t('common.update_success_restart'));
            this.updatesMark = false;
        } catch (error) {
            this.i18n.notice.error(`${t('common.update_failed')}: ${error}`);
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

}
