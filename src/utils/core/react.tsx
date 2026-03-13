import { App } from "obsidian";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import { Loader2 } from "lucide-react";

interface IConfig {
    width?: number | string;    // 宽度
    height?: number | string;   // 高度
    draggable?: boolean;        // 仅控制是否启用拖动功能
}

// 模态框配置类型
interface ReactViewOptions<T = any> {
    view: React.ComponentType<T & { closeModal: () => void }>;  // 必传组件，内置closeModal方法
    parent?: HTMLElement;                                       // 挂载容器 
    props?: T;                                                  // 组件参数
    config?: IConfig;                                           // 视图配置
    onOpen?: () => void;                                        // 打开回调
    onClose?: () => void;                                       // 关闭回调
}

export class ReactView {
    // ============================== Obsidian ==============================
    private app: App;                                   // Obsidian应用实例
    // ============================== 视图相关属性 ==============================
    private options: ReactViewOptions;                  // 视图配置
    private root: Root | null = null;                   // 根节点
    private containerEl!: HTMLElement;                  // 容器元素
    private contentEl!: HTMLElement;                    // 内容元素
    private maskEl!: HTMLElement;                       // 遮罩元素
    private isOpen = false;                             // 视图是否打开
    // ============================== 拖动相关属性 ==============================
    private isDragging = false;                         // 是否正在拖动
    private dragStartX = 0;                             // 拖动开始时的X坐标
    private dragStartY = 0;                             // 拖动开始时的Y坐标
    private initialLeft = 0;                            // 初始X坐标
    private initialTop = 0;                             // 初始Y坐标
    private dragHandleEl: HTMLElement | null = null;    // 动态拖动句柄元素


    constructor(app: App, options: ReactViewOptions) {
        this.app = app;
        if (!options.view) throw new Error("ReactView必须提供component参数");  // 校验必填参数
        this.options = { ...options };  // 合并参数
        this.initElements();            // 创建DOM元素
        this.initStyles();              // 初始化样式
        this.initContent();             // 初始化视图
    }

    /** 创建所有必要的DOM元素 */
    private initElements = () => {
        this.containerEl = document.createElement("div");   // 创建容器元素
        this.contentEl = document.createElement("div");     // 创建内容元素
        this.containerEl.appendChild(this.contentEl);       // 容器元素添加内容元素
        this.maskEl = document.createElement("div");        // 创建遮罩元素
        this.containerEl.appendChild(this.maskEl);          // 容器元素添加遮罩元素
    }

    /** 初始化基础样式 */
    private initStyles = () => {
        this.containerEl.classList.add('react-view__container');        // 设置容器元素样式
        this.contentEl.classList.add('react-view__content');            // 设置内容元素样式
        this.maskEl.classList.add('react-view__mask');                  // 设置遮罩元素样式
        // 添加自定义类名
        // if (this.options.className) this.containerEl.classList.add(this.options.className);

        const { width, height } = this.options.config || {};                                            // 视图配置
        if (width) this.contentEl.style.width = typeof width === 'number' ? `${width}px` : width;       // 视图宽度
        if (height) this.contentEl.style.height = typeof height === 'number' ? `${height}px` : height;  // 视图高度

        // 拖动
        if (this.options.config?.draggable) {
            this.contentEl.style.position = 'absolute';                 // 绝对定位
            this.contentEl.style.left = '50%';                          // 水平居中
            this.contentEl.style.top = '50%';                           // 垂直居中
            this.contentEl.style.transform = 'translate(-50%, -50%)';   // 居中
        }
    }

    /** 初始化React内容 */
    private initContent = () => {
        const { view: Component, props } = this.options;                                    // 组件参数
        this.root = createRoot(this.contentEl);                                             // 创建React根节点
        this.root.render(React.createElement(Component, { ...props, ReactView: this }));    // 渲染React组件
    }
    /** 打开视图框 */
    public open = () => {
        if (this.isOpen) return;

        const parent = this.options.parent || document.body;    // 挂载文档
        parent.appendChild(this.containerEl);                   // 挂载到文档
        this.isOpen = true;                                     // 设置状态
        this.bindEvents();                                      // 绑定事件
        this.options.onOpen?.();                                // 触发回调
    }

