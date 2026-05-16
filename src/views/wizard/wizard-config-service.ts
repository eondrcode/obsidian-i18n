/**
 * Wizard 配置服务
 * 
 * 目前使用硬编码配置
 */
import Url from 'src/constants/url';
import { WizardRemoteConfig } from '~/types';

/**
 * 硬编码的默认配置
 */
export const WIZARD_CONFIG: WizardRemoteConfig = {
    version: 1,
    sections: [
        {
            titleKey: 'Wizard.VideoTitle',
            items: [
                {
                    type: 'card',
                    icon: 'PlaySquare',
                    titleKey: 'Wizard.VideoTitle',
                    descriptionKey: 'Wizard.VideoDesc',
                    action: { type: 'url', value: Url.VIDEO_TUTORIAL },
                },
                {
                    type: 'card',
                    icon: 'BookOpen',
                    titleKey: 'Wizard.DocTitle',
                    descriptionKey: 'Wizard.DocDesc',
                    action: { type: 'url', value: Url.DOCUMENTATION_TUTORIAL },
                },
            ],
        },
        {
            titleKey: 'Wizard.CommunityLabel',
            titleSuffix: ' & ',
            titleKey2: 'Wizard.SupportLabel',
            items: [
                {
                    type: 'card',
                    icon: 'Users',
                    titleKey: 'Wizard.QqTitle',
                    descriptionKey: 'Wizard.QqDesc',
                    action: { type: 'url', value: 'https://qm.qq.com/cgi-bin/qm/qr?k=kHTS0iC1FC5igTXbdbKzff6_tc54mOF5&jump_from=webapi&authKey=AoSkriW+nDeDzBPqBl9jcpbAYkPXN2QRbrMh0hFbvMrGbqZyRAbJwaD6JKbOy4Nx' },
                },
                {
                    type: 'card',
                    icon: 'Discord',
                    titleKey: 'Wizard.DiscordTitle',
                    descriptionKey: 'Wizard.DiscordDesc',
                    action: { type: 'url', value: 'https://discord.gg/TZjRK6wZ' },
                },
                {
                    type: 'card',
                    icon: 'Github',
                    titleKey: 'Wizard.GithubTitle',
                    descriptionKey: 'Wizard.GithubDesc',
                    action: { type: 'url', value: 'https://github.com/eondrcode/obsidian-i18n/issues' },
                },
                {
                    type: 'card',
                    icon: 'Afdian',
                    titleKey: 'Wizard.AfdianTitle',
                    descriptionKey: 'Wizard.AfdianDesc',
                    action: { type: 'url', value: 'https://afdian.com/a/eondr' },
                },
                {
                    type: 'placeholder',
                    textKey: 'Wizard.MoreExpect',
                },
            ],
        },
    ],
};

/**
 * 获取 Wizard 配置（同步返回硬编码配置）
 */
export function getWizardConfig(): WizardRemoteConfig {
    return WIZARD_CONFIG;
}
