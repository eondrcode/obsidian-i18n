import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const compiled = transformSync(fs.readFileSync(
    path.join(projectRoot, 'src/utils/core/react.tsx'), 'utf8'
), { loader: 'tsx', format: 'cjs', target: 'node20', jsx: 'automatic' }).code;

class Element {
    constructor(tagName) {
        this.tagName = tagName;
        this.id = '';
        this.children = [];
        this.shadowRoot = null;
        const classes = new Set();
        this.classList = {
            add: (...names) => names.forEach((name) => classes.add(name)),
            remove: (...names) => names.forEach((name) => classes.delete(name)),
            contains: (name) => classes.has(name),
            toggle: (name, force = !classes.has(name)) => {
                if (force) classes.add(name);
                else classes.delete(name);
                return force;
            }
        };
        Object.defineProperty(this, 'className', {
            set: (value) => {
                classes.clear();
                for (const name of value.split(/\s+/).filter(Boolean)) classes.add(name);
            },
            get: () => [...classes].join(' ')
        });
    }

    appendChild(child) {
        this.children.push(child);
        child.parentElement = this;
        return child;
    }

    querySelector(selector) {
        assert.ok(selector.startsWith('#'), `替身不支持选择器 ${selector}`);
        return this.children.find((child) => child.id === selector.slice(1)) || null;
    }

    attachShadow({ mode }) {
        assert.equal(mode, 'open');
        assert.equal(this.shadowRoot, null, '重复挂载应复用 ShadowRoot');
        this.shadowRoot = new Element('#shadow-root');
        return this.shadowRoot;
    }
}

// 只替换 DOM、React root 和 observer，主题同步与重复挂载均执行真实源码。
function fixture(initialDark = false) {
    const document = { body: new Element('body'), createElement: (tag) => new Element(tag) };
    document.body.classList.toggle('theme-dark', initialDark);
    const observers = [];
    class MutationObserver {
        constructor(callback) {
            this.callback = callback;
            this.disconnects = 0;
            this.deliveries = 0;
            observers.push(this);
        }
        observe(target, options) {
            this.target = target;
            this.options = options;
            this.active = true;
        }
        disconnect() {
            this.active = false;
            this.disconnects++;
        }
    }
    const roots = [];
    const createRoot = (element) => {
        const root = {
            element, renders: [], unmounts: 0,
            render(component) { this.renders.push(component); },
            unmount() { this.unmounts++; }
        };
        roots.push(root);
        return root;
    };
    const jsx = (type, props) => ({ type, props });
    const requireSource = (id) => {
        if (id === 'react') return { StrictMode: 'StrictMode' };
        if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
        if (id === 'react-dom/client') return { createRoot };
        if (id === 'lucide-react') return { Loader2: 'Loader2' };
        if (id === 'obsidian') return {};
        throw new Error(`未预期的源码依赖：${id}`);
    };
    const module = { exports: {} };
    new Function('require', 'module', 'exports', 'document', 'MutationObserver', compiled)(
        requireSource, module, module.exports, document, MutationObserver
    );
    const host = new Element('div');
    host.classList.add('view-content', 'custom-view');
    const i18n = { sharedStyleSheet: {} };
    return {
        host, document, observers, roots,
        mount: () => module.exports.mountReactView(host, i18n, { type: 'TestView' }),
        setDark(dark) {
            document.body.classList.toggle('theme-dark', dark);
            for (const observer of observers) {
                if (!observer.active || observer.target !== document.body ||
                    !observer.options.attributes || !observer.options.attributeFilter.includes('class')) continue;
                observer.deliveries++;
                observer.callback([{ type: 'attributes', attributeName: 'class', target: document.body }]);
            }
        }
    };
}

function assertTheme(fixture, view, dark) {
    assert.equal(fixture.host.classList.contains('i18n-ui-dark'), dark, '宿主主题标记');
    assert.equal(view.mountPoint.classList.contains('dark'), dark, '内部挂载点主题标记');
    assert.ok(fixture.host.classList.contains('custom-view'), '保留宿主已有类名');
}

for (const dark of [false, true]) {
    test(`首次挂载同步${dark ? '暗色' : '亮色'}主题到宿主和挂载点`, () => {
        const f = fixture(dark);
        assertTheme(f, f.mount(), dark);
        assert.equal(f.observers.length, 1);
        assert.equal(f.observers[0].target, f.document.body);
        assert.deepEqual(f.observers[0].options, { attributes: true, attributeFilter: ['class'] });
    });
}

test('body 主题切换同时更新宿主和 Shadow DOM 挂载点', () => {
    const f = fixture();
    const view = f.mount();
    f.setDark(true);
    assertTheme(f, view, true);
    f.setDark(false);
    assertTheme(f, view, false);
    assert.equal(f.observers[0].deliveries, 2);
});

test('重复挂载复用节点并断开旧主题 observer', () => {
    const f = fixture(true);
    const first = f.mount();
    const second = f.mount();
    assert.equal(second.shadowRoot, first.shadowRoot);
    assert.equal(second.mountPoint, first.mountPoint);
    assert.equal(first.root.unmounts, 1);
    assert.equal(second.root.renders.length, 1);
    assert.equal(f.observers[0].disconnects, 1);
    assert.equal(f.observers.filter((observer) => observer.active).length, 1);
    f.setDark(false);
    assertTheme(f, second, false);
    assert.equal(f.observers[0].deliveries, 0, '旧 observer 不再收到主题变动');
    assert.equal(f.observers[1].deliveries, 1);
});
