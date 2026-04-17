import { Modal, App, setIcon } from "obsidian";
import { DeepDiagnosticReport, DiagItem } from "src/utils/ai/connectivity-tester";
import { t } from "src/locales";

export class DiagnosticModal extends Modal {
    private report: DeepDiagnosticReport;

    constructor(app: App, report: DeepDiagnosticReport) {
        super(app);
        this.report = report;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('i18n-diag-modal');
        this.addStyles();

        // ── 总览卡片 ──
        const overviewCard = contentEl.createDiv({ cls: 'diag-overview' });
        const statusMap: Record<string, { icon: string; label: string; cls: string }> = {
            healthy: { icon: 'check-circle-2', label: t('Settings.Ai.DiagStatusHealthy'), cls: 'diag-healthy' },
            warning: { icon: 'alert-triangle', label: t('Settings.Ai.DiagStatusWarning'), cls: 'diag-warning' },
            degraded: { icon: 'alert-triangle', label: t('Settings.Ai.DiagStatusWarning'), cls: 'diag-warning' },
            failed: { icon: 'x-circle', label: t('Settings.Ai.DiagStatusFailed'), cls: 'diag-failed' },
        };
        const s = statusMap[this.report.overallStatus] || statusMap.failed;

        const statusIconEl = overviewCard.createDiv({ cls: `diag-overview-icon ${s.cls}` });
        setIcon(statusIconEl, s.icon);
        const statusInfo = overviewCard.createDiv({ cls: 'diag-overview-info' });
        statusInfo.createDiv({ text: t('Settings.Ai.DiagModalTitle'), cls: 'diag-overview-title' });
        statusInfo.createDiv({ text: s.label, cls: `diag-overview-badge ${s.cls}` });

        // ── 检测项列表 ──
        const items: { label: string; item: DiagItem }[] = [
            { label: t('Settings.Ai.DiagItemEndpoint'), item: this.report.endpoint },
            { label: t('Settings.Ai.DiagItemAuth'), item: this.report.auth },
            { label: t('Settings.Ai.DiagItemModel'), item: this.report.model },
            { label: t('Settings.Ai.DiagItemSystemRole'), item: this.report.systemRole },
            { label: t('Settings.Ai.DiagItemJsonMode'), item: this.report.jsonMode },
            { label: t('Settings.Ai.DiagItemJsonSchema'), item: this.report.jsonSchema },
            { label: t('Settings.Ai.DiagItemTranslation'), item: this.report.translation },
        ];

        const listEl = contentEl.createDiv({ cls: 'diag-list' });
        for (const { label, item } of items) {
            this.renderRow(listEl, label, item);
        }

        // ── 建议区 ──
        const recs = this.getRecommendations();
        if (recs.length > 0) {
            const recSection = contentEl.createDiv({ cls: 'diag-recs' });
            const recHeader = recSection.createDiv({ cls: 'diag-recs-header' });
            const recIconEl = recHeader.createDiv({ cls: 'diag-recs-icon' });
            setIcon(recIconEl, 'lightbulb');
            recHeader.createSpan({ text: t('Settings.Ai.DiagRecommendation') });
            for (const rec of recs) {
                recSection.createDiv({ text: rec, cls: 'diag-rec-item' });
            }
        }

        // ── 调试日志 (控制台) ──
        if (this.report.logs && this.report.logs.length > 0) {
            const logsSection = contentEl.createDiv({ cls: 'diag-logs-section' });

            const logsHeader = logsSection.createDiv({ cls: 'diag-logs-header' });
            setIcon(logsHeader.createSpan({ cls: 'diag-logs-icon' }), 'terminal');
            logsHeader.createSpan({ text: '诊断控制台日志 (点击展开/折叠)', cls: 'diag-logs-title' });

            const logsContent = logsSection.createDiv({ cls: 'diag-logs-content' });
            // 如果报错则默认展开，否则默认收起
            const hasErrors = this.report.logs.some(l => l.level === 'error');
            if (!hasErrors) logsContent.style.display = 'none';

            logsHeader.addEventListener('click', () => {
                logsContent.style.display = logsContent.style.display === 'none' ? 'block' : 'none';
            });

            for (const log of this.report.logs) {
                const logEl = logsContent.createDiv({ cls: `diag-log-line diag-log-${log.level}` });
                logEl.createSpan({ text: `[${log.stage}]`, cls: 'diag-log-stage' });
                logEl.createSpan({ text: log.message, cls: 'diag-log-msg' });
            }
        }

        // ── 关闭按钮 ──
        const footer = contentEl.createDiv({ cls: 'diag-footer' });
        const closeBtn = footer.createEl('button', { text: '关闭', cls: 'mod-cta' });
        closeBtn.addEventListener('click', () => this.close());
    }

