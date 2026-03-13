/**
 * 文件名称: notification.ts
 * 模块描述: 插件通知系统管理模块，负责统一管理各类用户提示与反馈
 * 核心功能:
 *   - 支持五种通知类型(primary/success/info/warning/error)的快捷创建（带前缀/无前缀双版本）
 *   - 自动适配明暗主题样式
 *   - 实现通知队列管理与自动清理
 *   - 提供操作结果统一反馈接口（带前缀/无前缀双版本）
 *   - 支持通知强制清除(reload方法)
 *
 * 开发人员: zero
 * 维护人员: zero
 * 创建日期: 2025-08-15
 *
 * 修改日期:
 *   - 2025-08-15 [v1.0.0] zero: 初始版本，实现基础通知类型与主题适配功能;
 *   - 2025-12-12 [v1.1.0] zero: 新增无前缀通知方法，重命名原有带前缀方法，提取公共逻辑;
 *
 * 注意事项: 依赖Obsidian的Notice API，通知样式类前缀为"notice__"，最大通知队列长度为100条
 * [图标/Emoji] + [上下文前缀] + [核心结论 (加粗)] + [辅助信息 (换行/灰色)]
 */

import { Notice } from 'obsidian';
import I18N from '../main';
import { t } from '../locales';

export class NoticeManager {
    i18n: I18N;
    notices: Notice[] = [];
    private static instance: NoticeManager | null = null;
    // 最大通知队列长度常量（提升可维护性）
    private static readonly MAX_NOTICE_QUEUE = 100;

    private constructor(i18n: I18N) {
        this.i18n = i18n;
    }

    public static getInstance(i18n: I18N): NoticeManager {
        if (!NoticeManager.instance) {
            NoticeManager.instance = new NoticeManager(i18n);
        }
        return NoticeManager.instance;
    }

    // ===================== 公共工具方法 =====================

    /**
     * 私有方法：创建通知并添加样式类 (已迁移至 Tailwind CSS)
     * @param content 通知内容
     * @param type 通知类型（primary/success/info/warning/error）
     * @param duration 显示时长
     * @returns Notice实例
     */
    private createNotice(content: string, type: string, duration: number): Notice {
        const icons: Record<string, string> = {
            primary: '✨',
            success: '✅',
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌'
        };

        const finalContent = `${icons[type] || ''} ${content}`;
        const notice = new Notice(finalContent, duration);

        // 应用 Tailwind CSS 基础样式
        // 注意：Obsidian Notice 容器已有默认样式，此处通过 addClass 叠加
        notice.containerEl.addClass(
            'rounded-lg', 'border', 'shadow-md', 'backdrop-blur-md', 'p-4', 'mb-2',
            'animate-in', 'fade-in', 'slide-in-from-right-4', 'duration-300'
        );

        // 应用类型特定样式
        switch (type) {
            case 'primary':
                notice.containerEl.addClass('bg-primary/10', 'text-primary', 'border-primary/20');
                break;
            case 'success':
                notice.containerEl.addClass('bg-emerald-500/10', 'text-emerald-600', 'border-emerald-500/20');
                break;
            case 'info':
                notice.containerEl.addClass('bg-sky-500/10', 'text-sky-600', 'border-sky-500/20');
                break;
            case 'warning':
                notice.containerEl.addClass('bg-amber-500/10', 'text-amber-600', 'border-amber-500/20');
                break;
            case 'error':
                notice.containerEl.addClass('bg-destructive/10', 'text-destructive', 'border-destructive/20');
                break;
        }

        return notice;
    }

    /**
     * 私有方法：添加通知到队列并清理超限队列
     * @param notice 通知实例
     */
    private addNotice(notice: Notice) {
        if (this.notices.length >= NoticeManager.MAX_NOTICE_QUEUE) {
            this.notices[0].containerEl.remove();
            this.notices.shift();
        }
        this.notices.push(notice);
    }

    // ===================== 无前缀通知方法（新增） =====================
    /**
     * 无前缀 - 主要通知
     * @param text 通知文本
     * @param duration 显示时长（默认4000ms）
     */
    primary(text: unknown, duration = 4000) {
        const notice = this.createNotice(`${text}`, 'primary', duration);
        this.addNotice(notice);
    }

    /**
     * 无前缀 - 成功通知
     * @param text 通知文本
     * @param duration 显示时长（默认4000ms）
     */
    success(text: unknown, duration = 4000) {
        const notice = this.createNotice(`${text}`, 'success', duration);
        this.addNotice(notice);
    }

