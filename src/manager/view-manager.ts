/**
 * 文件名称: view.ts
 * 模块描述: 视图管理工具类，负责处理Obsidian工作区视图的激活与分离逻辑
 * 核心功能:
 *   - ObsidianView: 视图实例类，封装单个视图的激活/停用逻辑
 *   - ViewManager: 视图管理单例，负责多视图实例的注册与管理
 *
 * 开发人员: zero
 * 维护人员: zero
 * 创建日期: 2025-08-18
 *
 * 修改日期:
 *   - 2025-09-01 [v1.0.0] zero: 初始版本，实现基础功能;
 *
 * 注意事项: 
 *   - 依赖Obsidian的App和WorkspaceLeaf类型
 *   - 使用前需确保视图类型已注册
 *   - leafType参数支持'window'|'split'|'tab'|true四种模式
 */

import { ViewCreator, WorkspaceLeaf } from "obsidian";
import I18N from "src/main";

/**
 * 视图实例类
 * 封装单个视图的激活、停用逻辑
 */
export class ObsidianView {
    private i18n: I18N
    private viewType: string
    private leafType: 'window' | 'split' | 'tab' | true = 'window';

    private viewOption?: { width?: number, height?: number };

    constructor(i18n: I18N, viewType: string, viewCreator: ViewCreator, leafType: 'window' | 'split' | 'tab' | true, viewOption?: { width?: number, height?: number }) {
        if (!i18n) throw new Error("i18n 实例不可为空");
        if (!viewType) throw new Error("视图类型 type 不可为空");
        if (!viewCreator) throw new Error("视图创建器 viewCreator 不可为空");
        this.i18n = i18n;
        this.viewType = viewType;
        this.leafType = leafType;
        this.viewOption = viewOption;
        this.i18n.registerView(this.viewType, viewCreator);
    }

    // 激活视图
    public async activate(): Promise<void> {
        const { workspace } = this.i18n.app;

        // 确保工作区布局已加载完成
        await new Promise(resolve => workspace.onLayoutReady(() => resolve(null)));

        this.deactivate();
        let workspaceLeaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(this.viewType);
        if (leaves.length > 0) {
            workspaceLeaf = leaves[0];
        } else {
            try {
                // @ts-ignore
                workspaceLeaf = workspace.getLeaf(this.leafType);
            } catch (e) {
                // 如果指定的 leafType (比如 true, 'tab') 失败（如无可用标签页组），尝试回退到新窗口
                console.warn(`[i18n] Failed to get leaf of type ${this.leafType}, falling back to 'window':`, e);
                workspaceLeaf = workspace.getLeaf('window');
            }

            if (workspaceLeaf) {
                await workspaceLeaf.setViewState({ type: this.viewType, active: true });
                // 如果是新窗口模式且有尺寸配置，尝试调整窗口大小
                // @ts-ignore
                if ((this.leafType === 'window' || workspaceLeaf.containerEl.ownerDocument !== document) && this.viewOption) {
                    const win = (workspaceLeaf.view.containerEl.ownerDocument as Document).defaultView;
                    if (win) {
                        const width = this.viewOption.width || win.outerWidth;
                        const height = this.viewOption.height || win.outerHeight;
                        win.resizeTo(width, height);

                        // 计算居中位置
                        const left = (win.screen.availWidth - width) / 2;
                        const top = (win.screen.availHeight - height) / 2;
                        win.moveTo(left, top);
                    }
                }
            }
        }
        if (workspaceLeaf) workspace.revealLeaf(workspaceLeaf);
    }

    // 停用视图
    public deactivate() {
        this.i18n.app.workspace.detachLeavesOfType(this.viewType);
    }
}

/**
 * 视图管理工具类 (单例模式)
 * 封装通用的视图激活和分离逻辑，确保全局唯一实例
 */
export class ViewManager {
    private static instance: ViewManager | null = null;
    private views: Map<string, ObsidianView>;
    private i18n: I18N;

    // 私有构造函数，防止外部实例化
    private constructor(i18n: I18N) {
        this.i18n = i18n;
        this.views = new Map();
    }

    /**
     * 获取单例实例
     * @param i18n I18N 主实例
     * @returns ViewManager 单例
     * @throws 当尝试使用不同 I18N 实例初始化时抛出错误
     */
    public static getInstance(i18n: I18N): ViewManager {
        if (!i18n) throw new Error("i18n 实例不可为空");
        if (!ViewManager.instance) {
            ViewManager.instance = new ViewManager(i18n);
        } else if (ViewManager.instance.i18n !== i18n) {
            throw new Error("ViewManager 已使用不同的 I18N 实例初始化");
        }
        return ViewManager.instance;
    }

    /**
     * 添加视图到管理器
     * @param viewType 视图类型
     * @param viewCreator 视图创建器
     * @param leafType 叶子类型
     * @returns 创建的 ObsidianView 实例
     */
    addView(viewType: string, viewCreator: ViewCreator, leafType: 'window' | 'split' | 'tab' | true = 'window', viewOption?: { width?: number, height?: number }): ObsidianView {
        if (this.views.has(viewType)) throw new Error(`视图类型 ${viewType} 已存在`);
        const view = new ObsidianView(this.i18n, viewType, viewCreator, leafType, viewOption);
        this.views.set(viewType, view);
        return view;
    }

    /**
     * 获取指定类型的视图
     * @param viewType 视图类型
     * @returns ObsidianView 实例或 undefined
     */
    getView(viewType: string): ObsidianView | undefined {
        return this.views.get(viewType);
    }

    /**
     * 获取所有视图
     * @returns ObsidianView 实例数组
     */
    getAllViews(): ObsidianView[] {
        return Array.from(this.views.values());
    }

    /**
     * 激活指定类型的视图
     * @param viewType 视图类型
     */
    async activateView(viewType: string): Promise<void> {
        const view = this.getView(viewType);
        if (view) {
            await view.activate();
        } else {
            throw new Error(`视图类型 ${viewType} 不存在`);
        }
    }

    /**
     * 停用指定类型的视图
     * @param viewType 视图类型
     */
    deactivateView(viewType: string): void {
        const view = this.getView(viewType);
        if (view) {
            view.deactivate();
        } else {
            throw new Error(`视图类型 ${viewType} 不存在`);
        }
    }

    /**
     * 停用所有视图
     */
    deactivateAllViews(): void {
        this.views.forEach(view => view.deactivate());
    }

    /**
     * 移除指定类型的视图
     * @param viewType 视图类型
     */
    removeView(viewType: string): void {
        const view = this.views.get(viewType);
        if (view) {
            view.deactivate();
            this.views.delete(viewType);
        }
    }

    /**
     * 移除所有视图
     */
    removeAllViews(): void {
        this.deactivateAllViews();
        this.views.clear();
    }
}