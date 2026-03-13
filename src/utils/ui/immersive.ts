/**
 * 文件名称: immersive.ts
 * 模块描述: 沉浸式翻译功能管理模块，负责翻译状态恢复与本地存储清理
 * 核心功能:
 *   - 提供单例模式的ImmersiveTranslate类
 *   - 管理沉浸式翻译的激活、禁用、状态恢复和存储清理
 *
 * 开发人员: zero
 * 维护人员: zero
 * 创建日期: 2025-08-15
 *
 * 修改日期:
 *   - 2025-08-15 [v1.0.0] zero: 初始版本，实现基础功能;
 *   - 2025-XX-XX [v1.1.0] zero: 整合为单例工具类
 *
 * 注意事项:
 *   - 依赖浏览器环境API (KeyboardEvent, localStorage, indexedDB)
 *   - 清除操作包含异步操作，调用时需使用await
 *   - 清除操作不可逆，请确保用户已确认
 */

import { I18nSettings } from "src/settings/data";
import Url from "src/constants/url";

// 定义接口
declare global { interface Window { immersiveTranslateConfig: immersiveTranslateConfig } }


export class ImmersiveTranslate {
    private static instance: ImmersiveTranslate | null = null;
    private ball: HTMLElement | null = null;
    private disc: HTMLElement | null = null;
    private panel: HTMLElement | null = null;
    private isActive: boolean = false;

    private constructor() {
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): ImmersiveTranslate {
        if (!ImmersiveTranslate.instance) ImmersiveTranslate.instance = new ImmersiveTranslate();
        return ImmersiveTranslate.instance;
    }
    /**
     * 创建悬浮球
     */
    private createball(): void {
        // 如果悬浮球已经存在，则先移除
        this.removeball();
        // 创建悬浮球元素
        this.ball = document.createElement('div');
        this.ball.id = 'immersive-translate-ball';
        // 设置悬浮球图标
        this.ball.innerHTML = '<svg t="1759459310417" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1662" width="20" height="20"><path d="M213.333333 640v85.333333a85.333333 85.333333 0 0 0 78.933334 85.12L298.666667 810.666667h128v85.333333H298.666667a170.666667 170.666667 0 0 1-170.666667-170.666667v-85.333333h85.333333z m554.666667-213.333333l187.733333 469.333333h-91.946666l-51.242667-128h-174.506667l-51.157333 128h-91.904L682.666667 426.666667h85.333333z m-42.666667 123.093333L672.128 682.666667h106.325333L725.333333 549.76zM341.333333 85.333333v85.333334h170.666667v298.666666H341.333333v128H256v-128H85.333333V170.666667h170.666667V85.333333h85.333333z m384 42.666667a170.666667 170.666667 0 0 1 170.666667 170.666667v85.333333h-85.333333V298.666667a85.333333 85.333333 0 0 0-85.333334-85.333334h-128V128h128zM256 256H170.666667v128h85.333333V256z m170.666667 0H341.333333v128h85.333334V256z" fill="currentColor"  p-id="1663"></path></svg>';
        this.ball.addEventListener('click', this.toggleTranslate.bind(this));  // 添加点击事件
        this.makeDraggable(this.ball);  // 使悬浮球可拖动

        // 创建面板元素
        this.panel = document.createElement('div');
        this.panel.id = 'immersive-translate-panel';
        this.ball.appendChild(this.panel);

        // 创建默认隐藏的disc元素
        this.disc = document.createElement('div');
        this.disc.id = 'immersive-translate-disc';
        this.ball.appendChild(this.disc);

        document.body.appendChild(this.ball);
    }

    /**
     * 移除悬浮球
     */
    private removeball(): void {
        if (this.ball && this.ball.parentNode) { this.ball.parentNode.removeChild(this.ball); this.ball = null; }
    }

