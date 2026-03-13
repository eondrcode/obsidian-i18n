/**
 * I/O 管理器
 * 负责翻译文件的读写操作，支持 Gzip 压缩 (.i18n) 
 */

import * as fs from 'fs-extra';
import * as path from 'path';

export const TRANSLATION_FILE_EXTENSION = 'json';

/**
 * 保存翻译文件 (纯 JSON 格式)
 * @param filePath 文件绝对路径 (无需后缀，或者带后缀)
 * @param data 翻译数据对象
 */
export function saveTranslationFile(filePath: string, data: any): void {
    // 确保目录存在
    fs.ensureDirSync(path.dirname(filePath));
    // 1. 序列化 (格式化输出)
    const jsonStr = JSON.stringify(data, null, 4);
    // 2. 写入文件
    fs.writeFileSync(filePath, jsonStr, 'utf-8');
}

/**
 * 读取翻译文件
 * @param filePath 文件绝对路径
 */
export function loadTranslationFile(filePath: string): any {
    if (!fs.existsSync(filePath)) return null;
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(fileContent);
    } catch (e) {
        console.error(`[IOManager] Failed to load translation file: ${filePath}`, e);
        return null;
    }
}
