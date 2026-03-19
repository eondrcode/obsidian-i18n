import BaseSetting from "../base-setting";
import { Setting, Notice, requestUrl } from "obsidian";
import { SUPPORTED_LANGUAGES } from '@/src/constants/languages';
import { t } from "src/locales";

export default class I18nBasis extends BaseSetting {
    main(): void {
        const headerClass = 'mt-6 mb-3 text-emerald-600 font-bold border-b border-emerald-600/10 pb-1.5 px-1';

        // 1. 检查更新 (Section 1)
        this.containerEl.createEl('h3', { text: t('Settings.Basis.HeaderUpdate'), cls: headerClass });

        new Setting(this.containerEl)
            .setName(t('Settings.Basis.UpdateTitle'))
            .setDesc(t('Settings.Basis.UpdateDesc'))
            .addButton(cb => {
                cb.setButtonText(t('Settings.Basis.UpdateBtn'))
                    .onClick(async () => {
                        await this.i18n.coreManager.applyUpdate();
                        this.settingTab.basisDisplay();
                    });
                if (!this.i18n.coreManager.updatesMark) {
                    cb.buttonEl.style.display = 'none';
                }
            })
            .addToggle(cb => cb
                .setValue(this.settings.checkUpdates)
                .onChange(async () => {
                    this.settings.checkUpdates = !this.settings.checkUpdates;
                    await this.i18n.saveSettings();
                    if (this.settings.checkUpdates) {
                        await this.i18n.coreManager.checkUpdates(true);
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

        // 2. 基础配置 (Section 2)
        this.containerEl.createEl('h3', { text: t('Settings.Basis.HeaderBasis'), cls: headerClass });

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

        // 3. 自动化任务 (Section 3 - Merged from i18n-auto.ts)
        this.containerEl.createEl('h3', { text: t('Settings.Basis.HeaderAuto'), cls: headerClass });

        new Setting(this.containerEl)
            .setName(t('Settings.Basis.AutoApplyTitle'))
            .setDesc(t('Settings.Basis.AutoApplyDesc'))
            .addToggle(cb => cb
                .setValue(this.settings.autoApply)
                .onChange(async (value) => {
                    this.settings.autoApply = value;
                    await this.i18n.saveSettings();
                })
            );

        new Setting(this.containerEl)
            .setName(t('Settings.Basis.AutoSilentTitle'))
            .setDesc(t('Settings.Basis.AutoSilentDesc'))
            .addToggle(cb => cb
                .setValue(this.settings.autoSilentMode)
                .onChange(async (value) => {
                    this.settings.autoSilentMode = value;
                    await this.i18n.saveSettings();
                })
            );

        new Setting(this.containerEl)
            .setName(t('Settings.Basis.AutoTrustedReposTitle'))
            .setDesc(t('Settings.Basis.AutoTrustedReposDesc'))
            .addTextArea(cb => cb
                .setPlaceholder(t('Settings.Basis.AutoTrustedReposPlaceholder'))
                .setValue(this.settings.autoTrustedRepos.join('\n'))
                .onChange(async (value) => {
                    this.settings.autoTrustedRepos = value.split('\n').map(v => v.trim()).filter(v => v.length > 0);
                    await this.i18n.saveSettings();
                })
            );

        // 4. 外部链接 (Section 4)
        this.containerEl.createEl('h3', { text: t('Settings.Basis.HeaderExternal'), cls: headerClass });

        new Setting(this.containerEl)
            .setName(t('Settings.Basis.ManagerTitle'))
            .setDesc(t('Settings.Basis.ManagerDesc'))
            .addButton((cb) => {
                cb.setButtonText(t('Settings.Basis.ManagerBtn'))
                    .onClick(() => {
                        window.open('https://github.com/eondrcode/obsidian-manager');
                    });
            });

        // 5. 网络配置
        this.containerEl.createEl('h3', { text: t('Settings.Basis.HeaderNetwork'), cls: headerClass });

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

    }
}
