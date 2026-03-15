/**
 * 规范化 OpenAI API URL
 * 如果 URL 不以 /v1 结尾且不是已知不需要 /v1 的地址，则自动补全
 * 
 * @param url 原始 URL
 * @returns 规范化后的 URL
 */
export function normalizeOpenAIUrl(url: string | undefined): string | undefined {
    if (!url) return url;

    let normalized = url.trim();

    // 1. 去除末尾所有斜点
    normalized = normalized.replace(/\/+$/, '');

    if (!normalized) return normalized;

    // 2. 递归剥离可能存在的具体接口后缀，还原到基础路径或 /v1
    const redundantSuffixes = [
        '/chat/completions',
        '/completions',
        '/chat',
        '/models',
        '/v1'
    ];

    let found = true;
    while (found) {
        found = false;
        for (const suffix of redundantSuffixes) {
            if (normalized.endsWith(suffix)) {
                normalized = normalized.substring(0, normalized.length - suffix.length).replace(/\/+$/, '');
                found = true;
                break;
            }
        }
    }

    // 3. 返回基础路径 (不带 /v1，由调用方根据需要拼接)
    return normalized;
}