    private renderRow(parent: HTMLElement, label: string, item: DiagItem) {
        const row = parent.createDiv({ cls: 'diag-row' });

        // 状态指示点
        const dotCls = item.status === 'pass' ? 'diag-dot-pass' :
            item.status === 'fail' ? 'diag-dot-fail' :
                item.status === 'warn' ? 'diag-dot-warn' : 'diag-dot-na';
        row.createDiv({ cls: `diag-dot ${dotCls}` });

        // 标签
        row.createDiv({ text: label, cls: 'diag-row-label' });

        // 右侧信息
        const right = row.createDiv({ cls: 'diag-row-right' });

        if (item.latency !== undefined) {
            right.createSpan({ text: `${item.latency}ms`, cls: 'diag-latency-tag' });
        }

        const statusLabel = item.status === 'pass' ? 'PASS' :
            item.status === 'fail' ? 'FAIL' :
                item.status === 'warn' ? 'WARN' : '—';
        right.createSpan({ text: statusLabel, cls: `diag-status-label diag-sl-${item.status}` });

        // 提示信息
        if (item.tip) {
            const tipEl = parent.createDiv({ cls: 'diag-row-tip' });
            tipEl.createSpan({ text: item.tip });
        }
    }

    private getRecommendations(): string[] {
        const recs: string[] = [];
        if (this.report.endpoint.status === 'fail') recs.push(t('Settings.Ai.DiagTipUrlV1'));
        if (this.report.endpoint.status === 'warn') recs.push(this.report.endpoint.tip || t('Settings.Ai.DiagTipUrlV1'));
        if (this.report.auth.status === 'fail') recs.push(t('Settings.Ai.TestFail401'));
        if (this.report.jsonSchema.status === 'fail') recs.push(t('Settings.Ai.DiagTipModelFallback'));
        if (this.report.auth.status === 'pass' && this.report.model.status === 'fail') recs.push(t('Settings.Ai.TestFailModel'));
        return recs;
    }

