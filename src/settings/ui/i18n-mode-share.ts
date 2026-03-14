import { Setting, Notice } from "obsidian";
import BaseSetting from "../base-setting";
import { t } from "src/locales";
import { GitHubAPI } from "src/api/github";
import { useCloudStore } from "src/views/cloud/cloud-store";

// ==============================
//           个人云端同步
// ==============================
export default class I18nShare extends BaseSetting {
    main(): void {
        const { containerEl } = this;
        containerEl.empty();

        // ==============================
        //        1. 身份验证
        // ==============================
        containerEl.createEl('h2', { text: t('Settings.Share.AuthTitle') });

        // -- Access Token 配置 --
        const tokenSetting = new Setting(containerEl)
            .setName(t('Settings.Share.ModeTitle'))
            .setDesc(this.settings.shareToken ? `${t('Settings.Share.LoginSuccess')}` : t('Settings.Share.ModeDesc'));

        tokenSetting.addText(text => {
            text.setValue(this.settings.shareToken)
                .setPlaceholder(t('Settings.Share.TokenPlaceholder'))
                .onChange(async (value) => {
                    this.settings.shareToken = value.trim();
                    await this.i18n.saveSettings();
                });

            // 失焦触发静默验证
            text.inputEl.addEventListener('blur', async () => {
                const token = this.settings.shareToken;
                if (!token) return;

                tokenSetting.setDesc(t('Settings.Share.Verifying'));

                try {
                    const github = new GitHubAPI(this.i18n);
                    const res = await github.getUser();

                    if (res.state) {
                        const scopes = res.scopes || [];
                        const hasRepoScope = scopes.includes('public_repo') || scopes.includes('repo');

                        if (hasRepoScope) {
                            tokenSetting.setDesc(`${t('Settings.Share.LoginSuccess')}: @${res.data.login}`);
                            // 验证成功，重置云端状态以触发刷新
                            useCloudStore.getState().reset();
                        } else {
                            throw new Error(t('Settings.Share.VerifyInsufficient'));
                        }
                    } else {
                        throw new Error(t('Settings.Share.VerifyError'));
                    }
                } catch (e) {
                    new Notice(e.message || t('Settings.Share.VerifyError'));
                    this.settings.shareToken = '';
                    await this.i18n.saveSettings();
                    text.setValue('');
                    tokenSetting.setDesc(t('Settings.Share.ModeDesc'));
                }
            });
        });

        // -- 使用指引 --
        new Setting(containerEl)
            .setName(t('Settings.Share.TutorialTitle'))
            .setDesc(t('Settings.Share.TutorialTip'))
            .addButton(btn => btn
                .setButtonText(t('Wizard.Actions.Browse'))
                .onClick(() => {
                    window.open('https://github.com/settings/tokens/new?scopes=public_repo&description=Obsidian-i18n-Share');
                })
            );

        // ==============================
        //        2. 同步配置
        // ==============================
        containerEl.createEl('h2', { text: t('Settings.Share.SyncTitle') });

        new Setting(containerEl)
            .setName(t('Settings.Share.RepoTitle'))
            .setDesc(t('Settings.Share.RepoDesc'))
            .addText(text => {
                text.setValue(this.settings.shareRepo || 'obsidian-translations')
                    .setPlaceholder('obsidian-translations')
                    .onChange(async (value) => {
                        const trimmedValue = value.trim();
                        this.settings.shareRepo = trimmedValue;
                        await this.i18n.saveSettings();
                        // 同步更新云端管理页面的输入框状态
                        useCloudStore.getState().setRepoNameInput(trimmedValue);
                    });
            });

        // ==============================
        //        3. 账户管理
        // ==============================
        if (this.settings.shareToken) {
            containerEl.createEl('h2', { text: t('Settings.Share.AccountTitle') });
            new Setting(containerEl)
                .setName(t('Settings.Share.LogoutTitle'))
                .setDesc(t('Settings.Share.LogoutDesc'))
                .addButton(btn => btn
                    .setButtonText(t('Settings.Share.LogoutBtn'))
                    .onClick(async () => {
                        this.settings.shareToken = '';
                        this.settings.shareRepo = '';
                        await this.i18n.saveSettings();
                        // 注销登录，重置云端状态
                        useCloudStore.getState().reset();
                        this.display(); // 刷新页面
                        new Notice(t('Settings.Share.LogoutSuccess'));
                    })
                );
        }
    }
}
