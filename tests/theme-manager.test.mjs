import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';
import { transformSync } from 'esbuild';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsx = (type, props) => ({ type, props });
const ui = Object.fromEntries([
    'Search', 'List', 'LayoutGrid', 'Input', 'Button', 'Select', 'SelectTrigger',
    'SelectValue', 'SelectContent', 'SelectItem', 'ScrollArea'
].map((name) => [name, name]));

function loadSource(relativePath, react) {
    const filename = path.resolve(projectRoot, relativePath);
    const compiled = transformSync(fs.readFileSync(filename, 'utf8'), {
        loader: filename.endsWith('.tsx') ? 'tsx' : 'ts',
        format: 'cjs', target: 'node20', jsx: 'automatic'
    }).code;
    const sourceRequire = createRequire(filename);
    const module = { exports: {} };
    const requireSource = (id) => {
        if (id === 'react') return react;
        if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
        if (id === 'react-i18next') return { useTranslation: () => ({ t: (key) => key }) };
        if (id === '~/shadcn' || id === 'lucide-react') return ui;
        if (id === '~/shadcn/lib/utils') return { cn: (...values) => values.filter(Boolean).join(' ') };
        if (id === '~/utils') return { useGlobalStoreInstance: (select) => select({ sourceUpdateTick: 0 }) };
        if (id === './components/theme-item') return { ThemeItem: 'ThemeItem' };
        if (id === '@tanstack/react-virtual') return {
            useVirtualizer: ({ count }) => ({
                getVirtualItems: () => Array.from({ length: count }, (_, index) => ({
                    index, key: index, size: 48, start: index * 48
                })),
                getTotalSize: () => count * 48
            })
        };
        if (id === '../../manager/io-manager') return loadSource('src/manager/io-manager.ts', react);
        return sourceRequire(id);
    };
    new Function('require', 'module', 'exports', compiled)(requireSource, module, module.exports);
    return module.exports;
}

function findThemeItems(node) {
    if (Array.isArray(node)) return node.flatMap(findThemeItems);
    if (!node || typeof node !== 'object') return [];
    if (node.type === 'ThemeItem') return [node.props];
    return findThemeItems(node.props?.children);
}

// 执行首次挂载的 effect 后重渲染；仅替换 hooks、界面和虚拟列表，目录读取使用真实源码与文件系统。
function renderThemes(i18n) {
    const states = [];
    const effects = [];
    let stateIndex = 0;
    const react = {
        useState: (initial) => {
            const index = stateIndex++;
            if (!(index in states)) states[index] = initial;
            return [states[index], (value) => {
                states[index] = typeof value === 'function' ? value(states[index]) : value;
            }];
        },
        useEffect: (effect) => effects.push(effect),
        useMemo: (calculate) => calculate(),
        useCallback: (callback) => callback,
        useRef: (current) => ({ current })
    };
    const { ThemeManager } = loadSource('src/views/manager/theme-manager.tsx', react);
    ThemeManager({ i18n });
    for (const effect of effects) effect();
    stateIndex = 0;
    return findThemeItems(ThemeManager({ i18n }));
}

function fixture(t, configDir = '.obsidian', activeTheme = 'active') {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-theme-manager-'));
    t.after(() => fs.removeSync(root));
    const i18n = {
        settings: {},
        app: {
            vault: { configDir, adapter: { getBasePath: () => root } },
            customCss: { theme: activeTheme }
        },
        stateManager: { getThemeState: () => undefined }
    };
    return {
        addTheme: (directory, name, manifest = null) => {
            const dir = path.join(root, directory, 'themes', name);
            fs.ensureDirSync(dir);
            if (manifest) fs.writeJsonSync(path.join(dir, 'manifest.json'), manifest);
            return { name, manifest, dir, isActive: name === activeTheme };
        },
        themes: () => renderThemes(i18n)
    };
}

function assertThemes(items, expected) {
    assert.deepEqual(items.map(({ theme }) => theme), expected);
    assert.deepEqual(items.map(({ data }) => [data.themeDir, data.themeCssPath]), (
        expected.map(({ dir }) => [dir, path.join(dir, 'theme.css')])
    ));
}

test('默认配置目录读取主题并保留清单、路径和启用状态', (t) => {
    const f = fixture(t);
    const active = f.addTheme('.obsidian', 'active', { name: '默认主题', version: '1.0.0' });
    const inactive = f.addTheme('.obsidian', 'inactive');

    assertThemes(f.themes(), [active, inactive]);
});

test('自定义配置目录读取主题并保留清单、路径和启用状态', (t) => {
    const f = fixture(t, '.custom-config');
    const active = f.addTheme('.custom-config', 'active', { name: '自定义主题', version: '2.0.0' });

    assertThemes(f.themes(), [active]);
});

test('默认与自定义目录并存时只显示配置目录的主题和清单', (t) => {
    const f = fixture(t, '.custom-config', 'shared');
    f.addTheme('.obsidian', 'default-only');
    f.addTheme('.obsidian', 'shared', { name: '旧主题', version: '1.0.0' });
    const custom = f.addTheme('.custom-config', 'custom-only');
    const shared = f.addTheme('.custom-config', 'shared', { name: '当前主题', version: '3.0.0' });

    assertThemes(f.themes(), [custom, shared]);
});

test('配置目录不存在时返回空列表而不回退到默认目录', (t) => {
    const f = fixture(t, '.custom-config');
    f.addTheme('.obsidian', 'active', { name: '默认主题', version: '1.0.0' });

    assertThemes(f.themes(), []);
});
