// https://immersivetranslate.com/docs/js-sdk/
// 页面翻译规则配置
export interface PageRule {
    excludeMatches?: string | string[]; // 排除特定的网站。
    selectorMatches?: string | string[]; // 用选择器来匹配，而无需指定所有url
    excludeSelectorMatches?: string | string[]; // 排除规则，同上。

    // 指定翻译范围
    selectors: string[]; // 仅翻译匹配到的元素
    excludeSelectors: string[]; // 排除元素，不翻译匹配的元素
    excludeTags: string[]; // 排除Tags，不翻译匹配的Tag

    // 追加翻译范围，而不是覆盖
    additionalSelectors?: string | string[]; // 追加翻译范围。在智能翻译的区域，追加翻译位置。
    additionalExcludeSelectors?: string | string[]; // 追加排除元素，让智能翻译不翻译特定位置。
    additionalExcludeTags?: string | string[]; // 追加排除Tags

    // 保持原样
    stayOriginalSelectors?: string | string[]; // 匹配的元素将保持原样。常用于论坛网站的标签。
    stayOriginalTags?: string | string[]; // 匹配到的Tag将保持原样，比如 `code`

    // 区域翻译
    atomicBlockSelectors?: string | string[]; // 区域选择器, 匹配的元素将被视为一个整体, 不会分段翻译
    atomicBlockTags?: string | string[]; // 区域Tag选择器,  同上

    // Block or Inline
    extraBlockSelectors?: string | string[]; // 额外的选择器，匹配的元素将作为 block 元素，独占一行。
    extraInlineSelectors?: string | string[]; // 额外的选择器，匹配的元素将作为 inline 元素。

    inlineTags?: string | string[]; // 匹配的 Tag 将作为 inline 元素
    preWhitespaceDetectedTags?: string | string[]; // 匹配的 Tag 将自动换行

    // 译文样式
    translationClasses?: string | string | string[]; // 为译文添加额外的 Class

    // 全局样式
    globalStyles?: Record<string, string>; // 修改页面样式，若译文导致页面错乱，这个很有用。
    globalAttributes?: Record<string, Record<string, string>>; // 修改页面元素的属性

    // 嵌入样式
    injectedCss?: string | string[]; // 嵌入CSS样式
    additionalInjectedCss?: string | string[]; // 追加CSS样式，而不是直接覆盖。

    // 上下文
    wrapperPrefix?: string; // 译文区域的前缀，默认为 smart，根据字数决定是否换行。
    wrapperSuffix?: string; // 译文区域的后缀

    // 译文换行字数
    blockMinTextCount?: number; // 将译文作为 block 的最小字符数，否则译文为 inline 元素。
    blockMinWordCount?: number; // 同上。如果希望它们始终换行, 可以都填0.

    // 内容可翻译的最小字数
    containerMinTextCount?: number; // 智能识别时，元素最少包含的字符数，才会被翻译，默认为18
    paragraphMinTextCount?: number; // 原文段落的最小字符数, 大于数字的内容将被翻译
    paragraphMinWordCount?: number; // 原文段落的最小单词数

    // 长段落强制换行字数
    lineBreakMaxTextCount?: number; // 开启翻译长段落时，强制进行分行的段落最大字符数。

    // 启动翻译的时机
    urlChangeDelay?: number; // 进入页面后，延迟多少毫秒开始翻译。为了等网页的初始化，目前默认为250ms

    // AI streaming 翻译
    aiRule?: {
        streamingSelector: string; //gpt 网页中标记正在翻译元素的选择器
        messageWrapperSelector: string; // 消息正文选择器
        streamingChange: boolean; //类 gpt 网页反复的消息是增量更新还是全量更新。gpt 是增量
    };
}

export interface generalRule {
    autoShow?: boolean; // 是否自动显示翻译
    instantTranslate?: boolean; // 是否自动翻译
    alwaysShowIcons?: boolean; // 是否始终显示图标
}

// 沉浸翻译配置
export type ImtConfig = {
    // 页面翻译规则
    pageRule: PageRule;
    generalRule: generalRule;
    // 选择默认的翻译引擎
    translationService: string;
};
