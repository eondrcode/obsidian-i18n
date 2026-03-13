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

        if (hasChanges) {
            this.save();
        }
    }
}
