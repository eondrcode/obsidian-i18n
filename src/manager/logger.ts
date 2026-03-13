/**
 * 日志级别枚举，定义了不同的日志级别
 */
enum LogType {
    DEBUG = 1 << 0,
    INFO = 1 << 1,
    WARN = 1 << 2,
    ERROR = 1 << 3,
}

/**
 * 日志级别名称映射表，用于将日志级别枚举值映射为字符串。
 */
const LogLevelNames: { [key in LogType]: string } = {
    [LogType.DEBUG]: "调试",
    [LogType.INFO]: "信息",
    [LogType.WARN]: "警告",
    [LogType.ERROR]: "错误",
};

/**
 * 日志级别样式映射表，用于将日志级别枚举值映射为对应的 CSS 样式。
 */
const LogStyles: { [key in LogType]: string } = {
    [LogType.DEBUG]: " #409EFF;",
    [LogType.INFO]: " #67C23A;",
    [LogType.WARN]: " #E6A23C;",
    [LogType.ERROR]: " #F56C6C;",
};


/**
 * 日志系统
 */
export class LoggerManager {
    // 单例模式的实例
    private static instance: LoggerManager;

    // 当前设置的日志级别
    private enabledTypes: Set<LogType>;

    // 存储日志信息的数组
    // private logs: { type: LogType; message: any }[] = [];

    /**
     * 构造函数，初始化日志系统的日志级别
     * @param types - 日志级别，默认为 DEBUG
     */
    private constructor(types: LogType[] = Object.values(LogType).filter((v) => typeof v === "number")) {
        this.enabledTypes = new Set(types);
    }

    /**
     * 设置日志系统的日志级别
     * @param types - 要设置的日志级别
     */
    public setLogLevel(types: LogType[]): void { this.enabledTypes = new Set(types); }

    /**
     * 判断是否应该记录指定级别的日志
     * @param level - 要判断的日志级别
     * @returns 如果应该记录返回 true，否则返回 false
     */
    private shouldLog = (type: LogType): boolean => { return this.enabledTypes.has(type); };

    /**
     * 获取格式化后的当前时间戳字符串
     * @returns 格式化后的时间戳字符串，格式为 [YYYY-MM-DD HH:mm:ss.SSS]
     */
    private getFormattedTimestamp = (): string => {
        return new Intl.DateTimeFormat("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            // @ts-ignore
            fractionalSecondDigits: 3,
        }).format(new Date());
    };

    /**
     * 通用日志记录方法。
     * 根据日志级别判断是否记录日志，并输出到控制台。
     * @param type - 日志级别。
     * @param message - 日志消息内容。
     * @param args - 额外的参数。
     */
    private log = (type: LogType, message: any, ...args: any[]): void => {
        if (this.shouldLog(type)) {
            const logType = LogLevelNames[type];
            const logTime = this.getFormattedTimestamp();
            // 定义样式字符串
            const typeStyle = `border-radius: 2px; padding: 2px 6px; font-size: 10px; color: #fff; background: ${LogStyles[type]};text-align: center;`;
            const timeStyle = `color:${LogStyles[type]}`;

            // 将所有参数组合成一个数组，但保持对象可展开
            const logArgs: any[] = [`%c${logType}%c [${logTime}]`, typeStyle, timeStyle];

            // 构建完整的消息字符串
            let fullMessage = `${message}`;
            let lastArgIsLabel = false;

            // 处理额外参数
            for (let i = 0; i < args.length; i++) {
                const arg = args[i];
                const nextArg = i < args.length - 1 ? args[i + 1] : null;

                // 如果当前参数是字符串标签（以冒号结尾）且下一个参数是对象
                if (typeof arg === 'string' && arg.endsWith('：') && nextArg && typeof nextArg === 'object') {
                    fullMessage += `\n${arg}`;
                    // 对象将在后面单独添加，不在消息字符串中
                    lastArgIsLabel = true;
                }
                // 如果上一个参数是标签，当前参数是对象
                else if (lastArgIsLabel && typeof arg === 'object') {
                    // 对象将被单独添加，所以这里跳过添加到消息字符串
                    lastArgIsLabel = false;
                }
                // 其他情况：将参数添加到消息字符串
                else if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
                    fullMessage += `\n${arg}`;
                }
            }

            logArgs.push(`\n${fullMessage}`);

            // 添加对象参数（单独添加，以便在控制台中可展开）
            for (let i = 0; i < args.length; i++) {
                const arg = args[i];
                if (typeof arg === 'object' && arg !== null) logArgs.push(arg);
            }

            // 使用 console.log 输出
            console.log(...logArgs);
        }
    };

    /**
     * 记录 DEBUG 级别的日志。
     * @param message - 日志消息内容。
     * @param args - 额外的参数。
     */
    public debug = (message: any, ...args: any[]): void => this.log(LogType.DEBUG, message, ...args);

    /**
     * 记录 INFO 级别的日志
     * @param message - 日志消息内容
     * @param args - 额外的参数
     */
    public info = (message: any, ...args: any[]): void => this.log(LogType.INFO, message, ...args);

    /**
     * 记录 WARNING 级别的日志
     * @param message - 日志消息内容
     * @param args - 额外的参数
     */
    public warn = (message: any, ...args: any[]): void => this.log(LogType.WARN, message, ...args);

    /**
     * 记录 ERROR 级别的日志
     * @param message - 日志消息内容
     * @param args - 额外的参数
     */
    public error = (message: any, ...args: any[]): void => this.log(LogType.ERROR, message, ...args);

    /**
     * 获取 LoggerSystem 的单例实例
     * @returns LoggerSystem 的单例实例
     */
    public static getInstance(): LoggerManager {
        if (!LoggerManager.instance) LoggerManager.instance = new LoggerManager();
        return LoggerManager.instance;
    }
}
