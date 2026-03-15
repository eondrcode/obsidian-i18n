/**
 * StringPicker Utility v2
 * Provides a global picking mode with element highlighting and crosshair.
 */

export class StringPicker {
    private onPick: (text: string) => void;
    private onCancel: () => void;
    private active = false;

    constructor(onPick: (text: string) => void, onCancel: () => void) {
        this.onPick = onPick;
        this.onCancel = onCancel;
    }

    public activate() {
        if (this.active) return;
        this.active = true;

        document.body.style.cursor = 'crosshair';

        const style = document.createElement('style');
        style.id = 'i18n-picker-style';
        style.innerHTML = `
            .i18n-pick-target {
                outline: 2px dashed #0064ff !important;
                outline-offset: -2px !important;
                background-color: rgba(0, 100, 255, 0.1) !important;
                transition: all 0.1s ease !important;
            }
            * {
                 pointer-events: auto !important;
            }
        `;
        document.head.appendChild(style);

        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Remove previous
            document.querySelectorAll('.i18n-pick-target').forEach(el => el.classList.remove('i18n-pick-target'));
            target.classList.add('i18n-pick-target');
        };

        const handleClick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const target = e.target as HTMLElement;
            const text = target.innerText || target.textContent || "";
            
            if (text.trim()) {
                this.onPick(text.trim());
            } else {
                this.onCancel();
            }
            this.deactivate();
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.onCancel();
                this.deactivate();
            }
        };

        // Standard event listeners on body/window
        window.addEventListener('mouseover', handleMouseOver, true);
        window.addEventListener('click', handleClick, true);
        window.addEventListener('keydown', handleKeyDown, true);

        // Store listeners for removal
        (this as any)._handlers = { handleMouseOver, handleClick, handleKeyDown };
    }

    public deactivate() {
        if (!this.active) return;
        this.active = false;

        document.body.style.cursor = '';
        document.getElementById('i18n-picker-style')?.remove();
        document.querySelectorAll('.i18n-pick-target').forEach(el => el.classList.remove('i18n-pick-target'));

        const { handleMouseOver, handleClick, handleKeyDown } = (this as any)._handlers;
        window.removeEventListener('mouseover', handleMouseOver, true);
        window.removeEventListener('click', handleClick, true);
        window.removeEventListener('keydown', handleKeyDown, true);
    }
}