    /**
     * 无前缀 - 信息通知
     * @param text 通知文本
     * @param duration 显示时长（默认4000ms）
     */
    info(text: unknown, duration = 4000) {
        const notice = this.createNotice(`${text}`, 'info', duration);
        this.addNotice(notice);
    }

    /**
     * 无前缀 - 警告通知
     * @param text 通知文本
     * @param duration 显示时长（默认4000ms）
     */
    warning(text: unknown, duration = 4000) {
        const notice = this.createNotice(`${text}`, 'warning', duration);
        this.addNotice(notice);
    }

    /**
     * 无前缀 - 错误通知
     * @param text 通知文本
     * @param duration 显示时长（默认10000ms）
     */
    error(text: unknown, duration = 10000) {
        const notice = this.createNotice(`${text}`, 'error', duration);
        this.addNotice(notice);
    }

    // ===================== 带前缀通知方法（原方法重命名） =====================
    /**
     * 带前缀 - 主要通知（原primary方法）
     * @param prefix 前缀文本
     * @param text 通知文本
     * @param duration 显示时长（默认4000ms）
     */
    primaryPrefix(prefix: string, text: unknown, duration = 4000) {
        const notice = this.createNotice(`[${prefix}] ${text}`, 'primary', duration);
        this.addNotice(notice);
    }

    /**
     * 带前缀 - 成功通知（原success方法）
     * @param prefix 前缀文本
     * @param text 通知文本
     * @param duration 显示时长（默认4000ms）
     */
    successPrefix(prefix: string, text: unknown, duration = 4000) {
        const notice = this.createNotice(`[${prefix}] ${text}`, 'success', duration);
        this.addNotice(notice);
    }

    /**
     * 带前缀 - 信息通知（原info方法）
     * @param prefix 前缀文本
     * @param text 通知文本
     * @param duration 显示时长（默认4000ms）
     */
    infoPrefix(prefix: string, text: unknown, duration = 4000) {
        const notice = this.createNotice(`[${prefix}] ${text}`, 'info', duration);
        this.addNotice(notice);
    }

    /**
     * 带前缀 - 警告通知（原warning方法）
     * @param prefix 前缀文本
     * @param text 通知文本
     * @param duration 显示时长（默认4000ms）
     */
    warningPrefix(prefix: string, text: unknown, duration = 4000) {
        const notice = this.createNotice(`[${prefix}] ${text}`, 'warning', duration);
        this.addNotice(notice);
    }

    /**
     * 带前缀 - 错误通知（原error方法）
     * @param prefix 前缀文本
     * @param text 通知文本
     * @param duration 显示时长（默认10000ms）
     */
    errorPrefix(prefix: string, text: unknown, duration = 10000) {
        const notice = this.createNotice(`[${prefix}] ${text}`, 'error', duration);
        this.addNotice(notice);
    }

    // ===================== 操作结果反馈方法（带前缀/无前缀） =====================
    /**
     * 带前缀 - 操作结果反馈（原result方法）
     * @param prefix 前缀文本
     * @param isSuccess 是否成功
     * @param text 附加文本（可选）
     * @param duration 显示时长（默认4000ms）
     */
    resultPrefix(prefix: string, isSuccess: boolean, text: unknown = "", duration = 4000) {
        let content: string;
        if (isSuccess) {
            content = text ? `[${prefix}] ${t('common.success')}\n${text}` : `[${prefix}] ${t('common.success')}`;
        } else {
            content = `[${prefix}] ${t('common.failure')}\n${text}`;
        }
        const notice = this.createNotice(
            content,
            isSuccess ? 'success' : 'error',
            isSuccess ? duration : 10000
        );
        this.addNotice(notice);
    }

    /**
     * 无前缀 - 操作结果反馈（新增）
     * @param isSuccess 是否成功
     * @param text 附加文本（可选）
     * @param duration 显示时长（默认4000ms）
     */
    result(isSuccess: boolean, text: unknown = "", duration = 4000) {
        let content: string;
        if (isSuccess) {
            content = text ? `${t('common.success')}\n${text}` : t('common.success');
        } else {
            content = `${t('common.failure')}\n${text}`;
        }
        const notice = this.createNotice(
            content,
            isSuccess ? 'success' : 'error',
            isSuccess ? duration : 10000
        );
        this.addNotice(notice);
    }

    /**
     * 强制清除所有通知
     */
    reload() {
        this.notices.forEach(notice => notice.containerEl.remove());
        this.notices.length = 0;
    }
}
