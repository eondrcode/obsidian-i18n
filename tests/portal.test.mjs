import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRequire = createRequire(import.meta.url);

function createSourceLoader() {
    const cache = new Map();
    return function loadSource(relativePath) {
        const filename = path.resolve(projectRoot, relativePath);
        if (cache.has(filename)) return cache.get(filename);

        const compiled = transformSync(fs.readFileSync(filename, 'utf8'), {
            loader: filename.endsWith('.tsx') ? 'tsx' : 'ts',
            format: 'cjs', target: 'node20', jsx: 'automatic'
        }).code;
        const requireFromSource = createRequire(filename);
        const module = { exports: {} };
        const requireSource = (id) => {
            if (id.startsWith('@/src/shadcn/lib/')) {
                return loadSource(`${id.slice(2)}.ts`);
            }
            return requireFromSource(id);
        };
        new Function('require', 'module', 'exports', compiled)(requireSource, module, module.exports);
        cache.set(filename, module.exports);
        return module.exports;
    };
}

function fixture(t) {
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const body = {
        children: [],
        appendChild(element) {
            element.remove();
            this.children.push(element);
            element.parentElement = this;
            return element;
        }
    };
    // 仅替换容器所需的 DOM 操作，组件、JSX 和 Radix 使用实际模块。
    const document = {
        body,
        createElement(tagName) {
            return {
                nodeType: 1,
                tagName: tagName.toUpperCase(),
                parentElement: null,
                remove() {
                    if (!this.parentElement) return;
                    const siblings = this.parentElement.children;
                    siblings.splice(siblings.indexOf(this), 1);
                    this.parentElement = null;
                }
            };
        },
        getElementById(id) {
            return body.children.find((element) => element.id === id) ?? null;
        }
    };
    Object.defineProperty(globalThis, 'document', {
        value: document, configurable: true, writable: true
    });
    t.after(() => {
        if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
        else delete globalThis.document;
    });

    const loadSource = createSourceLoader();
    const helper = loadSource('src/shadcn/lib/portal.ts');
    return { document, loadSource, helper };
}

test('共享弹层容器创建后挂到 body，移除及重载不缓存旧节点', (t) => {
    const { document, helper } = fixture(t);
    assert.equal(helper.getI18nPortalContainer(), null);

    const first = helper.createI18nPortalContainer();
    assert.equal(first.tagName, 'DIV');
    assert.equal(first.className, 'i18n-ui');
    assert.equal(first.parentElement, document.body);
    assert.deepEqual(document.body.children, [first]);
    assert.equal(helper.getI18nPortalContainer(), first);

    first.remove();
    assert.equal(helper.getI18nPortalContainer(), null);
    assert.equal(document.body.children.length, 0);

    const reloaded = helper.createI18nPortalContainer();
    assert.notEqual(reloaded, first);
    assert.equal(helper.getI18nPortalContainer(), reloaded);
    assert.deepEqual(document.body.children, [reloaded]);
    reloaded.remove();
    assert.equal(helper.getI18nPortalContainer(), null);
});

for (const [file, component] of [
    ['select', 'SelectContent'],
    ['tooltip', 'TooltipContent'],
    ['hover-card', 'HoverCardContent'],
    ['dropdown-menu', 'DropdownMenuContent'],
    ['dialog', 'DialogContent']
]) {
    test(`${component} 使用共享容器并保留 Radix 直接子组件`, (t) => {
        const { loadSource, helper } = fixture(t);
        const container = helper.createI18nPortalContainer();
        const primitives = sourceRequire(`@radix-ui/react-${file}`);
        const components = loadSource(`src/shadcn/ui/${file}.tsx`);

        let portal = components[component]({ children: 'content' });
        if (portal.type !== primitives.Portal) portal = portal.type(portal.props);
        assert.equal(portal.type, primitives.Portal);
        assert.equal(portal.props.container, container);

        if (file === 'dialog') {
            const [overlay, content] = portal.props.children;
            assert.equal(overlay.type(overlay.props).type, primitives.Overlay);
            assert.equal(content.type, primitives.Content);
        } else {
            assert.equal(portal.props.children.type, primitives.Content);
        }
    });
}

for (const [file, component] of [
    ['dialog', 'DialogPortal'],
    ['dropdown-menu', 'DropdownMenuPortal']
]) {
    test(`${component} 保留显式元素及 null 容器`, (t) => {
        const { document, loadSource, helper } = fixture(t);
        const sharedContainer = helper.createI18nPortalContainer();
        const explicitContainer = document.createElement('div');
        const { createElement } = sourceRequire('react');
        const child = createElement('span', null, 'content');
        const components = loadSource(`src/shadcn/ui/${file}.tsx`);
        const primitives = sourceRequire(`@radix-ui/react-${file}`);

        assert.equal(components[component]({}).props.container, sharedContainer);
        for (const container of [explicitContainer, null]) {
            const portal = components[component]({ container, forceMount: true, children: child });
            assert.equal(portal.type, primitives.Portal);
            assert.equal(portal.props.container, container);
            assert.equal(portal.props.children, child);
            assert.equal(portal.props.forceMount, true);
        }
    });
}