    /** 关闭视图框 */
    public close = () => {
        if (!this.isOpen) return;   // 判断是否开启视图
        this.root?.unmount();       // 卸载React组件
        this.root = null;           // 清理引用
        this.containerEl.remove();  // 移除DOM元素
        this.isOpen = false;        // 清除状态
        this.unbindEvents();        // 解绑事件
        this.unbindDragEvents();    // 解绑拖动事件
        this.options.onClose?.();   // 触发回调
    }

    /** 绑定事件处理 */
    private bindEvents = () => {
        this.maskEl.addEventListener("click", (e) => { if (e.target === this.maskEl) this.close(); });  // 点击遮罩关闭
        document.addEventListener("keydown", this.handleKeyDown);                                       // ESC键关闭
    }

    /** 解绑事件处理 */
    private unbindEvents = () => {
        document.removeEventListener("keydown", this.handleKeyDown);    // 解绑键盘事件
    }

    /** 键盘事件处理 */
    private handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") this.close();  // 关闭视图
    };


    /**
     * 外部组件调用此方法设置拖动句柄 必须打开  draggable?: boolean;
     * 使用: const dragRef = useCallback((node) => { if (node) { props.ReactView.setDragHandle(node) } }, [props.ReactView]);
     * 返回: <header ref={dragRef} className='i-editor__header'>
     * @param element - 拖动句柄元素
     */
    public setDragHandle(element: HTMLElement) {
        if (!this.options.config?.draggable) {
            console.warn("请先在config中启用draggable");
            return;
        }
        // 移除旧句柄事件
        if (this.dragHandleEl) this.unbindDragEvents();
        // 设置新句柄并绑定事件
        this.dragHandleEl = element;
        this.bindDragEvents();
    }

    /** 绑定拖动事件 */
    private bindDragEvents() {
        if (!this.dragHandleEl) return;
        this.dragHandleEl.addEventListener('mousedown', this.handleDragStart);
        document.addEventListener('mousemove', this.handleDragMove);
        document.addEventListener('mouseup', this.handleDragEnd);
        this.dragHandleEl.style.cursor = 'move';
    }

    /** 移除拖动事件 */
    private unbindDragEvents() {
        if (!this.dragHandleEl) return;
        this.dragHandleEl.removeEventListener('mousedown', this.handleDragStart);
        document.removeEventListener('mousemove', this.handleDragMove);
        document.removeEventListener('mouseup', this.handleDragEnd);
    }

    /** 拖动开始 */
    private handleDragStart = (e: MouseEvent) => {
        if (!this.contentEl) return;

        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        const rect = this.contentEl.getBoundingClientRect();
        this.initialLeft = rect.left;
        this.initialTop = rect.top;
        this.contentEl.classList.add('react-view__content--dragging');
    };

    /** 拖动中 */
    private handleDragMove = (e: MouseEvent) => {
        if (!this.isDragging || !this.contentEl) return;

        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;

        this.contentEl.style.left = `${this.initialLeft + dx}px`;
        this.contentEl.style.top = `${this.initialTop + dy}px`;
        this.contentEl.style.transform = 'none'; // 清除居中变换
    };

    /** 拖动结束 */
    private handleDragEnd = () => {
        if (!this.contentEl) return;
        this.isDragging = false;
        this.contentEl.classList.remove('react-view__content--dragging');
    };


    /** 静态打开方法 */
    static open<T = any>(app: App, options: ReactViewOptions<T>) {
        const view = new ReactView(app, options);
        view.open();
        return view;
    }
}

/**
 * 带有 Loading 状态的异步包装组件
 * 强制子应用在下一次宏任务之后挂载，实现点开秒级响应和骨架屏效果
 */
const AsyncViewWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        // 让出主线程确保 DOM 的框架被迅速渲染
        const timer = setTimeout(() => {
            setIsMounted(true);
        }, 10);
        return () => clearTimeout(timer);
    }, []);

    if (!isMounted) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-background text-muted-foreground animate-pulse">
                <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
                <div className="text-sm font-medium">Loading View...</div>
            </div>
        );
    }

    return <>{children}</>;
};

// 定义 I18n 参数类型
interface IPluginContext {
    sharedStyleSheet?: CSSStyleSheet;
    css?: string;
    [key: string]: any; // 允许其他属性
}

// 定义缓存标记，用于配合热更新和重复卸载
const ROOT_MAP = new WeakMap<HTMLElement, Root>();

/**
 * 通用的 ItemView React 挂载辅助函数
 * 用于将 React 节点挂载到 Obsidian 的 ItemView 容器内，同时处理以下逻辑：
 * 1. 隐藏默认 Header
 * 2. 挂载并隔离 Shadow DOM（支持复用）
 * 3. 复用旧 Root 防止内存泄露 (HMR 支持)
 * 4. 使用 adoptedStyleSheets 复用全局 CSS 避免内存和渲染开销
 */
export function mountReactView(
    contentEl: HTMLElement,
    i18n: IPluginContext,
    Component: React.ReactElement
): { root: Root, shadowRoot: ShadowRoot, mountPoint: HTMLDivElement } {
    try {
        contentEl.classList.remove('view-content');
        const header = contentEl.parentElement?.querySelector('.view-header');
        if (header) header.remove();
    } catch (e) {
        console.debug('Failed to remove header', e);
    }

    // 检查并复用已存在的 ShadowRoot，防止多次挂载报错
    let shadowRoot = contentEl.shadowRoot;
    if (!shadowRoot) {
        shadowRoot = contentEl.attachShadow({ mode: 'open' });

        // 只在初次创建时注入样式
        if (i18n.sharedStyleSheet) {
            shadowRoot.adoptedStyleSheets = [i18n.sharedStyleSheet];
        } else if (i18n.css) {
            const style = document.createElement('style');
            style.textContent = i18n.css;
            shadowRoot.appendChild(style);
        }
    }

    // 准备挂载点（并清理之前的挂载内容，防止重复）
    let mountPoint = shadowRoot.querySelector('#i18n-react-root') as HTMLDivElement;
    if (!mountPoint) {
        mountPoint = document.createElement('div');
        mountPoint.id = 'i18n-react-root';
        mountPoint.className = 'w-full h-full';
        shadowRoot.appendChild(mountPoint);
    }

    // ============================================================
    // 暗色模式同步：检测 Obsidian 的 body.theme-dark 并同步 .dark 类
    // 到 Shadow DOM 内部的挂载点，使 CSS 变量（.dark { ... }）和
    // Tailwind dark variant（@custom-variant dark (&:is(.dark *))）
    // 在 Shadow DOM 内正确生效。
    // ============================================================
    const syncDarkMode = () => {
        const isDark = document.body.classList.contains('theme-dark');
        mountPoint.classList.toggle('dark', isDark);
    };

    // 初始同步
    syncDarkMode();

    // 监听 body class 变化（Obsidian 切换主题时会修改 body.classList）
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                syncDarkMode();
            }
        }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // 将 observer 绑定到 contentEl 以便清理时断开
    (contentEl as any).__i18n_dark_observer?.disconnect();
    (contentEl as any).__i18n_dark_observer = observer;

    // 清理旧 Root 防止内存泄露 (HMR 支持)
    const oldRoot = ROOT_MAP.get(contentEl);
    if (oldRoot) {
        oldRoot.unmount();
    }

    // 渲染新的组件
    const root = createRoot(mountPoint);
    ROOT_MAP.set(contentEl, root);

    root.render(
        <React.StrictMode>
            <AsyncViewWrapper>{Component}</AsyncViewWrapper>
        </React.StrictMode>
    );

    return { root, shadowRoot, mountPoint };
}

