/**
 * 通用模型列表拉取器
 *
 * 为什么需要它：
 * `LLM_PROVIDERS` 里的 `models` 是硬编码的，而各家服务商的模型 ID 每隔几个月就会
 * 增删甚至整代退役（例如 DeepSeek 于 2026-07-24 退役了 deepseek-chat）。
 * 硬编码列表必然腐烂，最终表现为「下拉框里选哪个都报 model not found」。
 *
 * 因此这里统一改为向服务商索取实时列表：
 *     GET {baseUrl}/models   (Authorization: Bearer <key>)
 * 这是 OpenAI 兼容协议的事实标准，主流服务商均已实现。
 *
 * 已知例外：
 *   - Gemini 的 OpenAI 兼容路径不提供 /models（返回 404），仍走硬编码列表。
 *   - 本地 LM Studio / Ollama 见 ollama-translation-service.ts 的双协议兜底实现。
 */

import { requestUrl } from "obsidian";
import { normalizeOpenAIUrl } from "./url-helper";

/** 缓存有效期：30 分钟。避免频繁切换设置项时反复打接口。 */
const CACHE_TTL_MS = 30 * 60 * 1000;

interface CacheEntry {
    models: string[];
    timestamp: number;
}

const modelCache: Record<string, CacheEntry> = {};

/** 生成缓存键：同 baseUrl + 同 key 视为同一份列表 */
function cacheKey(baseUrl: string, apiKey: string): string {
    return `${baseUrl}::${apiKey.slice(0, 8)}`;
}

/** 从各种可能的响应结构里抽取模型 ID 数组 */
function extractModelIds(payload: any): string[] {
    const raw = payload?.data ?? payload?.models ?? payload;
    if (!Array.isArray(raw)) return [];

    const ids = raw
        .map((item: any) => (typeof item === "string" ? item : item?.id ?? item?.name ?? item?.model))
        .filter((id: any): id is string => typeof id === "string" && id.trim().length > 0);

    return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
}

/**
 * 拉取 OpenAI 兼容服务商的实时模型列表。
 *
 * 失败时一律返回空数组而不是抛错 —— 调用方据此回退到硬编码列表，
 * 不能因为一次网络抖动就让整个设置页报错。
 *
 * @param baseUrl 服务商基础地址（可带 /v1，也可带完整的 /chat/completions 尾巴，会自动规范化）
 * @param apiKey  API Key，可为空（部分服务商如 OpenRouter 的 /models 是公开的）
 */
export async function fetchOpenAICompatibleModels(
    baseUrl: string | undefined,
    apiKey: string
): Promise<string[]> {
    const base = normalizeOpenAIUrl(baseUrl);
    if (!base) return [];

    const key = cacheKey(base, apiKey || '');
    const now = Date.now();
    const cached = modelCache[key];
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        return cached.models;
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    try {
        const response = await requestUrl({
            url: `${base}/models`,
            method: 'GET',
            headers,
            throw: false
        });

        if (response.status < 200 || response.status >= 300) {
            console.warn(`[Model Fetcher] ${base}/models 返回 HTTP ${response.status}，回退到内置列表`);
            return [];
        }

        const models = extractModelIds(response.json);
        if (models.length > 0) {
            modelCache[key] = { models, timestamp: now };
        }
        return models;
    } catch (error: any) {
        console.warn(`[Model Fetcher] 拉取 ${base}/models 失败：${error?.message || error}`);
        return [];
    }
}

/** 手动清空缓存（用户点「刷新模型列表」时调用） */
export function clearModelCache(): void {
    for (const k of Object.keys(modelCache)) {
        delete modelCache[k];
    }
}
