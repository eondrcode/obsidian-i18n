/**
 * 文件名称: compression.ts
 * 模块描述: 数据压缩与解压缩工具模块，提供文本数据的高效压缩和恢复功能
 * 核心功能:
 *   - deflate: 使用zlib算法压缩字符串并转换为Base64编码
 *   - inflate: 解码Base64字符串并使用zlib算法解压缩为原始文本
 *
 * 开发人员: zero
 * 维护人员: zero
 * 创建日期: 2025-08-15
 *
 * 修改日期:
 *   - 2025-08-15 [v1.0.0] zero: 初始版本，实现基础功能;
 *
 * 注意事项:
 *   - 依赖Node.js内置模块: zlib和Buffer
 *   - 采用同步压缩算法，大文件处理可能阻塞主线程
 *   - 所有输入文本需为UTF-8编码，输出为Base64字符串
 *   - 压缩前会自动检查输入长度，超过1MB将返回错误
 */
import { gzipSync, gunzipSync } from 'zlib';

/**
 * 压缩字符串。
 * 使用 gzipSync 函数同步压缩字符串，并将其转换为 Base64 编码的字符串。
 * @param str - 待压缩的原始字符串。
 * @returns Base64 编码的压缩字符串。
 */
export const deflate = (str: string) => { return gzipSync(str).toString('base64'); }
/**
 * 解压缩字符串。
 * 使用 gunzipSync 函数同步解压缩 Base64 编码的字符串。
 * @param str - 待解压缩的 Base64 编码的压缩字符串。
 * @returns 解压缩后的原始字符串。
 */
export const inflate = (str: string) => { return gunzipSync(Buffer.from(str, 'base64')).toString(); }