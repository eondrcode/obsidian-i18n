/**
 * 文件名称: version.ts
 * 模块描述: 版本号比较工具模块，提供符合 SemVer 规范的语义化版本比较能力，支持插件版本兼容性判断
 * 核心功能:
 *   - 实现 SemVer 规范的版本号比较算法，支持核心版本、预发布版本比较
 *   - 返回标准化比较结果（1: version1 > version2, -1: version1 < version2, 0: 相等）
 *
 * 开发人员: zero
 * 维护人员: zero
 * 创建日期: 2025-08-15
 *
 * 修改日期:
 *   - 2025-08-15 [v1.0.0] zero: 初始版本，实现基础功能;
 *   - 2025-08-17 [v1.1.0] zero: 增强功能，支持 SemVer 规范，包括预发布版本比较
 *
 * 注意事项: 
 *   - 支持 SemVer 规范的核心版本（x.y.z）、预发布版本（-alpha, -beta.1）比较
 *   - 忽略构建元数据（+build.123）
 *   - 非数字版本段按 SemVer 规则处理，数字标识符按数值比较，非数字按字典序比较
 *   - 版本号段数不一致时自动补零比较（如 1.2 等同于 1.2.0）
 *   - 输入为空字符串或非标准格式版本号可能导致不可预期结果
 */


/**
 * 比较两个版本号的大小，符合 SemVer 规范。
 * 支持核心版本（x.y.z）和预发布版本（如 alpha, beta.1）的比较，忽略构建元数据。
 * @param version1 - 第一个版本号字符串。
 * @param version2 - 第二个版本号字符串。
 * @returns 如果 version1 大于 version2 返回 1，如果 version1 小于 version2 返回 -1，如果相等返回 0。
 */
export const compareVersions = (version1: string, version2: string): number => {

    // 输入验证
    if (typeof version1 !== 'string' || typeof version2 !== 'string') throw new TypeError('版本号必须为字符串类型');
    if (!version1 || !version2) throw new Error('版本号不能为空字符串');
    // 新增：检测非版本格式字符串
    const versionRegex = /^\d+\.\d+\.\d+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+)?$/;
    if (!versionRegex.test(version1) || !versionRegex.test(version2)) throw new Error('版本号格式不符合 SemVer 规范');

    const { coreVersion: core1, preRelease: pre1 } = parseVersion(version1);
    const { coreVersion: core2, preRelease: pre2 } = parseVersion(version2);

    // 比较核心版本号
    const v1 = core1.split('.').map(segment => {
        const num = Number(segment);
        return isNaN(num) ? 0 : num;
    });
    const v2 = core2.split('.').map(segment => {
        const num = Number(segment);
        return isNaN(num) ? 0 : num;
    });
    const len = Math.max(v1.length, v2.length);
    for (let i = 0; i < len; i++) {
        const num1 = v1[i] || 0;
        const num2 = v2[i] || 0;
        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }

    // 核心版本相同，比较预发布版本
    if (pre1 === null && pre2 === null) return 0;
    if (pre1 === null) return 1; // 没有预发布版本的版本更高
    if (pre2 === null) return -1;

    const pre1Parts = pre1.split('.');
    const pre2Parts = pre2.split('.');
    const maxPreLen = Math.max(pre1Parts.length, pre2Parts.length);

    for (let i = 0; i < maxPreLen; i++) {
        const part1 = pre1Parts[i] || '';
        const part2 = pre2Parts[i] || '';

        const num1 = Number(part1);
        const num2 = Number(part2);

        const isNum1 = !isNaN(num1);
        const isNum2 = !isNaN(num2);

        if (isNum1 && isNum2) {
            if (num1 > num2) return 1;
            if (num1 < num2) return -1;
        } else if (isNum1) {
            return -1; // 数字标识符优先级低于非数字
        } else if (isNum2) {
            return 1; // 非数字标识符优先级高于数字
        } else {
            // 字符串比较
            if (part1 > part2) return 1;
            if (part1 < part2) return -1;
        }
    }

    return 0;
}


/**
 * 解析版本号为核心版本和预发布版本组件
 * @param version - 符合 SemVer 规范的版本号字符串
 * @returns 包含核心版本和预发布版本的对象
 */
const parseVersion = (version: string) => {
    const [mainPart] = version.split('+'); // 忽略 build metadata
    const [coreVersion, preRelease] = mainPart.split('-');
    return { coreVersion, preRelease: preRelease || null };
}