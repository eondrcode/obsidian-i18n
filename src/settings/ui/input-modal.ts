import { Modal, App, Setting } from "obsidian";
import { t } from "src/locales";

export class InputModal extends Modal {
    private result: string;
    private onSubmit: (result: string) => void;
    private title: string;
    private placeholder: string;
    private initialValue: string;

    constructor(app: App, title: string, placeholder: string, initialValue: string, onSubmit: (result: string) => void) {
        super(app);
        this.title = title;
        this.placeholder = placeholder;
        this.initialValue = initialValue;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        this.titleEl.setText(this.title);

        new Setting(contentEl)
            .setName("")
            .setDesc("")
            .addText(text => {
                text.setPlaceholder(this.placeholder)
                    .setValue(this.initialValue)
                    .onChange(value => {
                        this.result = value;
                    });

                // 聚焦并选中文本
                text.inputEl.focus();
                if (this.initialValue) {
                    text.inputEl.select();
                }

                // 支持回车提交
                text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
                    if (e.key === 'Enter') {
                        this.submit();
                    }
                });
            });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText(t('Common.Actions.Confirm') || 'Confirm')
                .setCta()
                .onClick(() => {
                    this.submit();
                }))
            .addButton(btn => btn
                .setButtonText(t('Common.Actions.Cancel') || 'Cancel')
                .onClick(() => {
                    this.close();
                }));
    }

    private submit() {
        this.onSubmit(this.result === undefined ? this.initialValue : this.result);
        this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