    /**
    * 使元素可拖动（只允许上下拖动）
    */
    private makeDraggable(element: HTMLElement): void {
        let isDragging = false;
        let startY: number;
        let initialTop: number;

        // 鼠标按下事件
        element.addEventListener('mousedown', (e) => {
            // 只有当点击目标是元素本身（而不是子元素）时才触发拖动
            if (e.button !== 0 && e.target !== element) return;
            e.preventDefault(); // 防止文本选择等默认行为
            isDragging = true;
            startY = e.clientY;
            // 获取元素当前的top位置
            const rect = element.getBoundingClientRect();
            initialTop = rect.top;
        });

        // 鼠标移动事件
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();

            // 获取当前位置信息
            const viewportHeight = window.innerHeight;
            const elementHeight = element.offsetHeight;

            // 计算垂直方向的新位置
            const deltaY = e.clientY - startY;
            let newTop = initialTop + deltaY;

            // 限制在视口内
            newTop = Math.max(0, Math.min(newTop, viewportHeight - elementHeight));

            // 设置新位置（水平位置保持在右侧不变）
            element.style.top = `${newTop}px`;
            element.style.bottom = 'auto';
            element.style.right = `0px`; // 保持右侧位置不变
        });

        // 鼠标松开事件
        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
        });
    }

    /**
     * 切换翻译面板的显示状态
     */
    private toggleTranslate(e: MouseEvent): void {
        // 只有当点击目标是ball元素本身时才触发
        if (e && this.panel && e.target instanceof Node && this.panel.contains(e.target)) return;

        // 直接使用类实例的panel属性
        if (this.panel) {
            // 如果面板已存在，则切换其显示状态
            if (this.panel.style.display === 'none') {
                this.panel.style.display = 'flex';
                this.isActive = true;
            } else {
                this.panel.style.display = 'none';
                this.isActive = false;
            }
        } else {
            // 这种情况实际上不应该发生，因为面板在createball中已经创建
            // console.error('面板不存在，这是异常情况');
        }
    }

    public activate(settings: I18nSettings) {
        if (!window.immersiveTranslateConfig) {
            this.createball();
            window.immersiveTranslateConfig = {
                partnerId: "immersive-translate-sdk", //联盟 id
                mountPoint: { selector: "#immersive-translate-panel", action: "child" },
                disclaimerPoint: { selector: "#immersive-translate-disc", action: "child" },
                pageRule: {
                    selectors: settings.imtPagerule.selectors,
                    excludeSelectors: settings.imtPagerule.excludeSelectors
                },
            };

            // 创建一个新的script元素  
            const script = document.createElement('script');
            // 设置script元素为异步加载  
            script.async = true;
            // 设置script元素的src属性为Url.SDK_URL，这里Url.SDK_URL应该是在其他地方定义的SDK地址  
            script.src = Url.SDK_URL;
            // 将script元素添加到文档的body中，这样浏览器就会加载并执行这个脚本
            document.body.append(script);
        }
    }

    public deactivate() {
        document.location.reload();
    }


}

// 导出单例实例，方便直接使用
const immersiveTranslate = ImmersiveTranslate.getInstance();
export default immersiveTranslate;

// 为了保持向后兼容性，保留原有函数的导出
// @deprecated 使用ImmersiveTranslate类替代
const activateIMT = immersiveTranslate.activate.bind(immersiveTranslate);
// @deprecated 使用ImmersiveTranslate类替代
const deactivateIMT = immersiveTranslate.deactivate.bind(immersiveTranslate);

export { activateIMT, deactivateIMT };




export interface immersiveTranslateConfig {
    // 联盟 id
    partnerId: string,
    // 翻译按钮挂载点
    mountPoint: {
        selector: string;
        action: 'append' | 'child' | 'before' | 'replace';
    },
    // 翻译结果声明挂载点（可选）默认跟在翻译按钮后面
    disclaimerPoint: {
        selector: string;
        action: 'append' | 'child' | 'before' | 'replace';
    },
    pageRule: pageRule
}

export interface pageRule {
    mainFrameSelector?: string | string[];              // 翻译的根节点范围
    selectors?: string[];                               // 仅翻译匹配到的元素
    excludeSelectors?: string[];                        // 排除元素，不翻译匹配的元素
    stayOriginalSelectors?: string | string[];          // 匹配的元素将保持原样。常用于论坛网站的标签。
    extraBlockSelectors?: string | string[];            // 额外的选择器，匹配的元素将作为 block 元素，独占一行。
    extraInlineSelectors?: string | string[];           // 额外的选择器，匹配的元素将作为 inline 元素。
    translationClasses?: string | string | string[];    // 为译文添加额外的 Class
    injectedCss?: string | string[];                    // 嵌入 CSS 样式
}