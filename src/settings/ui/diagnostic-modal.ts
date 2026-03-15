import { Modal, App, Setting } from "obsidian";
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

        contentEl.createEl("h2", { text: t('Settings.Ai.DiagModalTitle'), cls: "diag-modal-title" });

        const statusClass = `diag-status-${this.report.overallStatus}`;
        const statusText = this.report.overallStatus === 'healthy' ? t('Settings.Ai.DiagStatusHealthy') :
            (this.report.overallStatus === 'failed' ? t('Settings.Ai.DiagStatusFailed') : t('Settings.Ai.DiagStatusWarning'));

        const summaryEl = contentEl.createDiv({ cls: "diag-summary-container" });
        summaryEl.createSpan({ text: `${t('Settings.Ai.DiagResult')}: ` });
        summaryEl.createSpan({ text: statusText, cls: `diag-status-badge ${statusClass}` });

        const gridEl = contentEl.createDiv({ cls: "diag-grid" });

        this.renderItem(gridEl, t('Settings.Ai.DiagItemEndpoint'), this.report.endpoint);
        this.renderItem(gridEl, t('Settings.Ai.DiagItemAuth'), this.report.auth);
        this.renderItem(gridEl, t('Settings.Ai.DiagItemModel'), this.report.model);
        this.renderItem(gridEl, t('Settings.Ai.DiagItemJsonMode'), this.report.jsonMode);
        this.renderItem(gridEl, t('Settings.Ai.DiagItemJsonSchema'), this.report.jsonSchema);

        // 建议部分
        const recommendations = this.getRecommendations();
        if (recommendations.length > 0) {
            contentEl.createEl("h3", { text: t('Settings.Ai.DiagRecommendation') });
            const recList = contentEl.createEl("ul", { cls: "diag-rec-list" });
            recommendations.forEach(rec => {
                recList.createEl("li", { text: rec });
            });
        }

        // 关闭按钮
        new Setting(contentEl).addButton(btn => btn
            .setButtonText(t('Common.Actions.Confirm') || 'Confirm')
            .onClick(() => this.close())
        );

        this.addStyles();
    }

    private renderItem(parent: HTMLElement, label: string, item: DiagItem) {
        const row = parent.createDiv({ cls: "diag-item-row" });
        row.createDiv({ text: label, cls: "diag-item-label" });

        const resEl = row.createDiv({ cls: "diag-item-result" });
        const icon = item.status === 'pass' ? '✅' : (item.status === 'fail' ? '❌' : (item.status === 'warn' ? '⚠️' : '⚪'));
        resEl.createSpan({ text: `${icon} ${item.status.toUpperCase()}`, cls: `diag-status-text status-${item.status}` });

        if (item.latency !== undefined) {
            resEl.createSpan({ text: `${item.latency}ms`, cls: "diag-latency" });
        }

        if (item.tip) {
            row.createDiv({ text: item.tip, cls: "diag-item-tip" });
        }
    }

    private getRecommendations(): string[] {
        const recs: string[] = [];
        if (this.report.endpoint.status === 'fail') recs.push("Check if the API URL is correct and reachable from your network.");
        if (this.report.endpoint.status === 'warn') recs.push(this.report.endpoint.tip || "Consider checking your endpoint format.");
        if (this.report.auth.status === 'fail') recs.push("Double check your API Key. Ensure it has correct permissions.");
        if (this.report.jsonSchema.status === 'fail') recs.push("The current model/provider doesn't support Structured Outputs (JSON Schema). The plugin will use fallback methods.");
        return recs;
    }

    private addStyles() {
        if (document.getElementById('diag-modal-styles')) return;
        const style = document.createElement('style');
        style.id = 'diag-modal-styles';
        style.textContent = `
            .diag-modal-title { margin-bottom: 15px; border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 10px; }
            .diag-summary-container { margin-bottom: 20px; font-size: 1.1em; }
            .diag-status-badge { padding: 4px 12px; border-radius: 12px; font-weight: bold; margin-left: 8px; }
            .diag-status-healthy { background-color: rgba(45, 201, 55, 0.2); color: #2dc937; }
            .diag-status-warning { background-color: rgba(231, 180, 0, 0.2); color: #dbad00; }
            .diag-status-degraded { background-color: rgba(231, 120, 0, 0.2); color: #e77800; }
            .diag-status-failed { background-color: rgba(204, 50, 50, 0.2); color: #cc3232; }
            .diag-grid { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
            .diag-item-row { padding: 10px; background-color: var(--background-secondary); border-radius: 8px; border-left: 4px solid var(--background-modifier-border); }
            .diag-item-label { font-weight: bold; margin-bottom: 4px; color: var(--text-muted); font-size: 0.85em; text-transform: uppercase; }
            .diag-item-result { display: flex; align-items: center; justify-content: space-between; }
            .diag-status-text { font-family: var(--font-monospace); font-weight: bold; }
            .status-pass { color: #2dc937; }
            .status-fail { color: #cc3232; }
            .status-warn { color: #dbad00; }
            .diag-latency { font-size: 0.85em; color: var(--text-muted); background: var(--background-primary); padding: 2px 6px; border-radius: 4px; }
            .diag-item-tip { margin-top: 8px; font-size: 0.9em; color: var(--text-accent); border-top: 1px dashed var(--background-modifier-border); padding-top: 6px; }
            .diag-rec-list { margin-top: 10px; padding-left: 20px; color: var(--text-normal); }
            .diag-rec-list li { margin-bottom: 8px; }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
