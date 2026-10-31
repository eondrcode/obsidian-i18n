import { App } from 'obsidian';

interface ImmersiveWindowHandlers {
    activate: (win: Window) => Promise<void>;
    deactivate: (win: Window) => void | Promise<void>;
    onError: (error: unknown) => void;
}

interface SettingsWindowController {
    open: (...args: unknown[]) => unknown;
    modalEl?: HTMLElement;
    getPopoutWindow?: () => Window | null;
}

interface WindowRegistration {
    ready: Promise<void>;
    removeListener: () => void;
}

/** 管理工作区弹出窗口和独立设置窗口中的沉浸式翻译。 */
export class ImmersiveWindowManager {
    private active = false;
    private starting: Promise<void> | null = null;
    private windows = new Map<Window, WindowRegistration>();
    private cleanups: Array<() => void> = [];

    constructor(private app: App, private handlers: ImmersiveWindowHandlers) {
    }

    public start(): Promise<void> {
        if (this.active) return this.starting || Promise.resolve();
        this.active = true;

        const workspace = this.app.workspace;
        const openRef = workspace.on('window-open', (_workspaceWindow, win) => {
            void this.attachWindow(win);
        });
        const closeRef = workspace.on('window-close', (_workspaceWindow, win) => {
            this.detachWindow(win);
        });
        this.cleanups.push(() => workspace.offref(openRef), () => workspace.offref(closeRef));

        try {
            this.watchSettingsWindow();
        } catch (error) {
            this.reportError(error);
        }

        const windows = new Set<Window>([window]);
        try {
            workspace.iterateAllLeaves((leaf) => {
                const win = leaf.view.containerEl.ownerDocument.defaultView;
                if (win) windows.add(win);
            });
        } catch (error) {
            this.stop();
            this.reportError(error);
            return Promise.resolve();
        }
        const settings = this.getSettings();
        if (settings) {
            try {
                const win = this.getSettingsWindow(settings);
                if (win) windows.add(win);
            } catch (error) {
                this.reportError(error);
            }
        }

        this.starting = Promise.all([...windows].map((win) => this.attachWindow(win))).then(() => undefined);
        return this.starting;
    }

    /** 停止发现窗口；SDK 的整体停用由调用方统一处理。 */
    public stop(): void {
        this.active = false;
        this.starting = null;
        for (const cleanup of this.cleanups.splice(0).reverse()) cleanup();
        for (const registration of this.windows.values()) registration.removeListener();
        this.windows.clear();
    }

    private getSettings(): SettingsWindowController | undefined {
        return (this.app as App & { setting?: SettingsWindowController }).setting;
    }

    private getSettingsWindow(settings: SettingsWindowController): Window | null {
        const popout = settings.getPopoutWindow?.();
        if (popout && !popout.closed) return popout;
        return settings.modalEl?.isConnected ? settings.modalEl.ownerDocument.defaultView : null;
    }

    private watchSettingsWindow(): void {
        const settings = this.getSettings();
        if (!settings || typeof settings.open !== 'function') return;

        // 独立设置窗不触发 workspace 的窗口事件，需跟随设置自身的打开入口。
        const original = settings.open;
        const descriptor = Object.getOwnPropertyDescriptor(settings, 'open');
        let enabled = true;
        const afterOpen = (controller: SettingsWindowController) => {
            if (!enabled || !this.active) return;
            try {
                const win = this.getSettingsWindow(controller);
                if (win) void this.attachWindow(win);
            } catch (error) {
                this.reportError(error);
            }
        };
        const open = function (this: SettingsWindowController, ...args: unknown[]) {
            const result = original.apply(this, args);
            afterOpen(this);
            return result;
        };
        settings.open = open;
        this.cleanups.push(() => {
            enabled = false;
            if (settings.open !== open) return;
            if (descriptor) Object.defineProperty(settings, 'open', descriptor);
            else Reflect.deleteProperty(settings, 'open');
        });
    }

    private attachWindow(win: Window): Promise<void> {
        if (!this.active || win.closed) return Promise.resolve();
        const existing = this.windows.get(win);
        if (existing) return existing.ready;

        const onPageHide = () => this.detachWindow(win);
        win.addEventListener('pagehide', onPageHide);
        const registration: WindowRegistration = {
            ready: Promise.resolve(),
            removeListener: () => win.removeEventListener('pagehide', onPageHide)
        };
        this.windows.set(win, registration);
        registration.ready = Promise.resolve().then(() => {
            if (!this.active || win.closed || this.windows.get(win) !== registration) return;
            return this.handlers.activate(win);
        }).catch((error) => {
            if (this.windows.get(win) !== registration) return;
            this.windows.delete(win);
            registration.removeListener();
            this.reportError(error);
        });
        return registration.ready;
    }

    private detachWindow(win: Window): void {
        const registration = this.windows.get(win);
        if (!registration) return;
        this.windows.delete(win);
        registration.removeListener();
        try {
            void Promise.resolve(this.handlers.deactivate(win)).catch((error) => this.reportError(error));
        } catch (error) {
            this.reportError(error);
        }
    }

    private reportError(error: unknown): void {
        try {
            this.handlers.onError(error);
        } catch (callbackError) {
            console.error('沉浸式翻译错误回调失败', callbackError);
        }
    }
}
