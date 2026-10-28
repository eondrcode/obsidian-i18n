/**
 * AI 服务商统一配置表
 *
 * 用于集中管理各平台的 API 地址、默认模型、预设模型列表等。
 * 方便以后新增或修改模型配置。
 *
 * ⚠️ 维护须知（2026-10 校准）
 * 本表会被服务商随时废弃，`models` 仅作为「拉不到实时列表时的兜底」。
 * 真正的权威来源是服务商的 `GET {baseUrl}/models` 接口 —— 设置页会自动拉取并覆盖本表。
 * 因此本表只需保证 defaultModel 指向一个「便宜、快、稳定」的现役模型即可。
 *
 * 已确认下线、请勿加回（记录以备复查）：
 *   - OpenAI:      gpt-4-turbo / gpt-3.5-turbo
 *   - Gemini:      gemini-2.0-flash / gemini-1.5-*   (2.0 Flash 于 2026-06-01 关停)
 *   - DeepSeek:    deepseek-chat / deepseek-reasoner (2026-07-24 退役) / deepseek-coder (已并入 chat)
 *   - 智谱:        glm-4 / glm-3-turbo
 *   - Kimi:        moonshot-v1-8k / 32k / 128k
 *   - 通义:        qwen-max-longcontext
 *   - 火山方舟:    doubao-pro-4k / doubao-pro-32k / doubao-lite-4k
 *   - Groq:        mixtral-8x7b-32768 / gemma2-9b-it
 *   - MiniMax:     abab6.5-* / abab5.5-*  (且域名已从 api.minimax.chat 迁移)
 *   - DeepInfra:   microsoft/WizardLM-2-7B (项目已停止维护)
 */

export interface LLMProviderConfig {
    id: string;
    name: string;
    category: 'international' | 'domestic' | 'aggregated' | 'local';
    engine: 'openai' | 'gemini' | 'ollama';
    baseUrl?: string;
    defaultModel: string;
    models: string[];
    labelKey: string; // 用于从 locales 中获取对应的文案前缀
    homepage: string; // 官网/购买地址
}

