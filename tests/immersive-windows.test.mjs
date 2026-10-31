import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

class TestWindow {
    constructor(name) {
        this.name = name;
        this.closed = false;
        this.listeners = new Map();
        this.document = { defaultView: this };
    }

    addEventListener(name, callback, options) {
        const listeners = this.listeners.get(name) || [];
        listeners.push({ callback, once: options?.once });
        this.listeners.set(name, listeners);
    }

    removeEventListener(name, callback) {
        this.listeners.set(name, (this.listeners.get(name) || [])
            .filter((listener) => listener.callback !== callback));
    }

    dispatch(name) {
        for (const listener of [...(this.listeners.get(name) || [])]) {
            if (listener.once) this.removeEventListener(name, listener.callback);
            listener.callback.call(this, { type: name, target: this });
        }
    }

    listenerCount() {
        return [...this.listeners.values()].reduce((count, listeners) => count + listeners.length, 0);
    }
}

class Workspace {
    constructor() {
        this.leaves = [];
        this.events = new Map();
    }

    iterateAllLeaves(callback) {
        this.leaves.forEach(callback);
    }

    on(name, callback) {
        const ref = { name, callback };
        const refs = this.events.get(name) || [];
        refs.push(ref);
        this.events.set(name, refs);
        return ref;
    }

    offref(ref) {
        this.events.set(ref.name, (this.events.get(ref.name) || []).filter((entry) => entry !== ref));
    }

    emit(name, win) {
        for (const ref of [...(this.events.get(name) || [])]) ref.callback({ win }, win);
    }

