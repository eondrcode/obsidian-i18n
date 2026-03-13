/**
 * Wizard 配置服务
 * 
 * 目前使用硬编码配置
 */
import { WizardRemoteConfig } from '~/types';

/**
 * 硬编码的默认配置
 */
export const WIZARD_CONFIG: WizardRemoteConfig = {
    version: 1,
    sections: [
        {
            titleKey: 'Wizard.Titles.Video',
            items: [
                {
                    type: 'card',
                    icon: 'PlaySquare',
                    titleKey: 'Wizard.Titles.Video',
                    descriptionKey: 'Wizard.Hints.VideoDesc',
                    action: { type: 'url', value: 'https://www.bilibili.com/video/BV1VcxJeNExx/' },
                },
                {
                    type: 'card',
                    icon: 'BookOpen',
                    titleKey: 'Wizard.Titles.Doc',
                    descriptionKey: 'Wizard.Hints.DocDesc',
                    action: { type: 'url', value: 'https://github.com/eondrcode/obsidian-i18n' },
                },
            ],
        },
        {
            titleKey: 'Wizard.Labels.Community',
            titleSuffix: ' & ',
            titleKey2: 'Wizard.Labels.Support',
            items: [
                {
                    type: 'card',
                    icon: 'Users',
                    titleKey: 'Wizard.Titles.Qq',
                    descriptionKey: 'Wizard.Hints.QqDesc',
                    action: { type: 'url', value: 'https://qm.qq.com/cgi-bin/qm/qr?k=kHTS0iC1FC5igTXbdbKzff6_tc54mOF5&jump_from=webapi&authKey=AoSkriW+nDeDzBPqBl9jcpbAYkPXN2QRbrMh0hFbvMrGbqZyRAbJwaD6JKbOy4Nx' },
                },
                {
                    type: 'card',
                    icon: 'Github',
                    titleKey: 'Wizard.Titles.Github',
                    descriptionKey: 'Wizard.Hints.GithubDesc',
                    action: { type: 'url', value: 'https://github.com/eondrcode/obsidian-translations/issues' },
                },
                {
                    type: 'placeholder',
                    textKey: 'Wizard.Hints.MoreExpect',
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
