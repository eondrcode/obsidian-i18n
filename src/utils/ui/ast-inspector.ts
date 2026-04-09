import { Notice } from 'obsidian';
import I18N from '../../main';
import { findAstItemsByText } from '../common/debug-utils';

/**
 * AST Inspector Utility
 * 允许用户点击 UI 元素，检索其对应的 AST 信息
 */
export class AstInspector {
    private i18n: I18N;
    private active = false;
    private onDeactivate?: () => void;

    constructor(i18n: I18N, onDeactivate?: () => void) {
        this.i18n = i18n;
        this.onDeactivate = onDeactivate;
    }

    public isActive() {
        return this.active;
    }

    public activate() {
        if (this.active) return;
        this.active = true;

        document.body.style.cursor = 'help';

        const style = document.createElement('style');
        style.id = 'i18n-ast-inspector-style';
        style.innerHTML = `
            .i18n-inspect-target {
                outline: 2px solid #9c27b0 !important;
                outline-offset: -2px !important;
                background-color: rgba(156, 39, 176, 0.2) !important;
                transition: outline 0.1s ease !important;
                cursor: help !important;
            }
            * {
                 pointer-events: auto !important;
            }
        `;
        document.head.appendChild(style);

        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            document.querySelectorAll('.i18n-inspect-target').forEach(el => el.classList.remove('i18n-inspect-target'));
            target.classList.add('i18n-inspect-target');
        };

        const handleClick = async (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const target = e.target as HTMLElement;
            const text = (target.innerText || target.textContent || "").trim();
            
            if (text) {
                console.log(`[i18n Debug] Inspecting text: "${text}"`);
                const matches = await findAstItemsByText(text, this.i18n);
                
                if (matches.length > 0) {
                    new Notice(`找到 ${matches.length} 个 AST 匹配项，详情请查看控制台`, 5000);
                    console.table(matches);
                    
                    // 构建详细通知 (只显示前 2 个以免过长)
                    matches.slice(0, 2).forEach(m => {
                        new Notice(`[${m.pluginId}] ${m.type}:${m.name}\nSource: ${m.source}`, 8000);
                    });
                } else {
                    new Notice('未能在已应用的翻译字典中找到匹配项', 3000);
                }
            } else {
                new Notice('选中的元素没有可拾取的文本', 2000);
            }
            
            // 默认拾取一次后不自动停用，用户手动点击按钮停用
            // 如果希望拾取一次即停止，可在此调用 this.deactivate();
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.deactivate();
            }
        };

        // 事件监听
        window.addEventListener('mouseover', handleMouseOver, true);
        window.addEventListener('click', handleClick, true);
        window.addEventListener('keydown', handleKeyDown, true);

        // 存储句柄用于卸载
        (this as any)._handlers = { handleMouseOver, handleClick, handleKeyDown };
    }

    public deactivate() {
        if (!this.active) return;
        this.active = false;

        document.body.style.cursor = '';
        document.getElementById('i18n-ast-inspector-style')?.remove();
        document.querySelectorAll('.i18n-inspect-target').forEach(el => el.classList.remove('i18n-inspect-target'));

        const { handleMouseOver, handleClick, handleKeyDown } = (this as any)._handlers;
        window.removeEventListener('mouseover', handleMouseOver, true);
        window.removeEventListener('click', handleClick, true);
        window.removeEventListener('keydown', handleKeyDown, true);
        
        if (this.onDeactivate) this.onDeactivate();
    }
}
