import { App, PluginManifest } from 'obsidian';
import * as path from 'path';
import * as fs from 'fs-extra';
import I18N from '../main';
import { AstTranslator, RegexTranslator } from '../utils';
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
                // @ts-ignore
                const pluginDir = path.join(path.normalize(app.vault.adapter.getBasePath()), plugin.dir ?? '');
                const state = this.i18n.stateManager.getPluginState(plugin.id);

                if (state && state.isApplied && plugin.version != state.pluginVersion) {
                    try {
                        updateitem = updateitem + 1;

                        // 1. 清理旧备份
                        await this.i18n.backupManager.removeBackup(plugin.id);

                        // 2. 读取译文
                        const translationPath = this.i18n.sourceManager.getActiveSourcePath(plugin.id);
                        if (!translationPath) continue;
                        const translationJson = loadTranslationFile(translationPath);
                        if (!translationJson) continue;

                        // 3. 创建新备份
                        if (translationJson.dict) {
                            const files = Object.keys(translationJson.dict);
                            await this.i18n.backupManager.createBackup(plugin.id, pluginDir, files);

                            // 5. 应用翻译 (遍历 dict 里的所有文件)
                            for (const [file, dict] of Object.entries(translationJson.dict as Record<string, any>)) {
                                const targetFilePath = path.join(pluginDir, file);
                                if (!fs.existsSync(targetFilePath)) continue;

                                let fileString = fs.readFileSync(targetFilePath).toString();

                                // 应用 AST
                                if (dict.ast && dict.ast.length > 0) {
                                    const astTranslator = new AstTranslator(this.i18n.settings);
                                    const ast = astTranslator.loadCode(fileString);
                                    if (ast) {
                                        fileString = astTranslator.translate(ast, dict.ast);
                                    }
                                }

                                // 应用 Regex
                                if (dict.regex && dict.regex.length > 0) {
                                    const regexTranslator = new RegexTranslator(this.i18n.settings);
                                    fileString = regexTranslator.translate(fileString, dict.regex);
                                }

                                // 6. 写入文件
                                fs.writeFileSync(targetFilePath, fileString);
                            }
                        }

                        // 7. 更新状态文件
                        this.i18n.stateManager.setPluginState(plugin.id, {
                            id: plugin.id,
                            isApplied: true,
                            pluginVersion: plugin.version,
                            translationVersion: translationJson.metadata?.version || '0.0.0'
                        });

                        // 8. 重启插件
                        // @ts-ignore
                        if (app.plugins.enabledPlugins.has(plugin.id)) {
                            // @ts-ignore
                            await this.i18n.app.plugins.disablePlugin(plugin.id);
                            // @ts-ignore
                            await this.i18n.app.plugins.enablePlugin(plugin.id);
                        }

                    } catch (error) {
                        this.i18n.notice.error(t('settings.local.smart_title'), error);
                    }
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
}
