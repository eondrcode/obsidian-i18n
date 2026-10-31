import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const compiled = transformSync(fs.readFileSync(
    path.join(projectRoot, 'src/settings/ui/i18n-mode-imt.ts'), 'utf8'
), { loader: 'ts', format: 'cjs', target: 'node20' }).code;

function fixture() {
    let callback;
    let finish;
    const pending = new Promise((resolve) => { finish = resolve; });
    const disabled = [];
    const container = { isConnected: true };
    const tab = { contentEl: container, imtDisplay() { this.refreshes++; }, refreshes: 0 };
    const i18n = {
        activeSettingTab: 'immersive',
        settings: { modeImt: false },
        coreManager: {
            activateIMT: () => pending,
            deactivateIMT: () => pending,
            reportImmersiveError: (error) => { throw error; }
        }
    };
    let settingCount = 0;
    const stopRendering = new Error('仅构建待测开关');
    class Setting {
        constructor() { if (++settingCount > 1) throw stopRendering; }
        setName() { return this; }
        setDesc() { return this; }
        addToggle(create) {
            create({
                setValue() { return this; },
                setDisabled(value) { disabled.push(value); },
                onChange(handler) { callback = handler; return this; }
            });
        }
    }
    class BaseSetting {
        constructor() {
            this.settingTab = tab;
            this.containerEl = container;
            this.i18n = i18n;
            this.settings = i18n.settings;
        }
    }
    const requireSource = (id) => {
        if (id === 'obsidian') return { Setting };
        if (id === '../base-setting') return { default: BaseSetting, __esModule: true };
        if (id === 'src/locales') return { t: (key) => key };
        throw new Error(`未预期的依赖：${id}`);
    };
    const module = { exports: {} };
    new Function('require', 'module', 'exports', compiled)(requireSource, module, module.exports);
    assert.throws(() => new module.exports.default().main(), (error) => error === stopRendering);
    return { change: (value) => callback(value), finish, disabled, tab, i18n, container };
}

test('初始化完成后仍在当前沉浸式设置页才刷新', async () => {
    const f = fixture();
    const changing = f.change(true);
    assert.deepEqual(f.disabled, [true]);
    assert.equal(f.tab.refreshes, 0);
    f.finish();
    await changing;
    assert.deepEqual(f.disabled, [true, false]);
    assert.equal(f.tab.refreshes, 1);
});

for (const [name, leave] of [
    ['切换到其他设置页', (f) => { f.i18n.activeSettingTab = 'ai'; }],
    ['关闭窗口', (f) => { f.container.isConnected = false; }],
    ['重新打开设置页', (f) => { f.tab.contentEl = { isConnected: true }; }]
]) {
    test(`初始化期间${name}，迟到结果不覆盖新界面`, async () => {
        const f = fixture();
        const changing = f.change(true);
        leave(f);
        f.finish();
        await changing;
        assert.equal(f.tab.refreshes, 0);
        assert.deepEqual(f.disabled, [true, false]);
    });
}
