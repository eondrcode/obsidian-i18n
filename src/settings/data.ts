import { pageRule } from '../utils';
import { DEFAULT_AST_PROMPT_TEMPLATE, DEFAULT_REGEX_PROMPT_TEMPLATE, DEFAULT_THEME_PROMPT_TEMPLATE } from '../ai/openai-translation-service';

export interface OpenAIProfile {
    id: string;
    name: string;
    url: string;
    key: string;
    model: string;
    useCustomPrice: boolean;
    priceInput: number;
    priceOutput: number;
}

export interface GitHubProfile {
    id: string;
    name: string;
    token: string;
    repo: string;
}

export interface I18nSettings {
    // ==============================
    // 基础设置
    // ==============================
    agreement: boolean;        // 用户是否已同意协议
    language: string;          // 目标翻译语言类型
    checkUpdates: boolean;    // 是否自动检查插件更新
    searchText: string;       // 网络文件配置：搜索文本
    sort: string;              // 列表排序方式 (0: 正序, 1: 倒序)
    author: string;            // 默认作者署名
    mode: number;              // 插件运行模式 (待定/保留字段)

    // ==============================
    // 本地模式 (LDT)
    // ==============================
    automaticUpdate: boolean; // 是否在插件更新后自动应用旧版译文

    // ==============================
    // 语言模型翻译配置 (LLM)
    // ==============================
    llmApi: number;                 // 当前选中的 LLM 服务商 (1: OpenAI, etc.)
    llmResponseFormat: string;      // LLM 返回格式 (text, json_object)
    llmLanguage: string;            // LLM 翻译的目标语言
    llmStyle: string;               // LLM 翻译的风格类型
    llmBatchSize: number;           // LLM 批量翻译并行的文本条数
    llmConcurrencyLimit: number;    // LLM 并发请求限制数
    llmTimeout: number;             // LLM 请求超时时间 (毫秒)


    llmRegexPrompt?: string;        // LLM Regex 自定义提示词模板
    llmAstPrompt?: string;          // LLM AST 自定义提示词模板
    llmThemePrompt?: string;        // LLM Theme 自定义提示词模板

    // OpenAI 专属配置
    llmOpenaiUrl: string;           // OpenAI API 代理/基础接口地址 (当前激活)
    llmOpenaiKey: string;           // OpenAI API 密钥 (当前激活)
    llmOpenaiModel: string;         // 选用的 OpenAI 模型名 (当前激活)
    llmOpenaiProfiles: OpenAIProfile[]; // 所有 OpenAI 配置方案
    llmOpenaiActiveProfileId: string;    // 当前激活的 Profile ID
    llmUseCustomPrice: boolean;     // 是否使用自定义价格估算
    llmPriceInputCustom: number;    // 自定义输入价格 ($/1M tokens)
    llmPriceOutputCustom: number;   // 自定义输出价格 ($/1M tokens)

    // ==============================
    // 沉浸式翻译配置 (IMT)
    // ==============================
    modeImt: boolean;         // 是否启用沉浸式翻译
    imtPagerule: pageRule;    // 沉浸式翻译页面的匹配规则

    // ==============================
    // 共建云端翻译 (Share)
    // ==============================
    shareToken: string;       // 用户提交翻译用的 Gitee Token
    shareRepo: string;        // 用户的个人翻译 Gitee 仓库名
    shareProfiles: GitHubProfile[]; // 多账号切换方案
    shareActiveProfileId: string;   // 当前激活的账号方案 ID

    // ==============================
    // 正则提取匹配规则
    // ==============================
    reFlags: string;          // 正则表达式的匹配修饰符 (默认: gs)
    reLength: number;         // 提取文本的最大长度限制
    reDatas: string[];        // 核心源码中用于捕获文本的正式正则表达式列表
    reRejectRe: string[];    // 正则提取排除正则
    reValidRe: string[];     // 正则提取有效正则

