import { App, PluginManifest } from 'obsidian';
import * as path from 'path';
import * as fs from 'fs-extra';
import I18N from '../main';
import { loadTranslationFile } from '../manager/io-manager';
import { t } from '../locales';

export class InjectorManager {
    private i18n: I18N;

    constructor(i18n: I18N) {
        this.i18n = i18n;
    }

    /**
     * 自动更新翻译 (注入器)
     */
    public async run(app: App, isManual: boolean = false) {
        if (this.i18n.settings.automaticUpdate) {
            let plugins: PluginManifest[] = [];
            if (isManual) {
                this.i18n.notice.successPrefix(t('settings.local.smart_title'), t('settings.local.notice_checking'));
            }

            // @ts-ignore
            plugins = Object.values(app.plugins.manifests).filter(item => item.id !== 'i18n');
            let updateitem = 0;

            for (const plugin of plugins) {
                const state = this.i18n.stateManager.getPluginState(plugin.id);
                if (state && state.isApplied && plugin.version != state.pluginVersion) {
                    const success = await this.applyToPlugin(plugin.id);
                    if (success) updateitem++;
                }
            }
            if (updateitem > 0) {
                this.i18n.notice.successPrefix(t('settings.local.smart_title'), `${t('settings.local.notice_update')}${updateitem}${t('settings.local.notice_plugins')}`);
            } else if (isManual) {
                this.i18n.notice.successPrefix(t('settings.local.smart_title'), t('settings.local.notice_no_updates'));
            }
        }

        await this.i18n.stateManager.validateVersions(app);
    }

    /**
     * 对单个插件应用当前激活的翻译 (注入)
     * @param pluginId 插件ID
     * @returns 
     */
    public async applyToPlugin(pluginId: string): Promise<boolean> {
        // @ts-ignore
        const plugin = this.i18n.app.plugins.manifests[pluginId];
        if (!plugin) return false;

        // @ts-ignore
        const pluginDir = path.join(path.normalize(this.i18n.app.vault.adapter.getBasePath()), plugin.dir ?? '');

        try {
            // 1. 获取翻译器
            const astTranslator = this.i18n.coreManager.getAstTranslator();
            const regexTranslator = this.i18n.coreManager.getRegexTranslator();

            // 2. 读取译文
            const translationPath = this.i18n.sourceManager.getActiveSourcePath(plugin.id);
            if (!translationPath) return false;
            const translationJson = loadTranslationFile(translationPath);
            if (!translationJson || !translationJson.dict) return false;

            // 3. 基础备份 (如果尚未备份)
            // 注意：这里的备份是指对目标插件源码的备份，防止搞坏
            const files = Object.keys(translationJson.dict);
            await this.i18n.backupManager.createBackup(plugin.id, pluginDir, files);

            // 4. 应用翻译 (遍历 dict 里的所有文件)
            for (const [file, dict] of Object.entries(translationJson.dict as Record<string, any>)) {
                const targetFilePath = path.join(pluginDir, file);
                if (!fs.existsSync(targetFilePath)) continue;

                // 优先从备份读取原始内容，确保翻译是基于原始代码而非已翻译代码
                let fileString = await this.i18n.backupManager.getBackupContent(plugin.id, file);
                if (!fileString) {
                    fileString = fs.readFileSync(targetFilePath).toString();
                }

                // 应用 AST
                if (dict.ast && dict.ast.length > 0) {
                    const ast = astTranslator.loadCode(fileString);
                    if (ast) {
                        fileString = astTranslator.translate(ast, dict.ast);
                    }
                }

                // 应用 Regex
                if (dict.regex && dict.regex.length > 0) {
                    fileString = regexTranslator.translate(fileString, dict.regex);
                }

                // 5. 写入文件
                fs.writeFileSync(targetFilePath, fileString);
            }

            // 6. 更新状态文件
            this.i18n.stateManager.setPluginState(plugin.id, {
                id: plugin.id,
                isApplied: true,
                pluginVersion: plugin.version,
                translationVersion: translationJson.metadata?.version || '0.0.0'
            });

            // 7. 重启插件
            // @ts-ignore
            if (this.i18n.app.plugins.enabledPlugins.has(plugin.id)) {
                // @ts-ignore
                await this.i18n.app.plugins.disablePlugin(plugin.id);
                // @ts-ignore
                await this.i18n.app.plugins.enablePlugin(plugin.id);
                console.log(`[i18n] Successfully injected and reloaded: ${pluginId}`);
            } else {
                console.log(`[i18n] Injected but plugin is disabled: ${pluginId}`);
            }

            return true;
        } catch (error) {
            console.error(`[i18n] Failed to inject translation to ${pluginId}:`, error);
            return false;
        }
    }
}