    private addStyles() {
        if (document.getElementById('i18n-diag-styles')) return;
        const style = document.createElement('style');
        style.id = 'i18n-diag-styles';
        style.textContent = `
            .i18n-diag-modal { padding: 0; }

            /* ── 总览卡片 ── */
            .diag-overview {
                display: flex; align-items: center; gap: 16px;
                padding: 20px; margin-bottom: 16px;
                border-radius: 12px;
                background: var(--background-secondary);
            }
            .diag-overview-icon {
                width: 48px; height: 48px; border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                flex-shrink: 0;
            }
            .diag-overview-icon.diag-healthy { background: rgba(45,201,55,0.15); color: #2dc937; }
            .diag-overview-icon.diag-warning { background: rgba(231,180,0,0.15); color: #dbad00; }
            .diag-overview-icon.diag-failed  { background: rgba(204,50,50,0.15);  color: #cc3232; }
            .diag-overview-icon svg { width: 24px; height: 24px; }
            .diag-overview-title {
                font-size: 1.1em; font-weight: 600;
                color: var(--text-normal); margin-bottom: 4px;
            }
            .diag-overview-badge {
                display: inline-block; font-size: 0.8em; font-weight: 600;
                padding: 2px 10px; border-radius: 99px;
            }
            .diag-overview-badge.diag-healthy { background: rgba(45,201,55,0.15); color: #2dc937; }
            .diag-overview-badge.diag-warning { background: rgba(231,180,0,0.15); color: #dbad00; }
            .diag-overview-badge.diag-failed  { background: rgba(204,50,50,0.15);  color: #cc3232; }

            /* ── 检测项列表 ── */
            .diag-list { display: flex; flex-direction: column; gap: 2px; margin-bottom: 16px; }
            .diag-row {
                display: flex; align-items: center; gap: 12px;
                padding: 10px 14px; border-radius: 8px;
                background: var(--background-secondary);
                transition: background 0.15s;
            }
            .diag-row:hover { background: var(--background-modifier-hover); }

            .diag-dot {
                width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
            }
            .diag-dot-pass { background: #2dc937; box-shadow: 0 0 6px rgba(45,201,55,0.4); }
            .diag-dot-fail { background: #cc3232; box-shadow: 0 0 6px rgba(204,50,50,0.4); }
            .diag-dot-warn { background: #dbad00; box-shadow: 0 0 6px rgba(231,180,0,0.4); }
            .diag-dot-na   { background: var(--text-faint); }

            .diag-row-label { flex: 1; font-size: 0.92em; color: var(--text-normal); }
            .diag-row-right { display: flex; align-items: center; gap: 8px; }

            .diag-latency-tag {
                font-size: 0.78em; font-family: var(--font-monospace);
                color: var(--text-muted); background: var(--background-primary);
                padding: 1px 6px; border-radius: 4px;
            }
            .diag-status-label {
                font-size: 0.75em; font-weight: 700; font-family: var(--font-monospace);
                padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px;
            }
            .diag-sl-pass { background: rgba(45,201,55,0.12); color: #2dc937; }
            .diag-sl-fail { background: rgba(204,50,50,0.12); color: #cc3232; }
            .diag-sl-warn { background: rgba(231,180,0,0.12); color: #dbad00; }
            .diag-sl-na   { background: var(--background-modifier-border); color: var(--text-faint); }

            .diag-row-tip {
                padding: 6px 14px 6px 34px;
                font-size: 0.82em; color: var(--text-muted);
                line-height: 1.5;
            }

            /* ── 建议区 ── */
            .diag-recs {
                border-radius: 8px; padding: 14px;
                background: rgba(231,180,0,0.06);
                border: 1px solid rgba(231,180,0,0.15);
                margin-bottom: 16px;
            }
            .diag-recs-header {
                display: flex; align-items: center; gap: 8px;
                font-weight: 600; font-size: 0.9em;
                color: #dbad00; margin-bottom: 10px;
            }
            .diag-recs-icon svg { width: 16px; height: 16px; }
            .diag-rec-item {
                font-size: 0.85em; color: var(--text-normal);
                padding: 4px 0 4px 24px; position: relative; line-height: 1.5;
            }
            .diag-rec-item::before {
                content: '→'; position: absolute; left: 6px;
                color: var(--text-muted);
            }

            /* ── 页脚 ── */
            .diag-footer {
                display: flex; justify-content: flex-end;
                padding-top: 8px;
                border-top: 1px solid var(--background-modifier-border);
            }

            /* ── 调试日志 ── */
            .diag-logs-section {
                margin-bottom: 16px; border-radius: 8px;
                border: 1px solid var(--background-modifier-border);
                overflow: hidden;
            }
            .diag-logs-header {
                display: flex; align-items: center; gap: 8px;
                padding: 10px 14px; background: var(--background-secondary-alt);
                cursor: pointer; font-size: 0.85em; font-weight: 600;
                color: var(--text-muted); transition: all 0.15s;
            }
            .diag-logs-header:hover { background: var(--background-modifier-hover); color: var(--text-normal); }
            .diag-logs-icon svg { width: 14px; height: 14px; }
            .diag-logs-content {
                background: var(--background-primary-alt); padding: 12px;
                border-top: 1px solid var(--background-modifier-border);
                max-height: 200px; overflow-y: auto;
                font-family: var(--font-monospace); font-size: 0.75em;
            }
            .diag-log-line { margin-bottom: 4px; line-height: 1.4; word-break: break-all; }
            .diag-log-info { color: var(--text-muted); }
            .diag-log-warn { color: #dbad00; }
            .diag-log-error { color: #cc3232; }
            .diag-log-stage { color: var(--text-accent); margin-right: 8px; font-weight: 600; }
            .diag-log-msg { white-space: pre-wrap; font-family: inherit; }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        this.contentEl.empty();
    }
}