    // ==============================
    // AST 提取规则
    // ==============================
    astAssignments: string[]; // 赋值白名单
    astFunctions: string[];   // 函数白名单
    astKeys: string[];        // 键名白名单
    astRejectRe: string[];   // 排除正则 (字符串形式)
    astValidRe: string[];    // 有效正则 (字符串形式)

    // ==============================
    // 网络配置
    // ==============================
    githubProxyUrl: string;

    // ==============================
    // 资源仓库列表
    // ==============================
    cloudRepos: string[];     // 云端默认加载的插件资源列表仓库
    defaultCloudRepo: string; // 用户指定的默认云仓库地址

    // ==============================
    // 管理器状态持久化
    // ==============================
    managerTab: string;       // 管理器当前选中的 Tab (plugins/themes)
    pluginViewMode: 'list' | 'grid'; // 插件管理器视图模式
    themeViewMode: 'list' | 'grid'; // 主题管理器视图模式
    autoSave: boolean;        // 编辑器是否开启自动保存
    // ==============================
    // 自动化设置 (AutoManager)
    // ==============================
    autoSilentMode: boolean;   // 自动模式是否开启静默匹配（不弹出通知）
    autoApply: boolean;        // 自动化匹配后是否自动执行应用 (物理替换文件)
    autoTrustedRepos: string[]; // 受信任的自动翻译仓库列表
    lastAutoCheckTime: number; // 上次自动检查的时间戳
}

