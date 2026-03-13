/**
 * 文件名称: general.ts
 * 模块描述: 通用工具函数模块，提供系统操作、字符串处理和数据解析功能
 * 核心功能:
 *   - i18nOpen: 根据操作系统打开指定路径的文件/文件夹 (支持Windows和macOS)
 *   - escapeSpecialChars: 转义字符串中的换行符和回车符为\n和\r
 *   - unescapeSpecialChars: 将字符串中的\n和\r还原为换行符和回车符
 *   - parseIssueTitle: 解析问题标题中的三方括号格式内容 (格式: [part1] [part2] [part3])
 *
 * 开发人员: zero
 * 维护人员: zero
 * 创建日期: 2025-08-15
 *
 * 修改日期:
 *   - 2025-08-15 [v1.0.0] zero: 初始版本，实现基础功能;
 *
 * 依赖模块: I18N、child_process.exec、lang/inxdex
 * 注意事项:
 *   - i18nOpen仅支持Windows和macOS系统，其他系统不执行任何操作
 *   - escape/unescapeSpecialChars仅处理\n和\r字符，不处理其他特殊字符
 *   - parseIssueTitle依赖严格的三方括号格式，不符合格式将返回空数组
 *   - exec调用为异步操作，错误处理通过i18n通知系统实现
 */

import I18N from '../../main';
import { t } from '../../locales';

import { exec } from 'child_process';

export const info = (i18n: I18N) => {
    console.log(`%c ${i18n.manifest.name} %c v${i18n.manifest.version} `, `padding: 2px; border-radius: 2px 0 0 2px; color: #fff; background: #5B5B5B;`, `padding: 2px; border-radius: 0 2px 2px 0; color: #fff; background: #409EFF;`);
}

/**
 * 打开文件或文件夹的操作系统命令。
 * @param i18n - 国际化对象，用于显示操作结果的通知。
 * @param dir - 要打开的文件夹路径。
 * @description 根据操作系统执行相应的命令来打开文件夹。在Windows上使用'start'命令，在Mac上使用'open'命令。
 * 如果操作成功，显示成功通知；如果失败，显示错误通知。
 */
export const i18nOpen = (i18n: I18N, dir: string) => {
    if (process.platform === 'win32') {
        exec(`start "" "${dir}"`, (error) => {
            if (error) {
                i18n.notice.resultPrefix(t('func.open_prefix'), false, error);
            } else {
                i18n.notice.resultPrefix(t('func.open_prefix'), true);
            }
        });
    }
    if (process.platform === 'darwin') {
        exec(`open "${dir}"`, (error) => {
            if (error) {
                i18n.notice.resultPrefix(t('func.open_prefix'), false, error);
            } else {
                i18n.notice.resultPrefix(t('func.open_prefix'), true);
            }
        });
    }
}

export const escapeSpecialChars = (str: string) => {
    return str.replace(/\n/g, '\\n').replace(/\r/g, '\\r')
}
export const unescapeSpecialChars = (str: string) => {
    return str.replace(/\\n/g, '\n').replace(/\\r/g, '\r')
}

/**
 * 解析问题标题，提取其中的三个主要部分。
 * 问题标题格式定义为三个方括号包裹的部分组成，各部分间可以有任意数量的空格。
 * @param title 问题标题字符串。
 * @returns 一个包含三个字符串的数组，分别对应标题中的三个部分。
 *         如果标题不符合预期格式，则返回三个空字符串。
 */
export const parseIssueTitle = (title: string): [string, string, string] => {
    const regex = /\[(.*?)\]\s*\[(.*?)\]\s*\[(.*?)\]/;
    const match = title.match(regex);
    return match ? [match[1], match[2], match[3]] : ['', '', ''];
}