export const LLM_PROVIDERS: Record<string, LLMProviderConfig> = {
    'openai': {
        id: 'openai',
        name: 'OpenAI 兼容 (自定义)',
        category: 'international',
        engine: 'openai',
        baseUrl: '',
        defaultModel: 'gpt-5.4-mini',
        models: ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'o4-mini'],
        labelKey: 'Openai',
        homepage: 'https://platform.openai.com/'
    },
    'gemini': {
        id: 'gemini',
        name: 'Gemini',
        category: 'international',
        engine: 'gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        defaultModel: 'gemini-3.5-flash-lite',
        models: ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview', 'gemini-3-flash', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
        labelKey: 'Gemini',
        homepage: 'https://aistudio.google.com/'
    },
    'ollama': {
        id: 'ollama',
        name: '本地模型 (Ollama / LM Studio)',
        category: 'local',
        engine: 'ollama',
        baseUrl: 'http://localhost:11434',
        defaultModel: '',
        models: [],
        labelKey: 'Ollama',
        homepage: 'https://ollama.com/'
    },
    'deepseek': {
        id: 'deepseek',
        name: 'DeepSeek',
        category: 'domestic',
        engine: 'openai',
        baseUrl: 'https://api.deepseek.com/v1',
        defaultModel: 'deepseek-flash',
        models: ['deepseek-flash', 'deepseek-v4-pro'],
        labelKey: 'Deepseek',
        homepage: 'https://platform.deepseek.com/'
    },
    'zhipu': {
        id: 'zhipu',
        name: '智谱 AI (GLM)',
        category: 'domestic',
        engine: 'openai',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        defaultModel: 'glm-4.6',
        models: ['glm-5.3', 'glm-5.2', 'glm-5.1', 'glm-5', 'glm-5-turbo', 'glm-4.7', 'glm-4.6', 'glm-4.5', 'glm-4.5-air'],
        labelKey: 'Zhipu',
        homepage: 'https://open.bigmodel.cn/'
    },
    'moonshot': {
        id: 'moonshot',
        name: '月之暗面 (Kimi)',
        category: 'domestic',
        engine: 'openai',
        baseUrl: 'https://api.moonshot.cn/v1',
        defaultModel: 'kimi-k2.5',
        models: ['kimi-k3', 'kimi-k2.5', 'kimi-k2-0905-preview', 'kimi-k2-turbo-preview', 'kimi-k2-thinking', 'kimi-k2-thinking-turbo'],
        labelKey: 'Moonshot',
        homepage: 'https://platform.moonshot.cn/'
    },
    'aliyun': {
        id: 'aliyun',
        name: '通义千问 (Aliyun)',
        category: 'domestic',
        engine: 'openai',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        defaultModel: 'qwen-plus',
        models: ['qwen3.7-max', 'qwen3.7-plus', 'qwen3.7-flash', 'qwen3.5-plus', 'qwen3-max', 'qwen-max', 'qwen-plus', 'qwen-turbo'],
        labelKey: 'Aliyun',
        homepage: 'https://dashscope.console.aliyun.com/'
    },
    'baidu': {
        id: 'baidu',
        name: '百度千帆 (ERNIE)',
        category: 'domestic',
        engine: 'openai',
        baseUrl: 'https://qianfan.baidubce.com/v2',
        defaultModel: 'ernie-4.0-8k-latest',
        models: ['ernie-4.0-8k-latest', 'ernie-4.0-turbo-8k', 'ernie-speed-128k', 'ernie-3.5-8k'],
        labelKey: 'Baidu',
        homepage: 'https://console.bce.baidu.com/qianfan/'
    },
    'bytedance': {
        id: 'bytedance',
        name: '字节跳动 (豆包)',
        category: 'domestic',
        engine: 'openai',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        defaultModel: 'doubao-seed-2-0-lite-260215',
        models: ['doubao-seed-2-0-pro-260215', 'doubao-seed-2-0-lite-260215', 'doubao-seed-2-0-mini-260215', 'doubao-seed-2-0-code-preview-260215', 'doubao-seed-1-8-251228', 'doubao-seed-code-preview-251028'],
        labelKey: 'Bytedance',
        homepage: 'https://console.volcengine.com/ark/'
    },
    'groq': {
        id: 'groq',
        name: 'Groq (极速)',
        category: 'international',
        engine: 'openai',
        baseUrl: 'https://api.groq.com/openai/v1',
        defaultModel: 'llama-3.3-70b-versatile',
        models: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
        labelKey: 'Groq',
        homepage: 'https://console.groq.com/'
    },
    'siliconflow': {
        id: 'siliconflow',
        name: '硅基流动',
        category: 'aggregated',
        engine: 'openai',
        baseUrl: 'https://api.siliconflow.cn/v1',
        defaultModel: 'Qwen/Qwen3.5-9B',
        models: [
            'Qwen/Qwen3.5-9B',
            'Qwen/Qwen3-32B',
            'Qwen/Qwen3-Max',
            'deepseek-ai/DeepSeek-V4-Flash',
            'deepseek-ai/DeepSeek-V3.2',
            'zai-org/GLM-4.6'
        ],
        labelKey: 'Siliconflow',
        homepage: 'https://siliconflow.cn/'
    },
    'openrouter': {
        id: 'openrouter',
        name: 'OpenRouter',
        category: 'aggregated',
        engine: 'openai',
        baseUrl: 'https://openrouter.ai/api/v1',
        defaultModel: 'deepseek/deepseek-v4.1-flash',
        models: [
            'deepseek/deepseek-v4.1-flash',
            'deepseek/deepseek-v4-flash-0731',
            'anthropic/claude-sonnet-5.5',
            'anthropic/claude-haiku-5.5',
            'openai/gpt-5.6-luna',
            'google/gemini-3.5-flash',
            'moonshotai/kimi-k3',
            'qwen/qwen3.7-flash'
        ],
        labelKey: 'Openrouter',
        homepage: 'https://openrouter.ai/'
    },
    'deepinfra': {
        id: 'deepinfra',
        name: 'DeepInfra',
        category: 'aggregated',
        engine: 'openai',
        baseUrl: 'https://api.deepinfra.com/v1/openai',
        defaultModel: 'deepseek-ai/DeepSeek-V4-Flash-0731',
        models: [
            'deepseek-ai/DeepSeek-V4-Flash-0731',
            'deepseek-ai/DeepSeek-V3.2',
            'Qwen/Qwen3.5-9B',
            'Qwen/Qwen3-32B',
            'zai-org/GLM-4.6',
            'meta-llama/Llama-4-Scout-17B-16E-Instruct'
        ],
        labelKey: 'Deepinfra',
        homepage: 'https://deepinfra.com/'
    },
    'mistral': {
        id: 'mistral',
        name: 'Mistral AI',
        category: 'international',
        engine: 'openai',
        baseUrl: 'https://api.mistral.ai/v1',
        defaultModel: 'mistral-small-latest',
        models: [
            'mistral-small-latest',
            'mistral-medium-latest',
            'mistral-large-latest',
            'codestral-latest'
        ],
        labelKey: 'Mistral',
        homepage: 'https://console.mistral.ai/'
    },
    'minimax': {
        id: 'minimax',
        name: 'MiniMax (海螺 AI)',
        category: 'domestic',
        engine: 'openai',
        baseUrl: 'https://api.minimaxi.com/v1',
        defaultModel: 'MiniMax-M2.5',
        models: ['MiniMax-M2.5', 'MiniMax-M2.1', 'MiniMax-M2', 'MiniMax-M1'],
        labelKey: 'Minimax',
        homepage: 'https://platform.minimaxi.com/'
    },
    'stepfun': {
        id: 'stepfun',
        name: '阶跃星辰 (StepFun)',
        category: 'domestic',
        engine: 'openai',
        baseUrl: 'https://api.stepfun.com/v1',
        defaultModel: 'step-2-mini',
        models: ['step-3', 'step-2-16k', 'step-2-mini', 'step-1-8k', 'step-1-32k'],
        labelKey: 'Stepfun',
        homepage: 'https://platform.stepfun.com/'
    }
};
