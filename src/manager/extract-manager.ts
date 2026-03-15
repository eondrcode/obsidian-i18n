import { App, Notice, PluginManifest } from 'obsidian';
import * as path from 'path';
import * as fs from 'fs-extra';
import I18N from '../main';
import { AstTranslator, RegexTranslator, StringPicker } from '../utils';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { ExtractWidget } from '../views/extract_assistant/extract-widget';
import { ExtractAssistantDialog } from '../views/plugin_editor/components/common/extract-assistant-dialog';
import { useRegexStore } from '../views/plugin_editor/store';

export class ExtractManager {
    private i18n: I18N;
    private widgetRoot: Root | null = null;
    private widgetContainer: HTMLDivElement | null = null;
    private isWidgetVisible: boolean = false;
    private isSearching: boolean = false;

    constructor(i18n: I18N) {
        this.i18n = i18n;
    }

    public toggleWidget() {
        if (this.isWidgetVisible) {
            this.hideWidget();
        } else {
            this.showWidget();
        }
    }

    public showWidget() {
        if (this.isWidgetVisible) return;

        this.widgetContainer = document.createElement('div');
        this.widgetContainer.id = 'i18n-extract-widget-container';
        document.body.appendChild(this.widgetContainer);

        this.widgetRoot = createRoot(this.widgetContainer);
        this.widgetRoot.render(
            React.createElement(ExtractWidget, {
                onPick: () => this.startPicking(),
                onClose: () => this.hideWidget()
            })
        );

        this.isWidgetVisible = true;
    }

    public hideWidget() {
        if (!this.isWidgetVisible) return;

        if (this.widgetRoot) {
            this.widgetRoot.unmount();
            this.widgetRoot = null;
        }

        if (this.widgetContainer) {
            this.widgetContainer.remove();
            this.widgetContainer = null;
        }

        this.isWidgetVisible = false;
    }

    private startPicking() {
        if (this.isSearching) {
            this.i18n.notice.info("Search is already in progress...");
            return;
        }
        const picker = new StringPicker(
            (text) => this.handlePickedText(text),
            () => console.log('Picking cancelled')
        );
        picker.activate();
    }

    private async handlePickedText(text: string) {
        if (this.isSearching) return;
        this.isSearching = true;

        // Open Dialog immediately with searching status
        const dialogControls = this.showResults(text, [], 'searching');

        try {
            const matches = await this.searchWithProgress(text);
            const status = matches.length > 0 ? 'success' : 'empty';
            dialogControls.updateProps({ matches, status });
        } catch (e) {
            console.error(e);
            dialogControls.updateProps({ status: 'error' });
        } finally {
            this.isSearching = false;
        }
    }

    private async searchWithProgress(text: string) {
        const allMatches: any[] = [];
        const app = this.i18n.app;

        // @ts-ignore
        const manifests = Object.values(app.plugins.manifests) as PluginManifest[];
        // @ts-ignore
        const basePath = path.normalize(app.vault.adapter.getBasePath());

        // Sort manifests to prioritize currently editing plugin
        const currentlyEditing = useRegexStore.getState().metadata?.plugin;
        const sortedManifests = [...manifests].sort((a, b) => {
            if (a.id === currentlyEditing) return -1;
            if (b.id === currentlyEditing) return 1;
            return 0;
        });

        const total = sortedManifests.length;
        let processed = 0;

        for (const manifest of sortedManifests) {
            if (manifest.id === 'i18n') continue;

            // Artificial delay every few plugins to keep UI responsive
            processed++;
            if (processed % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            const pluginDir = path.join(basePath, manifest.dir!);
            const files = ['main.js'];

            for (const file of files) {
                const filePath = path.join(pluginDir, file);
                if (fs.existsSync(filePath)) {
                    try {
                        const code = await fs.readFile(filePath, 'utf8');

                        // Regex Search (Fast)
                        const regexTranslator = new RegexTranslator(this.i18n.settings);
                        const regexMatches = regexTranslator.findString(text, code);
                        regexMatches.forEach(m => {
                            allMatches.push({ ...m, method: 'Regex', file, pluginId: manifest.id });
                        });

                        // AST Search (Only if file is reasonably small to avoid extreme slow-down)
                        if (code.length < 1000000) { // Limit to 1MB for AST
                            const astTranslator = new AstTranslator(this.i18n.settings);
                            const ast = astTranslator.loadCode(code);
                            if (ast) {
                                const astMatches = astTranslator.findString(text, ast);
                                astMatches.forEach(m => {
                                    allMatches.push({ ...m, method: 'AST', file, pluginId: manifest.id });
                                });
                            }
                        }
                    } catch (e) {
                        console.warn(`Failed to search in ${manifest.id}:`, e);
                    }
                }
            }
        }

        return allMatches;
    }

    private showResults(text: string, matches: any[], status: any = 'success') {
        let container = document.getElementById('i18n-extract-results-container') as HTMLDivElement;
        let root: Root;

        if (!container) {
            container = document.createElement('div');
            container.id = 'i18n-extract-results-container';
            document.body.appendChild(container);
            root = createRoot(container);
            (container as any)._root = root;
        } else {
            root = (container as any)._root;
        }

        const render = (props: any) => {
            root.render(
                React.createElement(ExtractAssistantDialog, {
                    isOpen: true,
                    onClose: () => {
                        root.unmount();
                        container.remove();
                    },
                    targetText: text,
                    onAdd: (match) => this.addToTranslation(match),
                    ...props
                })
            );
        };

        render({ matches, status });

        return {
            updateProps: (newProps: any) => render({ matches, status, ...newProps }),
            close: () => {
                root.unmount();
                container.remove();
            }
        };
    }

    private addToTranslation(match: any) {
        const { sourceManager, notice } = this.i18n;
        const source = sourceManager.getSource(match.pluginId);
        if (!source) {
            notice.error(`Could not find translation metadata for ${match.pluginId}`);
            return;
        }

        // Load current translation data
        const transPath = path.join(this.i18n.manifest.dir!, 'translations', `${match.pluginId}.json`);
        // We use SourceManager and IOManager logic here
        // For simplicity and correctness with the existing store:
        // If the editor is open for this plugin, we should update the store.

        const isCurrentlyEditing = useRegexStore.getState().metadata?.plugin === match.pluginId;

        if (isCurrentlyEditing) {
            const { addAstItem, addRegexItem, astItems, regexItems } = useRegexStore.getState();
            if (match.method === 'AST') {
                addAstItem({
                    id: astItems.length,
                    type: match.type,
                    name: match.name,
                    source: match.source,
                    target: match.source
                });
            } else {
                addRegexItem({
                    id: regexItems.length,
                    source: match.source,
                    target: match.source
                });
            }
            notice.success(`Added to current editor for ${match.pluginId}`);
        } else {
            // Persistent add to file if not open
            // This is more complex as we need to load, modify, and save the JSON
            notice.info(`Plugin ${match.pluginId} is not active in editor. Please open it first to add strings.`);
        }
    }
}
