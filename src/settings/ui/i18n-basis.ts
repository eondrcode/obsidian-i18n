import BaseSetting from "../base-setting";
import { Setting, Notice, requestUrl, setIcon } from "obsidian";
import { SUPPORTED_LANGUAGES } from '@/src/constants/languages';
import { t } from "src/locales";
import { DEFAULT_SETTINGS } from "../data";

export default class I18nBasis extends BaseSetting {
    main(): void {

        // 1. 更新
        new Setting(this.containerEl).setHeading().setName(t('Settings.Basis.UpdateHeader'));

        new Setting(this.containerEl)
            .setName(t('Settings.Basis.UpdateTitle'))
            .setDesc(t('Settings.Basis.UpdateDesc'))
            .addToggle(cb => cb
                .setValue(this.settings.checkUpdates)
                .onChange(async () => {
                    this.settings.checkUpdates = !this.settings.checkUpdates;
                    await this.i18n.saveSettings();
                    if (this.settings.checkUpdates) {
                        await this.i18n.coreManager.checkUpdates();
                    } else {
                        this.i18n.coreManager.updatesMark = false;
                        this.i18n.coreManager.updatesVersion = '';
                    }
                    this.settingTab.basisDisplay();
                })
            );

        new Setting(this.containerEl)
            .setName(t('Settings.Basis.SmartUpdateTitle'))
            .setDesc(t('Settings.Basis.SmartUpdateDesc'))
            .addToggle((cb) =>
                cb
                    .setValue(this.settings.automaticUpdate)
                    .onChange(async (value) => {
                        this.settings.automaticUpdate = value;
                        await this.i18n.saveSettings();
                    })
            );

        // 2. 通用
        new Setting(this.containerEl).setHeading().setName(t('Settings.Basis.BasisHeader'));

        new Setting(this.containerEl)
            .setName(t('Settings.Basis.LangTitle'))
            .setDesc(t('Settings.Basis.LangDesc'))
            .addDropdown(cb => cb
                .addOptions(
                    Object.fromEntries(SUPPORTED_LANGUAGES.map(lang => [lang.value, lang.label]))
                )
                .setValue(this.settings.language)
                .onChange(async (value) => {
                    this.settings.language = value;
                    await this.i18n.saveSettings();
                })
            );

        new Setting(this.containerEl)
            .setName(t('Settings.Basis.AutoSaveTitle'))
            .setDesc(t('Settings.Basis.AutoSaveDesc'))
            .addToggle((cb) =>
                cb
                    .setValue(this.settings.autoSave)
                    .onChange(async (value) => {
                        this.settings.autoSave = value;
                        await this.i18n.saveSettings();
                    })
            );

        new Setting(this.containerEl)
            .setName(t('Settings.Basis.AuthorTitle'))
            .setDesc(t('Settings.Basis.AuthorDesc'))
            .addText(cb => cb
                .setPlaceholder(t('Settings.Basis.AuthorPlaceholder'))
                .setValue(this.settings.author)
                .onChange(async (value) => {
                    this.settings.author = value;
                    await this.i18n.saveSettings();
                })
            );


        // 3. 网络
        new Setting(this.containerEl).setHeading().setName(t('Settings.Basis.CloudHeader'));

        new Setting(this.containerEl)
            .setName(t('Settings.Basis.DefaultCloudRepoTitle'))
            .setDesc(t('Settings.Basis.DefaultCloudRepoDesc'))
            .addText(cb => cb
                .setPlaceholder(t('Settings.Basis.DefaultCloudRepoPlaceholder'))
                .setValue(this.settings.defaultCloudRepo)
                .onChange(async (value) => {
                    this.settings.defaultCloudRepo = value;
                    await this.i18n.saveSettings();
                })
            );

        const proxyOptions = {
            '': t('Settings.Basis.ProxyDirect'),
            'https://ghproxy.net/': t('Settings.Basis.ProxyNode2'),
            'https://gh-proxy.com/': t('Settings.Basis.ProxyNode5'),
            'https://cdn.jsdelivr.net/gh/': t('Settings.Basis.ProxyNode7'),
            'https://fastly.jsdelivr.net/gh/': t('Settings.Basis.ProxyNode8'),
            'https://gcore.jsdelivr.net/gh/': t('Settings.Basis.ProxyNode9'),
            'https://cdn.statically.io/gh/': t('Settings.Basis.ProxyNode10')
        };

        // 当 settings 保存的值不在现有选项中（例如原来填了 custom 的网址），退回直连
        let currentValue = this.settings.githubProxyUrl;
        if (!Object.keys(proxyOptions).includes(currentValue)) {
            currentValue = '';
        }

        new Setting(this.containerEl)
            .setName(t('Settings.Basis.GithubProxyTitle'))
            .setDesc(t('Settings.Basis.GithubProxyDesc'))
            .addDropdown(cb => cb
                .addOptions(proxyOptions)
                .setValue(currentValue)
                .onChange(async (value) => {
                    this.settings.githubProxyUrl = value;
                    await this.i18n.saveSettings();
                })
            )
            .addButton(cb => cb
                .setButtonText(t('Settings.Basis.ProxyTestBtn'))
                .setTooltip(t('Settings.Basis.ProxyTestTooltip'))
                .onClick(async () => {
                    cb.setButtonText(t('Settings.Basis.ProxyTesting'));
                    cb.buttonEl.disabled = true;

                    const targetUrl = 'https://raw.githubusercontent.com/eondrcode/obsidian-i18n/master/manifest.json';
                    const testUrl = this.i18n.api.github.wrapProxyUrl(targetUrl);

                    try {
                        const start = Date.now();
                        const res = await Promise.race([
                            requestUrl({ url: testUrl + '?t=' + start, method: 'GET' }),
                            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
                        ]);
                        const ms = Date.now() - start;
                        if (res.status === 200) {
                            new Notice(t('Settings.Basis.ProxyTestSuccess', { ms }));
                            cb.setButtonText(`${ms}ms`);
                            cb.buttonEl.style.color = 'var(--text-success)';
                        } else {
                            throw new Error('status ' + res.status);
                        }
                    } catch (e) {
                        new Notice(t('Settings.Basis.ProxyTestErrorNotice'));
                        cb.setButtonText(t('Settings.Basis.ProxyTestFail'));
                        cb.buttonEl.style.color = 'var(--text-error)';
                    }

                    setTimeout(() => {
                        cb.setButtonText(t('Settings.Basis.ProxyTestBtn'));
                        cb.buttonEl.disabled = false;
                        cb.buttonEl.style.color = '';
                    }, 3500);
                })
            );

        // 4. 自动化
        // new Setting(this.containerEl).setHeading().setName(t('Settings.Basis.AutoHeader'));

        // new Setting(this.containerEl)
        //     .setName(t('Settings.Basis.AutoTrustedReposTitle'))
        //     .setDesc(t('Settings.Basis.AutoTrustedReposDesc'))
        //     .addTextArea(cb => cb
        //         .setPlaceholder(t('Settings.Basis.AutoTrustedReposPlaceholder'))
        //         .setValue(this.settings.autoTrustedRepos.join('\n'))
        //         .onChange(async (value) => {
        //             this.settings.autoTrustedRepos = value.split('\n').map(v => v.trim()).filter(v => v.length > 0);
        //             await this.i18n.saveSettings();
        //         })
        //     );

        // 6. 重置
        new Setting(this.containerEl).setHeading().setName(t('Settings.Basis.ResetHeader'));

        new Setting(this.containerEl)
            .setName(t('Settings.Basis.ResetTitle'))
            .setDesc(t('Settings.Basis.ResetDesc'))
            .addButton(cb => cb
                .setButtonText(t('Settings.Basis.ResetBtn'))
                .setWarning()
                .onClick(async () => {
                    if (window.confirm(t('Settings.Basis.ResetConfirm'))) {
                        // 重置配置 (深拷贝默认配置，避免引用污染)
                        Object.assign(this.settings, JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
                        await this.i18n.saveSettings();
                        new Notice(t('Settings.Basis.ResetSuccess'));
                        // 强制重新渲染整个设置面板
                        this.settingTab.display();
                    }
                })
            );


        // 5. 推荐
        new Setting(this.containerEl).setHeading().setName(t('Settings.Basis.ExternalHeader'));

        const card = this.containerEl.createDiv({ cls: 'i18n-recommend-card' });
        card.style.border = '1px solid var(--background-modifier-border)';
        card.style.borderRadius = '8px';
        card.style.padding = '16px';
        card.style.margin = '10px 0';
        card.style.backgroundColor = 'var(--background-secondary)';
        card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';

        const cardHeader = card.createDiv();
        cardHeader.style.display = 'flex';
        cardHeader.style.alignItems = 'center';
        cardHeader.style.gap = '10px';
        cardHeader.style.marginBottom = '8px';

        const iconContainer = cardHeader.createDiv();
        iconContainer.style.color = 'var(--text-accent)';
        setIcon(iconContainer, 'blocks');

        const titleEl = cardHeader.createEl('b', {
            text: t('Settings.Basis.ManagerTitle'),
            cls: 'text-lg font-semibold'
        });
        titleEl.style.color = 'var(--text-normal)';

        const descEl = card.createDiv({
            text: t('Settings.Basis.ManagerDesc'),
            cls: 'setting-item-description'
        });
        descEl.style.margin = '0';
        descEl.style.marginBottom = '12px';
        descEl.style.lineHeight = '1.6';
        descEl.style.fontSize = '0.9em';

        const footer = card.createDiv();
        footer.style.display = 'flex';
        footer.style.justifyContent = 'flex-end';

        const btn = footer.createEl('button', {
            text: t('Settings.Basis.ManagerBtn'),
            cls: 'mod-cta'
        });
        btn.style.backgroundColor = 'var(--interactive-accent)';
        btn.style.color = 'white';
        btn.onclick = () => {
            window.open('obsidian://show-plugin?id=better-plugins-manager');
        };


    }
}
