/**
 * Wizard 远程配置类型定义
 */

/** Action 类型：打开 URL */
export interface WizardActionUrl {
    type: 'url';
    value: string;
}

/** Action 类型：激活内部视图 */
export interface WizardActionView {
    type: 'view';
    value: string;
}

/** Action 类型：打开设置页 */
export interface WizardActionSettings {
    type: 'settings';
}

/** Action 联合类型 */
export type WizardActionConfig = WizardActionUrl | WizardActionView | WizardActionSettings;

/** 卡片项配置 */
export interface WizardCardItemConfig {
    type: 'card';
    icon: string;
    titleKey: string;
    descriptionKey: string;
    action: WizardActionConfig;
}

/** 占位符项配置 */
export interface WizardPlaceholderItemConfig {
    type: 'placeholder';
    textKey: string;
}

/** 项配置联合类型 */
export type WizardItemConfig = WizardCardItemConfig | WizardPlaceholderItemConfig;

/** Section 标题配置 */
export interface WizardSectionTitleConfig {
    titleKey: string;
    titleSuffix?: string;
    titleKey2?: string;
}

/** Section 配置 */
export interface WizardSectionConfig extends WizardSectionTitleConfig {
    items: WizardItemConfig[];
}

/** 远程配置根结构 */
export interface WizardRemoteConfig {
    version: number;
    sections: WizardSectionConfig[];
}
