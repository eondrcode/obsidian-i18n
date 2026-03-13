/**
 * 文件名称: format.ts
 * 模块描述: 时间戳格式化工具模块，提供多种时间显示格式转换功能
 * 核心功能:
 *   - formatTimestamp: 将时间戳转换为中文格式字符串 (例: '08月15日 14:30')
 *   - formatTimestamp_concise: 将时间戳转换为简洁格式字符串 (例: '2025/08/15 14:30')
 *
 * 开发人员: zero
 * 维护人员: zero
 * 创建日期: 2025-08-15
 *
 * 修改日期:
 *   - 2025-08-15 [v1.0.0] zero: 初始版本，实现基础功能;
 *
 * 依赖模块: JavaScript Date 对象
 * 注意事项:
 *   - 输入必须为有效的毫秒级时间戳数字
 *   - 输出格式中的月份和日期均为两位数，不足则前置补零
 *   - 不处理时区转换，默认使用本地时区
 */

/**
 * 格式化时间戳为更易读的中文日期和时间格式。
 * @param timestamp - 要格式化的时间戳，单位为毫秒。
 * @returns 返回格式化后的日期和时间字符串，格式为 "月日 日:时"。
 */
export const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const formattedDate = `${month}月${day}日 ${hours}:${minutes}`;
    return formattedDate;
}
/**
 * 格式化时间戳为简洁的日期和时间格式。
 * @param timestamp - 要格式化的时间戳，单位为毫秒。
 * @returns 返回格式化后的日期和时间字符串，格式为 "年/月/日 时:分"。
 */
export const formatTimestamp_concise = (timestamp: number) => {
    const date = new Date(timestamp);
    const [year, month, day, hours, minutes] = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0'), String(date.getHours()).padStart(2, '0'), String(date.getMinutes()).padStart(2, '0')];
    return `${year}/${month}/${day} ${hours}:${minutes}`;
}