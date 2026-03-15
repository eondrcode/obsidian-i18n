/**
 * AI Token 估算工具
 * 使用启发式算法估算文本 Token 数，减少对重型库的依赖
 */

export interface TokenEstimation {
    tokens: number;
    estimatedCost: number; // 美元
}

const PRICING = {
    'gpt-4o': { input: 0.000005, output: 0.000015 },
    'gpt-4o-mini': { input: 0.00000015, output: 0.0000006 },
    'default': { input: 0.000005, output: 0.000015 }
};

const USD_TO_CNY = 7.3; // 汇率常数

/**
 * 粗略估算字符串的 Token 数
 * 规则：
 * 1. 英文/代码：约 4 个字符 1 个 Token
 * 2. 中文：约 1 个汉字 1.5 ~ 2 个 Token
 */
export function estimateStringTokens(text: string): number {
    if (!text) return 0;
    
    let tokens = 0;
    // 匹配中文字符
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
    const otherCharsLength = text.length - chineseChars.length;
    
    // 中文按 1.5 tokens/char 估算（保守估计）
    tokens += chineseChars.length * 1.5;
    // 其他（英文/代码/空格）按 0.25 tokens/char 估算
    tokens += otherCharsLength * 0.25;
    
    return Math.ceil(tokens);
}

/**
 * 估算整个翻译批次的总 Token 数
 * 考虑了 JSON 结构的额外开销
 */
export function estimateBatchTokens(items: any[], systemPrompt: string): number {
    let totalTokens = estimateStringTokens(systemPrompt);
    
    // JSON 结构开销：每个对象包含 {"i": id, "s": "source"...}
    // 基础 JSON 符号 {} : , "" 约 10-20 tokens
    for (const item of items) {
        let itemStr = JSON.stringify(item);
        totalTokens += estimateStringTokens(itemStr) + 10; // 额外 10 tokens 作为 JSON 键名和符号开销的补全
    }
    
    return totalTokens;
}

/**
 * 根据模型估算成本 (返回人民币 CNY)
 */
export function estimateCost(tokens: number, model: string, customPrice?: number): number {
    if (customPrice !== undefined && customPrice > 0) {
        return tokens * (customPrice / 1000000); // 如果是自定义价格，直接按用户输入的单价计算（用户此时输入的是人民币/1M tokens）
    }
    const price = (PRICING as any)[model] || PRICING.default;
    return tokens * price.input * USD_TO_CNY; // 官方价格是美元，乘以汇率转为人民币
}
