import React from 'react';
import { ItemView, WorkspaceLeaf } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';
import I18N from '../../main';
import { ManagerLayout } from './manager-layout';
import { t } from '../../locales';
import { mountReactView } from '~/utils';

export const MANAGER_VIEW_TYPE = 'i18n-manager-view';

export class ManagerView extends ItemView {
    i18n: I18N;
    root: Root | null = null;
    shadowRoot: ShadowRoot | null = null;

    constructor(leaf: WorkspaceLeaf, i18n: I18N) {
        super(leaf);
        this.i18n = i18n;
    }

    getViewType(): string {
        return MANAGER_VIEW_TYPE;
    }

    getDisplayText(): string {
        return t('Manager.Titles.Main');
    }

    getIcon(): string {
        return 'layout-grid';
    }

    async onOpen() {
        const { root, shadowRoot } = mountReactView(
            this.contentEl,
            this.i18n,
            <ManagerLayout
                i18n={this.i18n}
                close={() => {
                    this.leaf.detach();
                }}
            />
        );
        this.root = root;
        this.shadowRoot = shadowRoot;
    }

    async onClose() {
        this.root?.unmount();
        if (this.shadowRoot) {
            this.shadowRoot.innerHTML = '';
        }
    }
}