export const DEFAULT_SETTINGS: I18nSettings = {
    // ==============================
    // 基础设置
    // ==============================
    agreement: true,           // 默认同意协议
    language: 'zh-cn',         // 默认翻译语言为简体中文
    checkUpdates: true,       // 默认开启检查更新
    searchText: '',           // 默认无搜索文本
    sort: '0',                 // 默认按正序排列
    author: '',                // 默认作者署名为空
    mode: 0,                   // 默认模式: 0

    // ==============================
    // 本地模式 (LDT)
    // ==============================
    automaticUpdate: false,   // 默认关闭自动更新译文

    // ==============================
    // 语言模型翻译配置 (LLM)
    // ==============================
    llmApi: 1,                      // 默认使用第一类 API 配置 (OpenAI)
    llmResponseFormat: 'text',      // 默认使用 text 的通用容错返回格式
    llmLanguage: '简体中文',        // LLM 的默认生成语言
    llmStyle: '无',                 // LLM 的默认生成风格
    llmBatchSize: 10,               // 默认最大批量并发为 10 条
    llmConcurrencyLimit: 3,         // 默认并发限制为 3
    llmTimeout: 60000,              // 默认超时为 60 秒


    llmRegexPrompt: DEFAULT_REGEX_PROMPT_TEMPLATE,             // 默认加载内置的 Regex Prompt
    llmAstPrompt: DEFAULT_AST_PROMPT_TEMPLATE,               // 默认加载内置的 AST Prompt
    llmThemePrompt: DEFAULT_THEME_PROMPT_TEMPLATE,           // 默认加载内置的 Theme Prompt

    // OpenAI 专属配置
    llmOpenaiUrl: '',
    llmOpenaiKey: '',
    llmOpenaiModel: '',
    llmOpenaiProfiles: [],
    llmOpenaiActiveProfileId: '',
    llmUseCustomPrice: true,
    llmPriceInputCustom: 0,
    llmPriceOutputCustom: 0,

    // ==============================
    // 沉浸式翻译配置 (IMT)
    // ==============================
    modeImt: false,           // 默认关闭沉浸式
    imtPagerule: {
        selectors: [
            ".mod-settings",
            ".modal-container",
            ".menu",
            ".notice-container"
        ],
        excludeSelectors: [
            ".markdown-source-view",
            ".markdown-reading-view",
            ".cm-editor"
        ],
    },

    // ==============================
    // 共建云端翻译 (Share)
    // ==============================
    shareToken: '',           // 默认 Token 为空
    shareRepo: '',            // 默认 Repo 为空
    shareProfiles: [],
    shareActiveProfileId: '',

    // ==============================
    // 正则匹配
    // ==============================
    reFlags: 'gs',            // 默认全局搜索+忽略多行等限制
    reLength: 300,            // 默认限制文本最长 300 字符
    reDatas: [
        "(Notice|log|error|setText|setButtonText|setName|setDesc|setPlaceholder|setTooltip|appendText|setTitle|addHeading|renderMarkdown)\\(\\s*(['\"`])(.*?)\\2\\s*\\)",
        "(textContent|innerText|name|description|selection|annotation|link|text|search|speech|page|settings)\\s*[:=]\\s*(['\"`])(.*?)\\2"
    ],
    reRejectRe: [
        "^\\s*$", "^\\d+$", "^[\\w-]+\\.[\\w-]+\\.\\w+$", "^https?:\\/\\/",
        "^data:image\\/", "^#([0-9a-f]{3}|[0-9a-f]{6})$", "^[a-z0-9-]+$",
        "^[a-z]+[A-Z][a-zA-Z0-9]*$", "^[A-Z_][A-Z0-9_]*$", "^px|em|rem|vh|vw|auto$",
        "^rgba?\\(", "^\\.", "\\.(png|jpg|gif|svg|css|js|ts|md|json)$"
    ],
    reValidRe: [
        "\\s", "[^\\x00-\\x7F]", "[!?,;:。！？，；：]\\s*$"
    ],

    // ==============================
    // AST 提取规则
    // ==============================
    astAssignments: [
        'overwriteName', 'innerHTML', 'outerHTML', 'title', 'alt', 'placeholder',
        'textContent', 'innerText', 'ariaLabel', 'nodeValue'
    ],
    astFunctions: [
        'Notice', 'setTitle', 'setContent', 'setName', 'setDesc', 'setButtonText',
        'setPlaceholder', 'setTooltip', 'addOption', 'addHeading', 'addText',
        'setHint', 'setWarning', 'setText', 'appendText', 'createEl', 'createDiv',
        'createSpan', 'addCommand', 'insertText', 'replaceRange', 'replaceSelection',
        'log', 'error', 'warn', 'info', 'alert', 'confirm', 'prompt'
    ],
    astKeys: [
        'name', 'description', 'text', 'placeholder', 'label', 'tooltip', 'title',
        'header', 'desc', 'message', 'buttontext', 'aria-label', 'heading', 'content',
        'tab', 'caption', 'subtitle', 'summary', 'info', 'warning', 'error', 'success',
        'hint', 'instructions', 'link', 'selection', 'annotation', 'search', 'speech',
        'page', 'empty', 'detail', 'body', 'option', 'notice'
    ],
    astRejectRe: [
        "^\\s*$", "^\\d+$", "^[\\w-]+\\.[\\w-]+\\.\\w+$", "^https?:\\/\\/",
        "^data:image\\/", "^#([0-9a-f]{3}|[0-9a-f]{6})$", "^[a-z0-9-]+$",
        "^[a-z]+[A-Z][a-zA-Z0-9]*$", "^[A-Z_][A-Z0-9_]*$", "^px|em|rem|vh|vw|auto$",
        "^rgba?\\(", "^\\.", "\\.(png|jpg|gif|svg|css|js|ts|md|json)$"
    ],
    astValidRe: [
        "\\s", "[^\\x00-\\x7F]", "[!?,;:。！？，；：]\\s*$"
    ],

    // ==============================
    // 网络配置
    // ==============================
    githubProxyUrl: 'https://ghp.ci/',

    cloudRepos: [],
    defaultCloudRepo: '',

    // ==============================
    // 管理器状态持久化
    // ==============================
    managerTab: 'plugins',
    pluginViewMode: 'list',
    themeViewMode: 'grid',
    autoSave: true,

    // ==============================
    // 自动化设置 (AutoManager)
    // ==============================
    autoSilentMode: false,     // 默认不进入完成静默模式（方便用户感知）
    autoApply: true,           // 默认开启自动应用
    autoTrustedRepos: [],      // 默认受信任源为空列表
    lastAutoCheckTime: 0,
}
