import { App, PluginManifest } from 'obsidian';
import * as path from 'path';
import * as fs from 'fs-extra';
import { IState } from '../types';
import I18N from '../main';
import { debounce } from 'obsidian';

interface StateStorage {
    plugins: Record<string, IState>;
    themes: Record<string, IState>;
}

export class StateManager {
    private plugin: I18N;
    private path: string;
    private data: StateStorage = { plugins: {}, themes: {} };

    constructor(plugin: I18N) {
        this.plugin = plugin;
        // @ts-ignore
        const basePath = this.plugin.app.vault.adapter.getBasePath();
        this.path = path.join(basePath, this.plugin.manifest.dir || '', 'states.json');
        this.load();
    }

    private load() {
        if (fs.pathExistsSync(this.path)) {
            try {
                this.data = fs.readJsonSync(this.path);
                // Ensure structure integrity
                if (!this.data.plugins) this.data.plugins = {};
                if (!this.data.themes) this.data.themes = {};
            } catch (e) {
                console.error('Failed to load translation states:', e);
                this.data = { plugins: {}, themes: {} };
            }
        }
    }

    private save = debounce(() => {
        try {
            fs.outputJsonSync(this.path, this.data, { spaces: 4 });
        } catch (e) {
            console.error('Failed to save translation states:', e);
        }
    }, 1000, true);

    // --- Plugin State Operations ---

    public getPluginState(id: string): IState | undefined {
        return this.data.plugins[id];
    }

    public setPluginState(id: string, state: IState) {
        this.data.plugins[id] = state;
        this.save();
    }

    public deletePluginState(id: string) {
        if (this.data.plugins[id]) {
            delete this.data.plugins[id];
            this.save();
        }
    }

    /**
     * 清理所有状态记录
     */
    public clearAllStates() {
        this.data = { plugins: {}, themes: {} };
        this.save();
    }

    public getAllPluginStates(): Record<string, IState> {
        return this.data.plugins || {};
    }

    public getAllThemeStates(): Record<string, IState> {
        return this.data.themes || {};
    }

    // --- Theme State Operations (Reserved/Future) ---

    public getThemeState(name: string): IState | undefined {
        return this.data.themes[name];
    }

    public setThemeState(name: string, state: IState) {
        this.data.themes[name] = state;
        this.save();
    }

    public deleteThemeState(name: string) {
        if (this.data.themes[name]) {
            delete this.data.themes[name];
            this.save();
        }
    }

    // --- Core Logic ---

    /**
     * Checks if the installed plugins have been updated.
     * If a plugin's version is newer than the stored state version, 
     * it means the main.js has been overwritten (reverted to English).
     * We must update the state to reflect this (isApplied = false).
     */
    public async validateVersions(app: App) {
        // @ts-ignore
        const manifests: PluginManifest[] = Object.values(app.plugins.manifests);
        let hasChanges = false;

        for (const manifest of manifests) {
            const state = this.getPluginState(manifest.id);
            // If we have a state record, check version
            if (state) {
                // If current version is technically "newer" or different, we assume update
                // Simple string inequality check might be enough, but usually we care if current != stored
                // If stored version is different from manifest version AND state says it's applied
                if (state.pluginVersion !== manifest.version) {
                    if (state.isApplied) {
                        state.isApplied = false;
                        state.pluginVersion = manifest.version;
                        hasChanges = true;
                    } else {
                        // Even if not applied, update version to match current? 
                        // Maybe not strictly necessary strictly, but good for keeping track.
                        state.pluginVersion = manifest.version;
                        hasChanges = true;
                    }
                }
            }
        }

        // Check themes
        try {
            // @ts-ignore
            const basePath = app.vault.adapter.getBasePath ? path.normalize(app.vault.adapter.getBasePath()) : '';
            if (basePath) {
                const themesDir = path.join(basePath, app.vault.configDir, 'themes');
                if (fs.existsSync(themesDir)) {
                    const entries = fs.readdirSync(themesDir, { withFileTypes: true });
                    for (const entry of entries) {
                        if (!entry.isDirectory()) continue;
                        const themeId = entry.name;
                        const manifestPath = path.join(themesDir, themeId, 'manifest.json');
                        let currentVersion = '0.0.0';
                        if (fs.existsSync(manifestPath)) {
                            try {
                                const themeManifest = fs.readJsonSync(manifestPath);
                                if (themeManifest && themeManifest.version) {
                                    currentVersion = themeManifest.version;
                                }
                            } catch (e) { }
                        }

                        const state = this.getThemeState(themeId);
                        if (state) {
                            if (state.pluginVersion !== currentVersion) {
                                state.isApplied = false;
                                state.pluginVersion = currentVersion;
                                hasChanges = true;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[i18n] Failed to validate theme versions', error);
        }

        if (hasChanges) {
            this.save();
        }
    }

    /**
     * 清理已卸载插件/主题的冗余数据
     */
    public async cleanupRemovedResources(app: App) {
        // @ts-ignore
        const manifests = app.plugins.manifests;
        let hasChanges = false;

        // 1. 处理插件
        const pluginIds = Object.keys(this.data.plugins);
        for (const id of pluginIds) {
            if (!manifests[id]) {
                // 插件已卸载
                const state = this.data.plugins[id];

                // 如果是已应用状态，先尝试还原 (还原操作内部会处理备份文件的删除)
                if (state.isApplied && this.plugin.backupManager.hasBackup(id)) {
                    // @ts-ignore
                    const basePath = app.vault.adapter.getBasePath ? path.normalize(app.vault.adapter.getBasePath()) : '';
                    const pluginDir = path.join(basePath, app.vault.configDir, 'plugins', id);

                    try {
                        await this.plugin.backupManager.restoreBackup(id, pluginDir);
                        console.log(`[i18n] Restored and cleaned up backup for uninstalled plugin: ${id}`);
                    } catch (e) {
                        console.error(`[i18n] Failed to restore backup for uninstalled plugin ${id}:`, e);
                        // 如果还原失败，仍然尝试直接删除备份
                        await this.plugin.backupManager.removeBackup(id);
                    }
                } else {
                    // 如果没应用或没备份，直接删除可能残留的备份文件
                    await this.plugin.backupManager.removeBackup(id);
                }

                delete this.data.plugins[id];
                hasChanges = true;
                console.log(`[i18n] Cleaned up state for uninstalled plugin: ${id}`);
            }
        }

        // 2. 处理主题
        const themeIds = Object.keys(this.data.themes);
        for (const id of themeIds) {
            // @ts-ignore
            const basePath = app.vault.adapter.getBasePath ? path.normalize(app.vault.adapter.getBasePath()) : '';
            if (!basePath) continue;

            const themeDir = path.join(basePath, app.vault.configDir, 'themes', id);
            if (!fs.existsSync(themeDir)) {
                // 主题文件夹已不存在
                const state = this.data.themes[id];

                // 主题暂不支持 restoreBackup 这种多文件还原逻辑（BackupManager 目前的主题逻辑较简单）
                // 但为了统一，如果未来支持了可以加在这里。目前直接删除备份。
                await this.plugin.backupManager.removeBackup(id);

                delete this.data.themes[id];
                hasChanges = true;
                console.log(`[i18n] Cleaned up state and backup for deleted theme: ${id}`);
            }
        }

        if (hasChanges) {
            this.save();
        }
    }
}
