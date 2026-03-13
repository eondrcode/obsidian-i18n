
import React from 'react';
import { ItemView, WorkspaceLeaf } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';
import I18N from 'src/main';
import { Wizard } from './wizard';
import { mountReactView } from '~/utils';
import { t } from '../../locales';

export const WIZARD_VIEW_TYPE = 'wizard-view';


export class WizardView extends ItemView {
    root: Root | null = null;
    i18n: I18N;
    shadowRoot: ShadowRoot | null = null;

    constructor(leaf: WorkspaceLeaf, i18n: I18N) {
        super(leaf);
        this.i18n = i18n;
    }

    getViewType() {
        return WIZARD_VIEW_TYPE;
    }

    getDisplayText() {
        return t('Wizard.Titles.Main');
    }

    getIcon() {
        return "sparkles";
    }

    async onOpen() {
        const { root, shadowRoot } = mountReactView(
            this.contentEl,
            this.i18n,
            <Wizard />
        );
        this.root = root;
        this.shadowRoot = shadowRoot;
    }

    async onClose() {
        this.root?.unmount();
        if (this.shadowRoot) this.shadowRoot.innerHTML = '';
    }
}
