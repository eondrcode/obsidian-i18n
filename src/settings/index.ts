import { App, PluginSettingTab } from 'obsidian';
import I18N from "../main";

import I18nBasis from './ui/i18n-basis';
import I18nModIMT from './ui/i18n-mode-imt';
import I18nLLM from './ui/i18n-llm';
import I18nLLMOpenAI from './ui/i18n-llm-openai';
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
        // 注意：由于 display() 频繁调用，我们需要确保旧的 observer 被清理
        if ((containerEl as any)._darkObserver) {
            (containerEl as any)._darkObserver.disconnect();
        }
        (containerEl as any)._darkObserver = observer;

        // 基础布局：全屏、垂直伸缩
        containerEl.addClass('i18n-settings-wrapper', 'flex', 'flex-col', 'w-full', 'h-full', 'pb-4', 'text-[13px]');

        // 顶层导航容器 (卡片式)
        const tabsWrapper = containerEl.createEl('div');
        tabsWrapper.addClass('flex', 'p-1', 'bg-muted/40', 'rounded-xl', 'border', 'border-border/30', 'mb-6', 'self-start');

        // 内容区容器
        this.contentEl = containerEl.createEl('div');
        this.contentEl.addClass('flex-1', 'overflow-y-auto', 'px-1', 'custom-scrollbar');

        const navItems = [
            { id: 'basis', text: t('Settings.Tabs.Basis'), icon: '', content: () => this.basisDisplay() },
            { id: 're', text: t('Settings.Tabs.Re'), icon: '', content: () => this.reDisplay() },
            { id: 'ast', text: t('Settings.Tabs.Ast'), icon: '', content: () => this.astDisplay() },
            { id: 'immersive', text: t('Settings.Tabs.Immersive'), icon: '', content: () => this.imtDisplay() },
            { id: 'ai', text: t('Settings.Tabs.Ai'), icon: '', content: () => this.llmDisplay() },
            { id: 'share', text: t('Settings.Tabs.Share'), icon: '', content: () => this.shareDisplay() },
        ];

        const navItemEls: HTMLDivElement[] = [];
        const activeItemClass = ['bg-background', 'text-emerald-600', 'shadow-sm', 'ring-1', 'ring-border/50'];
        const inactiveItemClass = ['text-muted-foreground', 'hover:text-foreground', 'hover:bg-background/40'];
        const baseItemClass = ['flex', 'items-center', 'gap-2', 'px-4', 'py-1.5', 'rounded-lg', 'cursor-pointer', 'transition-all', 'duration-300', 'font-medium', 'text-[12.5px]'];

        navItems.forEach((item, index) => {
            const itemEl = tabsWrapper.createEl('div');
            itemEl.addClass(...baseItemClass);

            // 图标
            const iconEl = itemEl.createEl('span');
            iconEl.textContent = item.icon;
            iconEl.addClass('text-[14px]', 'opacity-80');

            // 文本
            const textEl = itemEl.createEl('span');
            textEl.textContent = item.text;

            navItemEls.push(itemEl);

            if (index === 0) {
                itemEl.addClass(...activeItemClass);
                item.content();
            } else {
                itemEl.addClass(...inactiveItemClass);
            }

            itemEl.addEventListener('click', () => {
                navItemEls.forEach(el => {
                    el.removeClass(...activeItemClass);
                    el.addClass(...inactiveItemClass);
                });
                itemEl.removeClass(...inactiveItemClass);
                itemEl.addClass(...activeItemClass);
                item.content();
            });
        });
    }
    basisDisplay() { this.contentEl.empty(); new I18nBasis(this).display(); }
    llmDisplay() { this.contentEl.empty(); new I18nLLM(this).display(); new I18nLLMOpenAI(this).display(); }
    imtDisplay() { this.contentEl.empty(); new I18nModIMT(this).display(); }
    shareDisplay() { this.contentEl.empty(); new I18nShare(this).display(); }
    reDisplay() { this.contentEl.empty(); new I18nRE(this).display(); }
    astDisplay() { this.contentEl.empty(); new I18nAST(this).display(); }
}

export { I18nSettingTab };
