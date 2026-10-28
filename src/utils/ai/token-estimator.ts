/**
 * AI Token 估算工具
 * 使用启发式算法估算文本 Token 数，减少对重型库的依赖
 */

export interface TokenEstimation {
    tokens: number;
    estimatedCost: number; // 美元
}

/**
 * 模型单价表（美元 / 单 token，即「美元每 1M tokens ÷ 1e6」）
 *
 * ⚠️ 维护须知（2026-10 校准）
 * 本表仅覆盖已核实的模型。未收录的模型会落到 `default`，而 `default` 取的是
 * 旗舰级价格，对便宜的国产模型会**明显高估**（例如 DeepSeek 的 `deepseek-flash`
 * 实价 $0.14/$0.28，用 default 估算会虚高约 36 倍）。
 *
 * 因此：若你使用的是国产模型且在意预估准确性，请在设置页开启
 * 「自定义价格」并直接填入服务商的「元 / 1M tokens」单价 —— 那条路径
 * 不经过本表，是最可靠的。
 */
const PRICING: Record<string, { input: number; output: number }> = {
    // ── OpenAI ──
    'gpt-5.6-sol': { input: 5e-6, output: 3e-5 },
    'gpt-5.6-terra': { input: 2.5e-6, output: 1.5e-5 },
    'gpt-5.6-luna': { input: 1e-6, output: 6e-6 },
    'gpt-5.5': { input: 5e-6, output: 3e-5 },
    'gpt-5.5-pro': { input: 3e-5, output: 1.8e-4 },
    'gpt-5.4': { input: 2.5e-6, output: 1.5e-5 },
    'gpt-5.4-mini': { input: 0.75e-6, output: 4.5e-6 },
    'gpt-5.4-nano': { input: 0.2e-6, output: 1.25e-6 },
    'gpt-4.1': { input: 2e-6, output: 8e-6 },
    'gpt-4.1-mini': { input: 0.4e-6, output: 1.6e-6 },
    'gpt-4.1-nano': { input: 0.1e-6, output: 0.4e-6 },
    'gpt-4o': { input: 2.5e-6, output: 1e-5 },
    'gpt-4o-mini': { input: 0.15e-6, output: 0.6e-6 },
    'o4-mini': { input: 0.55e-6, output: 2.2e-6 },
    // ── Gemini (Google AI Studio 定价) ──
    'gemini-3.6-flash': { input: 1.5e-6, output: 7.5e-6 },
    'gemini-3.5-flash': { input: 1.5e-6, output: 9e-6 },
    'gemini-3.5-flash-lite': { input: 0.3e-6, output: 2.5e-6 },
    'gemini-3.1-pro-preview': { input: 2e-6, output: 1.2e-5 },
    'gemini-3-flash': { input: 0.5e-6, output: 3e-6 },
    'gemini-2.5-pro': { input: 1.25e-6, output: 1e-5 },
    'gemini-2.5-flash': { input: 0.3e-6, output: 2.5e-6 },
    'gemini-2.5-flash-lite': { input: 0.1e-6, output: 0.4e-6 },
    // ── DeepSeek ──
    // 'deepseek-flash' 是 /v1/models 实际返回的 ID；'deepseek-v4-flash' 是 2026-10 校准时的误写，
    // 保留仅为兼容存量配置。
    'deepseek-flash': { input: 0.14e-6, output: 0.28e-6 },
    'deepseek-v4-flash': { input: 0.14e-6, output: 0.28e-6 },
    'deepseek-v4-pro': { input: 1.74e-6, output: 3.48e-6 },
    // ── 智谱 / Kimi / 通义（常见国产低价档）──
    'glm-4.6': { input: 0.6e-6, output: 2.2e-6 },
    'kimi-k2.5': { input: 0.6e-6, output: 2.5e-6 },
    // ── 本地模型（免费）──
    'ollama': { input: 0, output: 0 },
    // ── 回退默认（旗舰价位，对便宜模型会高估）──
    'default': { input: 5e-6, output: 1.5e-5 }
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
 * 按模型名查单价：先精确命中，再退回「最长前缀命中」
 * （应对服务商给模型名加日期后缀的情况，如 gpt-5.4-mini-2026-03-01）
 */
function lookupPrice(model: string): { input: number; output: number } {
    if (!model) return PRICING.default;
    if (PRICING[model]) return PRICING[model];

    const lower = model.toLowerCase();
    let bestKey = '';
    for (const key of Object.keys(PRICING)) {
        if (key === 'default') continue;
        if (lower.startsWith(key.toLowerCase()) && key.length > bestKey.length) {
            bestKey = key;
        }
    }
    return bestKey ? PRICING[bestKey] : PRICING.default;
}

/**
 * 根据模型估算成本 (返回人民币 CNY)
 */
export function estimateCost(tokens: number, model: string, customPrice?: number): number {
    if (customPrice !== undefined && customPrice > 0) {
        return tokens * (customPrice / 1000000); // 如果是自定义价格，直接按用户输入的单价计算（用户此时输入的是人民币/1M tokens）
    }
    const price = lookupPrice(model);
    return tokens * price.input * USD_TO_CNY; // 官方价格是美元，乘以汇率转为人民币
}
