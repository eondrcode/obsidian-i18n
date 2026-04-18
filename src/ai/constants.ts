/**
 * AI 服务商统一配置表
 * 
 * 用于集中管理各平台的 API 地址、默认模型、预设模型列表等。
 * 方便以后新增或修改模型配置。
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
        defaultModel: 'gpt-4o-mini',
        models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini'],
        labelKey: 'Openai',
        homepage: 'https://platform.openai.com/'
    },
    'gemini': {
        id: 'gemini',
        name: 'Gemini',
        category: 'international',
        engine: 'gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        defaultModel: 'gemini-2.0-flash',
        models: ['gemini-2.0-flash-exp', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
        labelKey: 'Gemini',
        homepage: 'https://aistudio.google.com/'
    },
    'ollama': {
        id: 'ollama',
        name: 'Ollama',
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
        defaultModel: 'deepseek-chat',
        models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
        labelKey: 'Deepseek',
        homepage: 'https://platform.deepseek.com/'
    },
    'zhipu': {
        id: 'zhipu',
        name: '智谱 AI (GLM)',
        category: 'domestic',
        engine: 'openai',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        defaultModel: 'glm-4-flash',
        models: ['glm-4', 'glm-4-flash', 'glm-3-turbo'],
        labelKey: 'Zhipu',
        homepage: 'https://open.bigmodel.cn/'
    },
    'moonshot': {
        id: 'moonshot',
        name: '月之暗面 (Kimi)',
        category: 'domestic',
        engine: 'openai',
        baseUrl: 'https://api.moonshot.cn/v1',
        defaultModel: 'moonshot-v1-8k',
        models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
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
        models: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-max-longcontext'],
        labelKey: 'Aliyun',
        homepage: 'https://dashscope.console.aliyun.com/'
    },
    'baidu': {
        id: 'baidu',
        name: '百度千帆 (ERNIE)',
        category: 'domestic',
        engine: 'openai',
        baseUrl: 'https://qianfan.baidubce.com/v2',
        defaultModel: 'ernie-4.0-8k-preview',
        models: ['ernie-4.0-8k-preview', 'ernie-4.0-8k-latest', 'ernie-3.5-8k', 'ernie-speed-128k'],
        labelKey: 'Baidu',
        homepage: 'https://console.bce.baidu.com/qianfan/'
    },
    'bytedance': {
        id: 'bytedance',
        name: '字节跳动 (豆包)',
        category: 'domestic',
        engine: 'openai',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        defaultModel: 'doubao-pro-4k',
        models: ['doubao-pro-4k', 'doubao-pro-32k', 'doubao-lite-4k'],
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
        models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
        labelKey: 'Groq',
        homepage: 'https://console.groq.com/'
    },
    'siliconflow': {
        id: 'siliconflow',
        name: '硅基流动',
        category: 'aggregated',
        engine: 'openai',
        baseUrl: 'https://api.siliconflow.cn/v1',
        defaultModel: 'deepseek-ai/DeepSeek-V3',
        models: [
            'deepseek-ai/DeepSeek-V3',
            'deepseek-ai/DeepSeek-R1',
            'deepseek-ai/DeepSeek-V2.5',
            'Qwen/Qwen2.5-7B-Instruct',
            'Qwen/Qwen2.5-72B-Instruct',
            '01-ai/Yi-1.5-34B-Chat-16K'
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
        defaultModel: 'anthropic/claude-3.5-sonnet',
        models: [
            'anthropic/claude-3.5-sonnet',
            'google/gemini-pro-1.5',
            'meta-llama/llama-3.1-405b-instruct',
            'mistralai/mistral-large',
            'openai/gpt-4o'
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
        defaultModel: 'meta-llama/Llama-3.3-70B-Instruct',
        models: [
            'meta-llama/Llama-3.3-70B-Instruct',
            'meta-llama/Llama-3.2-11B-Vision-Instruct',
            'mistralai/Mistral-7B-Instruct-v0.3',
            'microsoft/WizardLM-2-7B'
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
        baseUrl: 'https://api.minimax.chat/v1',
        defaultModel: 'abab6.5-chat',
        models: ['abab6.5-chat', 'abab6.5s-chat', 'abab5.5-chat'],
        labelKey: 'Minimax',
        homepage: 'https://platform.minimaxi.com/'
    },
    'stepfun': {
        id: 'stepfun',
        name: '阶跃星辰 (StepFun)',
        category: 'domestic',
        engine: 'openai',
        baseUrl: 'https://api.stepfun.com/v1',
        defaultModel: 'step-1-8k',
        models: ['step-1-8k', 'step-1-32k', 'step-1-128k', 'step-1-256k'],
        labelKey: 'Stepfun',
        homepage: 'https://platform.stepfun.com/'
    }
};
