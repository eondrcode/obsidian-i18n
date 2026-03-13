import common from './common';
import manager from './manager';
import editor from './editor';
import cloud from './cloud';
import wizard from './wizard';
import account from './account';
import agreement from './agreement';
import settings from './settings';

/**
 * 组合所有模块为三层结构
 */
export default {
    Common: common,
    Manager: manager,
    Editor: editor,
    Cloud: cloud,
    Wizard: wizard,
    Account: account,
    Agreement: agreement,
    Settings: settings
} as const;