    listenerCount() {
        return [...this.events.values()].reduce((count, refs) => count + refs.length, 0);
    }
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
    return { promise, resolve, reject };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

// 仅替换窗口、工作区事件和SDK处理器；发现、方法包装与解绑执行真实源码。
function fixture(t, { leafWindows = [], settingsWindow = null, activate, deactivate, settingPrototype = false } = {}) {
    const main = new TestWindow('main');
    const workspace = new Workspace();
    workspace.leaves = leafWindows.map((win) => {
        const containerEl = { ownerDocument: win.document };
        return { containerEl, view: { containerEl }, getRoot: () => ({ win }) };
    });
    const openCalls = [];
    const originalOpen = function (...args) {
        openCalls.push({ receiver: this, args });
        this.modalEl.isConnected = true;
        return this.returnValue;
    };
    const setting = settingPrototype ? Object.create({ open: originalOpen }) : { open: originalOpen };
    Object.assign(setting, {
        modalEl: { ownerDocument: settingsWindow?.document || main.document, isConnected: !!settingsWindow },
        popoutWindow: settingsWindow,
        getPopoutWindow() { return this.popoutWindow; },
        returnValue: { opened: true }
    });
    const app = { workspace, setting };
    const calls = { activate: [], deactivate: [], errors: [] };
    const handlers = {
        activate: (win) => {
            calls.activate.push(win);
            return activate ? activate(win) : Promise.resolve();
        },
        deactivate: (win) => {
            calls.deactivate.push(win);
            return deactivate?.(win);
        },
        onError: (error) => calls.errors.push(error)
    };
    const filename = path.join(projectRoot, 'src/utils/ui/immersive-windows.ts');
    const compiled = transformSync(fs.readFileSync(filename, 'utf8'), {
        loader: 'ts', format: 'cjs', target: 'node20'
    }).code;
    const requireSource = (id) => {
        if (id === 'obsidian') return {};
        throw new Error(`未预期的源码依赖：${id}`);
    };
    const module = { exports: {} };
    new Function('require', 'module', 'exports', 'window', 'document', compiled)(
        requireSource, module, module.exports, main, main.document
    );
    const manager = new module.exports.ImmersiveWindowManager(app, handlers);
    t.after(() => manager.stop());
    return {
        main, app, workspace, setting, manager, calls, originalOpen, openCalls,
        openSettings(win) {
            setting.popoutWindow = win;
            setting.modalEl.ownerDocument = win.document;
            return setting.open();
        }
    };
}

test('启用时发现主窗口、已有工作区窗口和已有独立设置窗口，并保持幂等', async (t) => {
    const leaf = new TestWindow('leaf');
    const settings = new TestWindow('settings');
    const f = fixture(t, { leafWindows: [leaf, leaf], settingsWindow: settings });
    await f.manager.start();
    await f.manager.start();
    assert.deepEqual(f.calls.activate, [f.main, leaf, settings]);
    assert.equal(f.calls.errors.length, 0);
});

test('独立设置窗口不触发工作区事件，打开和重开仍分别得到初始化', async (t) => {
    const f = fixture(t);
    await f.manager.start();
    const first = new TestWindow('settings-first');
    const result = f.openSettings(first);
    assert.equal(result, f.setting.returnValue);
    await settle();
    assert.deepEqual(f.calls.activate, [f.main, first]);

    f.setting.open();
    await settle();
    assert.equal(f.calls.activate.filter((win) => win === first).length, 1);
    first.closed = true;
    first.dispatch('pagehide');
    await settle();
    assert.deepEqual(f.calls.deactivate, [first]);

    const reopened = new TestWindow('settings-reopened');
    f.openSettings(reopened);
    await settle();
    assert.deepEqual(f.calls.activate, [f.main, first, reopened]);
});

test('设置弹窗优先使用实际弹出窗口，缺少getter时从设置元素所属文档发现', async (t) => {
    const f = fixture(t);
    await f.manager.start();
    const first = new TestWindow('settings-from-getter');
    f.setting.popoutWindow = first;
    // 弹出容器仍归主文档时，实际弹出窗口 getter 必须优先。
    f.setting.open();
    await settle();
    assert.deepEqual(f.calls.activate, [f.main, first]);

    delete f.setting.getPopoutWindow;
    const fallback = new TestWindow('settings-from-document');
    f.setting.modalEl.ownerDocument = fallback.document;
    f.setting.open();
    await settle();
    assert.deepEqual(f.calls.activate, [f.main, first, fallback]);
});

test('普通工作区窗口新开和关闭继续处理，关闭事件与pagehide不会重复清理', async (t) => {
    const f = fixture(t);
    await f.manager.start();
    const child = new TestWindow('workspace-popout');
    f.workspace.emit('window-open', child);
    f.workspace.emit('window-open', child);
    await settle();
    assert.deepEqual(f.calls.activate, [f.main, child]);
    f.workspace.emit('window-close', child);
    child.dispatch('pagehide');
    await settle();
    assert.deepEqual(f.calls.deactivate, [child]);
    assert.equal(child.listenerCount(), 0);
});

test('包装设置打开方法保留this、参数、返回值和原始异常', async (t) => {
    const f = fixture(t);
    const originalError = new Error('settings open failed');
    const original = function (...args) {
        assert.equal(this, receiver);
        assert.deepEqual(args, ['plugin-id', 42]);
        if (this.fail) throw originalError;
        return this.result;
    };
    f.setting.open = original;
    const receiver = { result: { unchanged: true }, fail: false };
    await f.manager.start();
    assert.equal(f.setting.open.call(receiver, 'plugin-id', 42), receiver.result);
    receiver.fail = true;
    assert.throws(() => f.setting.open.call(receiver, 'plugin-id', 42), (error) => error === originalError);
    await settle();
    assert.deepEqual(f.calls.activate, [f.main]);
    f.manager.stop();
    assert.equal(f.setting.open, original);
});

test('停止时恢复设置方法原始descriptor并解绑发现入口，不主动停用SDK', async (t) => {
    const child = new TestWindow('settings');
    const f = fixture(t, { settingsWindow: child });
    const originalDescriptor = Object.getOwnPropertyDescriptor(f.setting, 'open');
    await f.manager.start();
    assert.ok(f.workspace.listenerCount() > 0);
    f.manager.stop();
    assert.deepEqual(Object.getOwnPropertyDescriptor(f.setting, 'open'), originalDescriptor);
    assert.equal(f.workspace.listenerCount(), 0);
    assert.equal(f.main.listenerCount(), 0);
    assert.equal(child.listenerCount(), 0);
    assert.deepEqual(f.calls.deactivate, [], 'stop只解绑发现，SDK统一销毁由上层负责');

    f.openSettings(new TestWindow('after-stop'));
    f.workspace.emit('window-open', new TestWindow('after-stop-popout'));
    await settle();
    assert.deepEqual(f.calls.activate, [f.main, child]);
});

test('设置方法原本继承自prototype，停止后恢复继承关系', async (t) => {
    const f = fixture(t, { settingPrototype: true });
    assert.equal(Object.hasOwn(f.setting, 'open'), false);
    await f.manager.start();
    assert.equal(Object.hasOwn(f.setting, 'open'), true);
    f.manager.stop();
    assert.equal(Object.hasOwn(f.setting, 'open'), false);
    assert.equal(f.setting.open, f.originalOpen);
});

test('停止保留其他插件后来添加的wrapper，旧wrapper不再发现窗口', async (t) => {
    const f = fixture(t);
    await f.manager.start();
    const managerWrapper = f.setting.open;
    const laterWrapper = function (...args) { return managerWrapper.apply(this, args); };
    f.setting.open = laterWrapper;
    f.manager.stop();
    assert.equal(f.setting.open, laterWrapper);
    f.openSettings(new TestWindow('later-settings'));
    await settle();
    assert.deepEqual(f.calls.activate, [f.main]);
});

test('事件中的异步初始化和清理失败交给onError，不产生未处理拒绝', async (t) => {
    const startError = new Error('load failed');
    const cleanupError = new Error('cleanup failed');
    const f = fixture(t, {
        activate: (win) => win.name === 'bad-popout' ? Promise.reject(startError) : Promise.resolve(),
        deactivate: () => Promise.reject(cleanupError)
    });
    await f.manager.start();
    const bad = new TestWindow('bad-popout');
    f.workspace.emit('window-open', bad);
    await settle();
    assert.deepEqual(f.calls.errors, [startError]);
    const good = new TestWindow('good-popout');
    f.workspace.emit('window-open', good);
    await settle();
    good.closed = true;
    good.dispatch('pagehide');
    await settle();
    assert.deepEqual(f.calls.errors, [startError, cleanupError]);
});

test('窗口初始化未完成便关闭，及时清理且迟到完成不会重新挂监听', async (t) => {
    const loading = deferred();
    const f = fixture(t, {
        activate: (win) => win.name === 'loading-popout' ? loading.promise : Promise.resolve()
    });
    await f.manager.start();
    const child = new TestWindow('loading-popout');
    f.workspace.emit('window-open', child);
    await settle();
    assert.ok(child.listenerCount() > 0);
    child.closed = true;
    child.dispatch('pagehide');
    await settle();
    assert.deepEqual(f.calls.deactivate, [child]);
    assert.equal(child.listenerCount(), 0);
    loading.resolve();
    await settle();
    assert.equal(child.listenerCount(), 0);
    assert.deepEqual(f.calls.deactivate, [child]);
});

test('停止后重新启动不会令第三方持有的旧设置wrapper复活', async (t) => {
    const f = fixture(t);
    await f.manager.start();
    const previousWrapper = f.setting.open;
    const retainedOpen = function (...args) { return previousWrapper.apply(this, args); };
    f.manager.stop();
    await f.manager.start();
    const staleWindow = new TestWindow('old-wrapper-window');
    const receiver = {
        ...f.setting,
        popoutWindow: staleWindow,
        modalEl: { ownerDocument: staleWindow.document, isConnected: false }
    };
    assert.equal(retainedOpen.call(receiver), receiver.returnValue);
    await settle();
    assert.deepEqual(f.calls.activate, [f.main, f.main]);
    assert.equal(staleWindow.listenerCount(), 0);

    const currentWindow = new TestWindow('current-wrapper-window');
    f.openSettings(currentWindow);
    await settle();
    assert.deepEqual(f.calls.activate, [f.main, f.main, currentWindow]);
});

test('枚举已有窗口同步失败时解绑发现入口，恢复后可以重新启动', async (t) => {
    const f = fixture(t);
    const originalDescriptor = Object.getOwnPropertyDescriptor(f.setting, 'open');
    const originalIterate = f.workspace.iterateAllLeaves;
    const error = new Error('workspace leaves unavailable');
    f.workspace.iterateAllLeaves = () => { throw error; };
    await f.manager.start();
    assert.deepEqual(f.calls.errors, [error]);
    assert.deepEqual(f.calls.activate, []);
    assert.equal(f.workspace.listenerCount(), 0);
    assert.deepEqual(Object.getOwnPropertyDescriptor(f.setting, 'open'), originalDescriptor);

    f.workspace.iterateAllLeaves = originalIterate;
    await f.manager.start();
    const settings = new TestWindow('settings-after-retry');
    f.openSettings(settings);
    await settle();
    assert.deepEqual(f.calls.activate, [f.main, settings]);
    assert.deepEqual(f.calls.errors, [error]);
});
