/**
 * 文件名称: index.ts
 * 模块描述: API 统一出口模块，提供聚合式 API 调用能力
 *            通过单一入口管理所有服务模块，简化外部调用流程
 *
 * 核心功能:
 *   - 聚合 Gitee/Baidu/OpenAI/GitHub 等服务模块
 *   - 提供统一实例化接口（APIManager）
 *   - 支持链式调用各服务模块方法
 *
 * 开发人员: zero
 * 维护人员: zero
 * 创建日期: 2025-08-17
 *
 * 修改日期:
 *   - 2025-08-17 [v1.0.0] zero: 初始版本，实现基础聚合功能;
 *
 * 依赖模块:
 *   - I18N: 全局配置与工具实例
 *   - 各服务模块: gitee.ts/bidu.ts/openai.ts/github.ts
 *
 * 注意事项:
 *   - 外部使用需先实例化 I18N 并传入 APIClient
 *   - 各服务模块需保证构造函数接收 I18N 参数
 *   - 新增服务模块需在此处同步注册
 */
import { GitHubAPI } from '../api/github';
import I18N from 'main';

/**
 * API 聚合客户端
 * 外部通过 new APIClient(i18n) 创建统一 API 对象
 */
export class APIManager {
    private static instance: APIManager | null = null;
    // 各服务模块实例
    public github: GitHubAPI;

    /**
     * 初始化 API 客户端
     * @param i18n 共享的 I18N 实例
     */
    private constructor(i18n: I18N) {
        this.github = new GitHubAPI(i18n);
    }

    /**
     * 获取单例实例
     * @param app Obsidian应用实例
     * @returns ViewManager单例
     */
    public static getInstance(i18n: I18N): APIManager {
        if (!APIManager.instance) {
            APIManager.instance = new APIManager(i18n);
        }
        return APIManager.instance;
    }
}