import { ItemView, WorkspaceLeaf } from 'obsidian';
import { Root } from 'react-dom/client';
import I18N from '~/main';
import { Agreement } from './agreement';
import { mountReactView } from '~/utils';

import { t } from '~/locales';

export const AGREEMENT_VIEW_TYPE = 'agreement-view';

export class AgreementView extends ItemView {
    root: Root | null = null;
    i18n: I18N;
    shadowRoot: ShadowRoot | null = null;

    constructor(leaf: WorkspaceLeaf, i18n: I18N) {
        super(leaf);
        this.i18n = i18n;
    }

    getViewType() {
        return AGREEMENT_VIEW_TYPE;
    }

    getDisplayText() {
        return t('Agreement.Titles.Tab');
    }

    getIcon() {
        return "file-text";
    }

    async onOpen() {
        const { root, shadowRoot } = mountReactView(
            this.contentEl,
            this.i18n,
            <Agreement view={this} />
        );
        this.root = root;
        this.shadowRoot = shadowRoot;
    }

    async onClose() {
        this.root?.unmount();
        if (this.shadowRoot) this.shadowRoot.innerHTML = '';
    }
}
