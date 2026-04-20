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
        this.addStyles();
        this.displayReport();
    }

    public updateReport(report: DeepDiagnosticReport) {
        this.report = report;
        this.displayReport();
    }

    private displayReport() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('i18n-diag-modal');

        // ── 总览卡片 ──
        const overviewCard = contentEl.createDiv({ cls: 'diag-overview' });
        const statusMap: Record<string, { icon: string; label: string; cls: string }> = {
            healthy: { icon: 'check-circle-2', label: t('Settings.Ai.DiagStatusHealthy'), cls: 'diag-healthy' },
            warning: { icon: 'alert-triangle', label: t('Settings.Ai.DiagStatusWarning'), cls: 'diag-warning' },
            degraded: { icon: 'alert-triangle', label: t('Settings.Ai.DiagStatusWarning'), cls: 'diag-warning' },
            failed: { icon: 'x-circle', label: t('Settings.Ai.DiagStatusFailed'), cls: 'diag-failed' },
        };

        // 如果还在测试中，显示“诊断进行中”
        const isTesting = [
            this.report.endpoint,
            this.report.auth,
            this.report.model,
            this.report.systemRole,
            this.report.jsonMode,
            this.report.jsonSchema,
            this.report.translation,
            this.report.translationFix,
            this.report.concurrency
        ].some(item => item && item.status === 'testing');

        const s = isTesting ? { icon: 'loader-2', label: '诊断正在进行中...', cls: 'diag-warning testing-anim' }
            : (statusMap[this.report.overallStatus] || statusMap.failed);

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

        if (this.report.translationFix) {
            items.push({ label: '译文修复功能 (Fix API)', item: this.report.translationFix });
        }

        if (this.report.concurrency) {
            items.push({ label: t('Settings.Ai.DiagItemConcurrency'), item: this.report.concurrency });
        }

        const listEl = contentEl.createDiv({ cls: 'diag-list' });
        for (const { label, item } of items) {
            this.renderRow(listEl, label, item);
        }

        // ── 建议区 (非测试中才显示) ──
        if (!isTesting) {
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
            // 如果在测试中，始终展开日志以提供实时反馈
            if (!hasErrors && !isTesting) logsContent.style.display = 'none';

            logsHeader.addEventListener('click', () => {
                logsContent.style.display = logsContent.style.display === 'none' ? 'block' : 'none';
            });

            for (const log of this.report.logs) {
                const logWrapper = logsContent.createDiv({ cls: `diag-log-wrapper diag-log-${log.level}` });
                const logLine = logWrapper.createDiv({ cls: 'diag-log-line' });
                logLine.createSpan({ text: `[${log.stage}]`, cls: 'diag-log-stage' });
                logLine.createSpan({ text: log.message, cls: 'diag-log-msg' });

                if (log.details) {
                    const detailsEl = logWrapper.createDiv({ cls: 'diag-log-details', text: log.details });
                    detailsEl.style.display = 'none';
                    logLine.style.cursor = 'pointer';
                    logLine.createSpan({ text: ' (点击查看详情)', cls: 'diag-log-expand-tip' });

                    logLine.addEventListener('click', (e) => {
                        e.stopPropagation();
                        detailsEl.style.display = detailsEl.style.display === 'none' ? 'block' : 'none';
                    });
                }
            }
            // 自动滚动到底部
            setTimeout(() => {
                logsContent.scrollTop = logsContent.scrollHeight;
            }, 50);
        }

        // ── 页脚 ──
        const footer = contentEl.createDiv({ cls: 'diag-footer' });
        const closeBtn = footer.createEl('button', {
            text: isTesting ? '测试进行中...' : '关闭',
            cls: isTesting ? '' : 'mod-cta'
        }) as HTMLButtonElement;
        closeBtn.disabled = isTesting;

        closeBtn.addEventListener('click', () => this.close());
    }

    private renderRow(parent: HTMLElement, label: string, item: DiagItem) {
        const rowWrapper = parent.createDiv({ cls: 'diag-row-item-container' });
        const row = rowWrapper.createDiv({ cls: 'diag-row' });

        // 状态指示点
        const dotCls = item.status === 'pass' ? 'diag-dot-pass' :
            item.status === 'fail' ? 'diag-dot-fail' :
                item.status === 'warn' ? 'diag-dot-warn' :
                    item.status === 'testing' ? 'diag-dot-testing' : 'diag-dot-na';
        row.createDiv({ cls: `diag-dot ${dotCls}` });

        // 标签
        row.createDiv({ text: label, cls: 'diag-row-label' });

        // 右侧信息
        const right = row.createDiv({ cls: 'diag-row-right' });

        if (item.latency !== undefined && item.status !== 'testing') {
            right.createSpan({ text: `${item.latency}ms`, cls: 'diag-latency-tag' });
        }

        let statusLabel = '';
        if (item.status === 'pass') statusLabel = t('Settings.Ai.DiagStatusPass');
        else if (item.status === 'fail') statusLabel = (item.value || t('Settings.Ai.DiagStatusFail'));
        else if (item.status === 'warn') statusLabel = t('Settings.Ai.DiagStatusWarn');
        else if (item.status === 'testing') statusLabel = '正在检测...';
        else statusLabel = '等待中';

        if (item.usage && item.status === 'pass') {
            right.createSpan({
                text: `Prompt: ${item.usage.prompt} / Completion: ${item.usage.completion}`,
                cls: 'diag-usage-tag'
            });
        }

        right.createSpan({ text: statusLabel, cls: `diag-status-label diag-sl-${item.status}` });

        // 提示信息与原始响应 (合并为一个详情区域)
        if (item.tip || item.rawResponse) {
            const detailsBox = rowWrapper.createDiv({ cls: 'diag-item-details-box' });

            if (item.tip) {
                const tipEl = detailsBox.createDiv({ cls: 'diag-row-tip-v3' });
                const tipHeader = tipEl.createDiv({ cls: 'diag-tip-v3-header' });
                setIcon(tipHeader.createSpan({ cls: 'diag-tip-v3-icon' }), item.status === 'fail' ? 'alert-circle' : 'info');
                tipHeader.createSpan({ text: item.status === 'fail' ? '专家诊断建议' : '配置优化方案', cls: 'diag-tip-v3-title' });

                const tipBody = tipEl.createDiv({ cls: 'diag-tip-v3-body' });
                item.tip.split('\n').forEach(line => tipBody.createDiv({ text: line }));
            }

            if (item.rawResponse) {
                const rawWrapper = detailsBox.createDiv({ cls: 'diag-raw-v3-wrapper' });
                const rawHeader = rawWrapper.createDiv({ cls: 'diag-raw-v3-header' });
                setIcon(rawHeader.createSpan({ cls: 'diag-raw-v3-icon' }), 'terminal');
                rawHeader.createSpan({ text: '原始数据报文 (Raw)', cls: 'diag-raw-v3-title' });

                const pre = rawWrapper.createEl('pre', { text: item.rawResponse, cls: 'diag-raw-v3-content' });

                // 添加点击复制功能
                const copyBtn = rawHeader.createDiv({ cls: 'diag-raw-v3-copy', title: '复制报文' });
                setIcon(copyBtn, 'copy');
                copyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(item.rawResponse || '');
                    setIcon(copyBtn, 'check');
                    setTimeout(() => setIcon(copyBtn, 'copy'), 2000);
                });
            }

            // 交互逻辑：使用 CSS 类控制动画
            const isFailed = item.status === 'fail';
            if (isFailed) detailsBox.classList.add('is-expanded');

            row.style.cursor = 'pointer';
            if (!isFailed) {
                const expandIcon = row.createSpan({ cls: 'diag-row-expand-icon-v3' });
                setIcon(expandIcon, 'chevron-down');
            }

            row.addEventListener('click', () => {
                detailsBox.classList.toggle('is-expanded');
                row.classList.toggle('is-active');
            });
        }
    }

    private getRecommendations(): string[] {
        const recs: string[] = [];
        const report = this.report;

        // 1. 端点连通性排查
        if (report.endpoint.status === 'fail') {
            if (report.endpoint.value.includes('响应格式冲突')) {
                recs.push('接口地址异常：检测到返回了 HTML 网页。建议检查是否误填了服务商官网（如 https://openai.com），API 地址通常需要包含 /v1 路径。');
            } else if (report.endpoint.value.includes('连接被拒绝') || report.endpoint.value.includes('连接超时')) {
                recs.push('网络链路受阻：无法建立连接。请检查：(1) 若使用本地模型请确认服务已启动；(2) 若使用远程 API 请检查插件内的“网络代理”设置是否与系统 VPN 冲突。');
            } else if (report.endpoint.value.includes('DNS')) {
                recs.push('解析异常：域名无法识别。请确认地址拼写是否正确，或尝试更换不依赖外部 DNS 的中转地址。');
            }
        }

        // 2. 鉴权与权限排查
        if (report.auth.status === 'fail') {
            if (report.auth.value.includes('401')) {
                recs.push('密钥校验失败：请确保 API Key 已正确复制（建议重新复制，避免带入首尾空格），并确认该 Key 在服务商后台处于 Active 状态。');
            } else if (report.auth.value.includes('403')) {
                recs.push('权限遭拒：密钥有效但无权访问。请检查：(1) 账号是否已绑定支付卡或额度是否充足；(2) 接口商是否有 IP 地区限制。');
            }
        }

        // 3. 模型适配排查
        if (report.model.status === 'fail') {
            recs.push(`模型配置错误：当前账号无权访问 "${report.model.value}" 或模型名拼写错误。请在设置中通过“刷新模型列表”后重新选择。`);
        }

        // 4. 翻译与格式排查
        if (report.translation.status === 'fail') {
            if (report.translation.value === '格式解析失败') {
                recs.push('响应格式冲突：模型输出了非 JSON 文字。方案：(1) 在设置中将“响应格式”切换为 Text 模式；(2) 精简 System Prompt 避免模型混淆。');
            } else if (report.translation.value.includes('400')) {
                recs.push('高级特性不支持：当前模型可能暂不支持 JSON Schema 等高级格式。建议在插件设置中将“响应模式”降级为 Text。');
            }
        }

        // 5. 体验预警排查
        if (report.overallStatus === 'warning' || report.overallStatus === 'healthy') {
            if (report.jsonMode.status === 'warn') {
                recs.push('局部功能告警：模型不支持原生 JSON_OBJECT 模式。虽然目前可用，但后续翻译可能会有概率出现解析错误。');
            }
            if (report.concurrency?.status === 'warn') {
                recs.push('频率限制预警：高压力下可能触发 429 错误。建议在“基础配置”中通过降低“请求并发数”来换取稳定性。');
            }
        }

        // 6. 修复链路排查
        if (report.translationFix?.status === 'fail') {
            recs.push('修复链路异常：单条翻译修复功能不可用。请确认模型是否支持纯文本对话，或尝试切换模型。');
        } else if (report.translationFix?.status === 'warn') {
            recs.push('修复质量预警：修复功能返回了多余信息。虽然不影响使用，但可能会增加 Token 消耗或降低修复准确度。');
        }

        return recs.length > 0 ? recs : ['各链路指标均表现优异。如果翻译体感仍有异常，建议尝试切换到更高规格的模型以获得更佳效果。'];
    }

    private addStyles() {
        const existingStyle = document.getElementById('i18n-diag-styles');
        if (existingStyle) existingStyle.remove();

        const style = document.createElement('style');
        style.id = 'i18n-diag-styles';
        style.textContent = `
            .i18n-diag-modal { padding: 0; background: var(--background-primary); font-family: var(--font-interface); }

            /* ── 总览卡片 ── */
            .i18n-diag-modal .diag-overview {
                display: flex; align-items: center; gap: 20px;
                padding: 24px; margin-bottom: 20px;
                border-radius: 12px;
                background: linear-gradient(135deg, var(--background-secondary) 0%, var(--background-secondary-alt) 100%);
                border: 1px solid var(--background-modifier-border);
                box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            }
            .i18n-diag-modal .diag-overview-icon {
                width: 56px; height: 56px; border-radius: 16px;
                display: flex; align-items: center; justify-content: center;
                flex-shrink: 0; transform: rotate(-5deg);
                box-shadow: 0 8px 16px rgba(0,0,0,0.1);
            }
            .i18n-diag-modal .diag-overview-icon.diag-healthy { background: linear-gradient(135deg, #2dc937, #22a92b); color: white; }
            .i18n-diag-modal .diag-overview-icon.diag-warning { background: linear-gradient(135deg, #dbad00, #c49a00); color: white; }
            .i18n-diag-modal .diag-overview-icon.diag-failed  { background: linear-gradient(135deg, #cc3232, #b02a2a); color: white; }
            .i18n-diag-modal .diag-overview-icon svg { width: 28px; height: 28px; }
            
            .i18n-diag-modal .diag-overview-title {
                font-size: 1.25em; font-weight: 700;
                color: var(--text-normal); margin-bottom: 6px;
                letter-spacing: -0.01em;
            }
            .i18n-diag-modal .diag-overview-badge {
                display: inline-flex; align-items: center;
                font-size: 0.75em; font-weight: 800; text-transform: uppercase;
                padding: 3px 12px; border-radius: 20px; letter-spacing: 0.05em;
            }
            .i18n-diag-modal .diag-overview-badge.diag-healthy { background: rgba(45,201,55,0.15); color: #2dc937; }
            .i18n-diag-modal .diag-overview-badge.diag-warning { background: rgba(231,180,0,0.15); color: #dbad00; }
            .i18n-diag-modal .diag-overview-badge.diag-failed  { background: rgba(204,50,50,0.15);  color: #cc3232; }

            /* ── 检测项列表 ── */
            .i18n-diag-modal .diag-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
            .i18n-diag-modal .diag-row-item-container { 
                background: var(--background-secondary); 
                border-radius: 10px; 
                overflow: hidden;
                border: 1px solid var(--background-modifier-border);
                transition: all 0.2s ease;
            }
            .i18n-diag-modal .diag-row-item-container:hover { border-color: var(--text-accent); transform: translateY(-1px); box-shadow: 0 4px 10px rgba(0,0,0,0.08); }
            
            .i18n-diag-modal .diag-row {
                display: flex; align-items: center; gap: 14px;
                padding: 12px 18px;
            }
            .i18n-diag-modal .diag-row.is-active { background: var(--background-secondary-alt); }

            .i18n-diag-modal .diag-dot {
                width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0;
            }
            .i18n-diag-modal .diag-dot-pass { background: #2dc937; box-shadow: 0 0 8px rgba(45,201,55,0.5); }
            .i18n-diag-modal .diag-dot-fail { background: #cc3232; box-shadow: 0 0 8px rgba(204,50,50,0.5); }
            .i18n-diag-modal .diag-dot-warn { background: #dbad00; box-shadow: 0 0 8px rgba(231,180,0,0.5); }

            .i18n-diag-modal .diag-row-label { 
                flex: 1; font-size: 0.95em; font-weight: 500; 
                color: var(--text-normal); 
            }
            .i18n-diag-modal .diag-row-right { display: flex; align-items: center; gap: 10px; }

            .i18n-diag-modal .diag-latency-tag, .diag-usage-tag {
                font-size: 0.72em; padding: 2px 8px; border-radius: 4px;
                background: var(--background-modifier-border); color: var(--text-muted);
                font-family: var(--font-monospace); opacity: 0.9;
            }
            .diag-usage-tag { background: rgba(var(--interactive-accent-rgb), 0.1); color: var(--interactive-accent); }
            .i18n-diag-modal .diag-status-label {
                font-size: 0.72em; font-weight: 800; font-family: var(--font-monospace);
                padding: 3px 10px; border-radius: 6px; border: 1px solid transparent;
            }
            .i18n-diag-modal .diag-sl-pass { background: rgba(45,201,55,0.08); color: #2dc937; border-color: rgba(45,201,55,0.2); }
            .i18n-diag-modal .diag-sl-fail { background: rgba(204,50,50,0.08); color: #cc3232; border-color: rgba(204,50,50,0.2); }
            .i18n-diag-modal .diag-sl-warn { background: rgba(231,180,0,0.08); color: #dbad00; border-color: rgba(231,180,0,0.2); }
            .i18n-diag-modal .diag-sl-testing { background: rgba(0,122,255,0.08); color: #007aff; border-color: rgba(0,122,255,0.2); }
            .i18n-diag-modal .diag-sl-na { background: var(--background-secondary-alt); color: var(--text-faint); }

            .i18n-diag-modal .diag-dot-testing { 
                background: #007aff; 
                box-shadow: 0 0 8px rgba(0,122,255,0.5); 
                animation: diag-pulse 1.5s infinite;
            }
            .i18n-diag-modal .diag-dot-na { background: var(--text-faint); opacity: 0.3; }

            @keyframes diag-pulse {
                0% { opacity: 0.4; transform: scale(0.8); }
                50% { opacity: 1; transform: scale(1.1); }
                100% { opacity: 0.4; transform: scale(0.8); }
            }

            @keyframes diag-spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            .i18n-diag-modal .testing-anim svg { animation: diag-spin 2s linear infinite; }

            /* 展开动画容器 */
            .i18n-diag-modal .diag-item-details-box {
                max-height: 0; opacity: 0; overflow: hidden;
                transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
                background: var(--background-primary);
                border-top: 0px solid var(--background-modifier-border);
            }
            .i18n-diag-modal .diag-item-details-box.is-expanded {
                max-height: 2000px; opacity: 1; padding: 16px;
                border-top-width: 1px;
            }

            /* ── 新版提示卡片 (Tip v3) ── */
            .i18n-diag-modal .diag-row-tip-v3 {
                border-radius: 8px; margin-bottom: 12px;
                background: var(--background-secondary-alt);
                border: 1px solid var(--background-modifier-border);
                overflow: hidden;
            }
            .i18n-diag-modal .diag-tip-v3-header {
                display: flex; align-items: center; gap: 8px;
                padding: 8px 12px; background: rgba(0,0,0,0.03);
                border-bottom: 1px solid var(--background-modifier-border);
            }
            .i18n-diag-modal .diag-tip-v3-icon { color: var(--text-accent); display: flex; }
            .i18n-diag-modal .diag-tip-v3-icon svg { width: 14px; height: 14px; }
            .i18n-diag-modal .diag-tip-v3-title { font-size: 0.75em; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
            .i18n-diag-modal .diag-tip-v3-body {
                padding: 12px; font-size: 0.9em; line-height: 1.6;
                color: var(--text-normal);
            }

            /* ── 新版报文容器 (Raw v3) ── */
            .i18n-diag-modal .diag-raw-v3-wrapper {
                border-radius: 8px; background: #121212;
                border: 1px solid #333; overflow: hidden;
            }
            .i18n-diag-modal .diag-raw-v3-header {
                display: flex; align-items: center; gap: 8px;
                padding: 6px 12px; background: #1e1e1e;
                border-bottom: 1px solid #333;
            }
            .i18n-diag-modal .diag-raw-v3-icon { color: #569cd6; display: flex; }
            .i18n-diag-modal .diag-raw-v3-icon svg { width: 14px; height: 14px; }
            .i18n-diag-modal .diag-raw-v3-title { font-size: 0.7em; font-weight: 700; color: #888; letter-spacing: 0.5px; flex: 1; }
            .i18n-diag-modal .diag-raw-v3-copy { 
                cursor: pointer; padding: 4px; border-radius: 4px;
                color: #666; transition: all 0.2s;
            }
            .i18n-diag-modal .diag-raw-v3-copy:hover { color: #fff; background: #333; }
            .i18n-diag-modal .diag-raw-v3-copy svg { width: 14px; height: 14px; }

            .i18n-diag-modal .diag-raw-v3-content {
                margin: 0; padding: 12px;
                color: #d4d4d4; font-family: var(--font-monospace);
                font-size: 0.8em; line-height: 1.5;
                max-height: 300px; overflow-y: auto;
                scrollbar-width: thin; scrollbar-color: #333 transparent;
            }
            .i18n-diag-modal .diag-raw-v3-content::-webkit-scrollbar { width: 6px; }
            .i18n-diag-modal .diag-raw-v3-content::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }

            .i18n-diag-modal .diag-row-expand-icon-v3 { 
                display: flex; color: var(--text-faint); 
                transition: transform 0.3s ease; 
            }
            .i18n-diag-modal .diag-row.is-active .diag-row-expand-icon-v3 { transform: rotate(180deg); color: var(--text-accent); }
            .i18n-diag-modal .diag-row-expand-icon-v3 svg { width: 16px; height: 16px; }
            .i18n-diag-modal .diag-row-item-container { margin-bottom: 8px; }

            /* ── 建议区 ── */
            .i18n-diag-modal .diag-recs {
                border-radius: 8px; padding: 14px;
                background: rgba(231,180,0,0.06);
                border: 1px solid rgba(231,180,0,0.15);
                margin-bottom: 16px;
            }
            .i18n-diag-modal .diag-recs-header {
                display: flex; align-items: center; gap: 8px;
                font-weight: 600; font-size: 0.9em;
                color: #dbad00; margin-bottom: 10px;
            }
            .i18n-diag-modal .diag-recs-icon svg { width: 16px; height: 16px; }
            .i18n-diag-modal .diag-rec-item {
                font-size: 0.85em; color: var(--text-normal);
                padding: 4px 0 4px 24px; position: relative; line-height: 1.5;
            }
            .i18n-diag-modal .diag-rec-item::before {
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
            .diag-log-line { display: flex; align-items: flex-start; line-height: 1.4; word-break: break-all; }
            .diag-log-info { color: var(--text-muted); }
            .diag-log-warn { color: #dbad00; }
            .diag-log-error { color: #cc3232; }
            .diag-log-stage { color: var(--text-accent); margin-right: 8px; font-weight: 600; flex-shrink: 0; }
            .diag-log-msg { white-space: pre-wrap; font-family: inherit; flex: 1; }
            .diag-log-expand-tip { font-size: 0.85em; color: var(--text-faint); margin-left: 8px; font-style: italic; }
            .diag-log-wrapper { margin-bottom: 8px; }
            .diag-log-details {
                margin: 8px 0 8px 12px; padding: 10px;
                background: var(--background-secondary-alt);
                border-left: 2px solid var(--text-accent);
                border-radius: 4px;
                font-family: var(--font-monospace);
                font-size: 0.95em;
                white-space: pre-wrap;
                word-break: break-all;
                color: var(--text-muted);
                max-height: 300px;
                overflow-y: auto;
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        this.contentEl.empty();
    }
}
