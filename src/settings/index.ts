import { App, PluginSettingTab, setIcon } from 'obsidian';
import I18N from "../main";

import I18nBasis from './ui/i18n-basis';
import I18nModIMT from './ui/i18n-mode-imt';
import I18nLLM from './ui/i18n-llm';
import I18nLLMGeneric from './ui/i18n-llm-generic';
import I18nRE from './ui/i18n-re';
import I18nAST from './ui/i18n-ast';
import I18nShare from './ui/i18n-mode-share';
import { t } from 'src/locales';

class I18nSettingTab extends PluginSettingTab {
    i18n: I18N;
    app: App;
    contentEl: HTMLDivElement;

    constructor(app: App, i18n: I18N) {
        super(app, i18n);
        this.i18n = i18n;
        this.app = app;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // [暗色模式同步] 同步 Obsidian 主题到 Tailwind .dark 类
        const syncDark = () => {
            const isDark = document.body.classList.contains('theme-dark');
            containerEl.classList.toggle('dark', isDark);
        };
        syncDark();

        // 监听主题变化
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    syncDark();
                }
            }
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

        // 确保在设置页面重新渲染或关闭时断开观察器 (Obsidian 每次 display 都会清空并重建)
        if ((containerEl as any)._darkObserver) {
            (containerEl as any)._darkObserver.disconnect();
        }
        (containerEl as any)._darkObserver = observer;

        // 基础布局：全屏、垂直伸缩
        containerEl.addClass('i18n-settings-wrapper', 'flex', 'flex-col', 'w-full', 'h-full', 'pb-4');

        // 注入响应式样式，防止文字竖排，空间过小时仅保留图标
        const styleEl = containerEl.createEl('style');
        styleEl.textContent = `
            .i18n-settings-nav-item {
                white-space: nowrap;
                flex-shrink: 0;
            }
            @media (max-width: 750px) {
                .i18n-settings-nav-text { display: none; }
                .i18n-settings-nav-item { padding: 6px 14px !important; gap: 0 !important; justify-content: center; }
            }
        `;

        // 顶层导航容器 (仿 OB 原生导航条)
        const tabsWrapper = containerEl.createEl('div');
        tabsWrapper.addClass('flex', 'p-1', 'bg-transparent', 'mb-6', 'self-start', 'gap-1', 'overflow-x-auto', 'custom-scrollbar');
        tabsWrapper.style.backgroundColor = 'var(--background-modifier-form-field)';
        tabsWrapper.style.borderRadius = 'var(--radius-m)';
        tabsWrapper.style.maxWidth = '100%';

        // 内容区容器
        this.contentEl = containerEl.createEl('div');
        this.contentEl.addClass('flex-1', 'overflow-y-auto', 'px-1', 'custom-scrollbar');

        const navItems = [
            { id: 'basis', text: t('Settings.Tabs.Basis'), icon: 'settings', content: () => this.basisDisplay() },
            { id: 're', text: t('Settings.Tabs.Re'), icon: 'search-code', content: () => this.reDisplay() },
            { id: 'ast', text: t('Settings.Tabs.Ast'), icon: 'code-2', content: () => this.astDisplay() },
            { id: 'immersive', text: t('Settings.Tabs.Immersive'), icon: 'languages', content: () => this.imtDisplay() },
            { id: 'ai', text: t('Settings.Tabs.Ai'), icon: 'sparkles', content: () => this.llmDisplay() },
            { id: 'share', text: t('Settings.Tabs.Share'), icon: 'share-2', content: () => this.shareDisplay() },
        ];

        const navItemEls: HTMLDivElement[] = [];

        // 样式定义
        const applyStyles = (el: HTMLElement, isActive: boolean) => {
            el.className = 'i18n-settings-nav-item flex items-center gap-2 px-4 py-1.5 cursor-pointer transition-all duration-200 font-medium text-[13px]';
            el.style.borderRadius = 'var(--radius-s)';

            if (isActive) {
                el.style.backgroundColor = 'var(--background-primary)';
                el.style.color = 'var(--text-normal)';
                el.style.boxShadow = 'var(--shadow-s)';
                el.style.border = 'none';
            } else {
                el.style.backgroundColor = 'transparent';
                el.style.color = 'var(--text-muted)';
                el.style.border = 'none';
                el.style.boxShadow = 'none';

                // Hover 效果 (通过 JS 模拟)
                el.onmouseenter = () => { if (this.i18n.activeSettingTab !== el.dataset.id) el.style.backgroundColor = 'var(--background-modifier-hover)'; };
                el.onmouseleave = () => { if (this.i18n.activeSettingTab !== el.dataset.id) el.style.backgroundColor = 'transparent'; };
            }
        };

        navItems.forEach((item) => {
            const itemEl = tabsWrapper.createEl('div');
            itemEl.dataset.id = item.id;

            // 图标容器
            const iconEl = itemEl.createEl('span', { cls: 'nav-icon flex items-center shrink-0' });
            setIcon(iconEl, item.icon);

            // 文本容器
            const textEl = itemEl.createEl('span', { text: item.text, cls: 'i18n-settings-nav-text' });

            navItemEls.push(itemEl);

            const isActive = item.id === this.i18n.activeSettingTab;
            applyStyles(itemEl, isActive);

            if (isActive) item.content();

            itemEl.addEventListener('click', () => {
                this.i18n.activeSettingTab = item.id;
                navItemEls.forEach(el => {
                    const it = navItems.find(n => n.id === el.dataset.id);
                    applyStyles(el, el.dataset.id === item.id);
                });
                item.content();
            });
        });
    }
    basisDisplay() { this.contentEl.empty(); new I18nBasis(this).display(); }
    llmDisplay() {
        this.contentEl.empty();
        new I18nLLM(this).display();

        const llmApi = this.i18n.settings.llmApi;
        // 渲染通用配置组件
        if (llmApi) {
            new I18nLLMGeneric(this).display();
        }
    }
    imtDisplay() { this.contentEl.empty(); new I18nModIMT(this).display(); }
    shareDisplay() { this.contentEl.empty(); new I18nShare(this).display(); }
    reDisplay() { this.contentEl.empty(); new I18nRE(this).display(); }
    astDisplay() { this.contentEl.empty(); new I18nAST(this).display(); }
}

export { I18nSettingTab };
