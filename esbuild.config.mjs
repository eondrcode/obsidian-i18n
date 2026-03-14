import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

/**
 * 此时定义的 banner 会被插入到生成文件的最顶部。
 * 通常用于添加版权信息、版本号或环境声明。
 */
const banner = ``;

/**
 * 通过命令行参数判断当前是否为生产环境构建。
 * 命令示例: node esbuild.config.mjs production
 */
const prod = (process.argv[2] === "production");

/**
 * 创建 esbuild 的构建上下文。
 * context 允许我们配置构建参数，并开启监视模式 (watch) 或重建功能。
 */
const context = await esbuild.context({
    // 在生成的 JS 文件开头插入代码
    banner: {
        js: banner,
    },

    // 构建的入口文件，esbuild 会从这里开始递归分析所有的 import 依赖
    entryPoints: ["main.ts"],

    // 是否将所有依赖合并到一个文件中。对于 Obsidian 插件来说，必须设为 true
    bundle: true,

    // 外部依赖列表。这些模块不会被打包进 main.js，而是假设运行时环境中已存在。
    // 对于 Obsidian 插件，obsidian、electron 和各类 codemirror 组件都应设为外部，
    // 这样可以避免包体积过大，并利用编辑器自带的库。
    external: [
        "obsidian",
        "electron",
        "@codemirror/autocomplete",
        "@codemirror/collab",
        "@codemirror/commands",
        "@codemirror/language",
        "@codemirror/lint",
        "@codemirror/search",
        "@codemirror/state",
        "@codemirror/view",
        "@lezer/common",
        "@lezer/highlight",
        "@lezer/lr",
        ...builtins // 包含 Node.js 的内置模块（如 path, fs 等）
    ],

    // 输出代码的格式。Obsidian 插件通常使用 CommonJS ('cjs') 格式
    format: "cjs",

    // 设置目标环境。确保输出的代码与对应版本的 JavaScript 引擎兼容
    target: "es2020",

    // 构建过程中的日志详细程度。'info' 会输出构建耗时和基本状态信息
    logLevel: "info",

    // 定义全局变量，用于在代码中判断环境
    define: {
        "process.env.DEV_MODE": JSON.stringify(!prod),
    },

    /**
     * Source Map 配置：
     * 1. 'inline': 地图信息以 Base64 字符串嵌入在 main.js 结尾（导致文件非常巨大，如 17MB，不建议生产环境使用）。
     * 2. true: 生成独立的 main.js.map 文件（推荐，兼顾调试与体积）。
     * 3. false: 不生成任何地图信息，体积最小但无法源码级调试。
     */
    sourcemap: true,

    // 自动移除未被引用的代码（死代码删除），有助于减小最终产物的体积
    treeShaking: true,

    // 压缩代码。会移除空格、换行符，并混淆变量名，让文件体积最小。
    minify: true,

    // 在生产环境下移除指定的调试语句。例如移除所有的 console.log 和 debugger
    drop: prod ? ["console", "debugger"] : [],

    // 控制如何处理法律注释（如特殊的版权声明）。'none' 表示全部移除。
    legalComments: "none",

    // 最终生成的产物路径及文件名
    outfile: "main.js",
});

if (prod) {
    // 生产模式：直接运行一次构建流程并退出
    await context.rebuild();
    process.exit(0);
} else {
    // 开发模式：开启监视模式，每当你修改并保存源码时，esbuild 会秒级自动重新构建
    await context.watch();
}