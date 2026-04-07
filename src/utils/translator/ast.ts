import fs from 'fs';
import { parse } from "@babel/parser";
import traverse from '@babel/traverse';
import { generate } from "@babel/generator";
import * as t from '@babel/types';
import { PluginTranslationV1Ast } from '~/types';
import { I18nSettings } from '../../settings/data';
import { AST_DEFAULT_CONFIG, AST_DEFAULT_RULES } from './config';

export class AstTranslator {
    private config: any;
    private contentRules: any;

    constructor(settings?: I18nSettings) {
        this.config = {
            assignments: settings?.astAssignments || AST_DEFAULT_CONFIG.assignments,
            functions: settings?.astFunctions || AST_DEFAULT_CONFIG.functions,
            keys: settings?.astKeys || AST_DEFAULT_CONFIG.keys,
        };

        this.contentRules = {
            REJECT_PATTERNS: (settings?.astRejectRe || []).length > 0
                ? settings!.astRejectRe.map((re: string) => new RegExp(re))
                : AST_DEFAULT_RULES.REJECT_PATTERNS,
            VALID_PATTERNS: (settings?.astValidRe || []).length > 0
                ? settings!.astValidRe.map((re: string) => new RegExp(re))
                : AST_DEFAULT_RULES.VALID_PATTERNS,
        };
    }
    public loadFile(filePath: string, isModule: boolean = false) {
        try {
            return this.parseAst(fs.readFileSync(filePath, 'utf8'), isModule);
        } catch (e) {
            console.error(`Error loading file ${filePath}:`, e);
            return null;
        }
    }

    public loadCode(code: string, isModule: boolean = false) {
        return this.parseAst(code, isModule);
    }

    public extract(ast: t.Node): PluginTranslationV1Ast[] {
        const results: PluginTranslationV1Ast[] = [];
        this.traverseWhitelist(ast, (type, name, valueNode) => {
            const source = this.extractSource(valueNode);
            if (source && this.isValidText(source)) {
                results.push({ type, name, source, target: source });
            }
        });
        return this.deduplicateResults(results);
    }

    public translate(ast: t.Node, translations: PluginTranslationV1Ast[]): string {
        const strictMap = new Map<string, string>();
        const looseMap = new Map<string, string>();

        translations.forEach(item => {
            if (item.type && item.name) strictMap.set(this.getFingerprint(item), item.target);
            looseMap.set(item.source, item.target);
        });

        this.traverseAllStrings(ast, (type, name, valueNode) => {
            const source = this.extractSource(valueNode);
            if (!source) return;
            let target = strictMap.get(this.getFingerprint({ type, name, source } as any));
            if (!target) target = looseMap.get(source);
            if (target && target !== source) this.replaceSource(valueNode, target);
        });

        return generate(ast, { minified: true, comments: false, jsescOption: { minimal: true } }).code;
    }

    private isValidText(text: string): boolean {
        if (text.length < 2) return false;
        if (this.contentRules.REJECT_PATTERNS.some((regex: RegExp) => regex.test(text))) return false;
        if (this.contentRules.VALID_PATTERNS.some((regex: RegExp) => regex.test(text))) return true;
        return false;
    }

    private traverseWhitelist(ast: t.Node, callback: (type: string, name: string, valueNode: t.StringLiteral | t.TemplateLiteral) => void) {
        traverse(ast, {
            VariableDeclarator: (path) => {
                const node = path.node;
                const name = t.isIdentifier(node.id) ? node.id.name : null;
                if (name && this.config.assignments.includes(name) && this.isStrNode(node.init)) callback('VariableDeclarator', name, node.init);
            },
            AssignmentExpression: (path) => {
                const node = path.node;
                const name = this.getAssignName(node.left);
                if (name && this.config.assignments.includes(name) && this.isStrNode(node.right)) callback('AssignmentExpression', name, node.right);
            },
            ObjectProperty: (path) => {
                const node = path.node;
                const name = this.getObjKeyName(node.key);
                if (name && this.config.keys.includes(name) && this.isStrNode(node.value)) callback('ObjectProperty', name, node.value);
            },
            CallExpression: (path) => {
                const node = path.node;
                const name = this.getCallName(node.callee);
                if (name && this.config.functions.includes(name)) {
                    node.arguments.forEach(arg => { if (this.isStrNode(arg)) callback('CallExpression', name, arg); });
                }
            },
            NewExpression: (path) => {
                const node = path.node;
                const name = this.getCallName(node.callee);
                if (name && this.config.functions.includes(name)) {
                    node.arguments.forEach(arg => { if (this.isStrNode(arg)) callback('NewExpression', name, arg); });
                }
            }
        });
    }

    private traverseAllStrings(ast: t.Node, callback: (type: string, name: string, valueNode: t.StringLiteral | t.TemplateLiteral) => void) {
        traverse(ast, {
            VariableDeclarator: (path) => {
                const node = path.node;
                const name = t.isIdentifier(node.id) ? node.id.name : 'var';
                if (this.isStrNode(node.init)) callback('VariableDeclarator', name, node.init);
            },
            AssignmentExpression: (path) => {
                const node = path.node;
                const name = this.getAssignName(node.left) || 'assign';
                if (this.isStrNode(node.right)) callback('AssignmentExpression', name, node.right);
            },
            ObjectProperty: (path) => {
                const node = path.node;
                const name = this.getObjKeyName(node.key) || 'prop';
                if (this.isStrNode(node.value)) callback('ObjectProperty', name, node.value);
            },
            CallExpression: (path) => {
                const node = path.node;
                const name = this.getCallName(node.callee) || 'func';
                node.arguments.forEach(arg => { if (this.isStrNode(arg)) callback('CallExpression', name, arg); });
            },
            NewExpression: (path) => {
                const node = path.node;
                const name = this.getCallName(node.callee) || 'new';
                node.arguments.forEach(arg => { if (this.isStrNode(arg)) callback('NewExpression', name, arg); });
            }
        });
    }

    private parseAst(code: string, isModule: boolean) {
        try {
            return parse(code, {
                sourceType: isModule ? 'module' : 'script',
                attachComment: false,
                plugins: ["typescript", "jsx", "classProperties", "objectRestSpread", "optionalChaining", "nullishCoalescingOperator", "decorators-legacy"],
                errorRecovery: true
            });
        } catch (e) {
            console.warn("AST Parse Error:", (e as Error).message?.split('\n')[0]);
            return null;
        }
    }

    private isStrNode(node: any): node is t.StringLiteral | t.TemplateLiteral {
        return t.isStringLiteral(node) || t.isTemplateLiteral(node);
    }

    private extractSource(node: t.StringLiteral | t.TemplateLiteral): string {
        if (t.isStringLiteral(node)) return node.value;
        if (t.isTemplateLiteral(node) && node.quasis.length === 1) return node.quasis[0].value.raw;
        return "";
    }

    private replaceSource(node: t.StringLiteral | t.TemplateLiteral, target: string) {
        if (!target.includes('${')) {
            if (t.isStringLiteral(node)) node.value = target;
            else {
                node.quasis = [t.templateElement({ raw: target, cooked: target }, true)];
                node.expressions = [];
            }
            return;
        }
        try {
            const safeTarget = target.replace(/`/g, '\\`');
            const ast = parseExpression('`' + safeTarget + '`');
            if (t.isTemplateLiteral(ast)) Object.assign(node, { type: 'TemplateLiteral', quasis: ast.quasis, expressions: ast.expressions });
        } catch (e) { /* ignore */ }
    }

    private getAssignName(node: t.Node): string | null {
        if (t.isIdentifier(node)) return node.name;
        if (t.isMemberExpression(node)) {
            if (t.isIdentifier(node.property)) return node.property.name;
            if (t.isStringLiteral(node.property)) return node.property.value;
        }
        return null;
    }

    private getObjKeyName(key: t.Node): string | null {
        if (t.isIdentifier(key)) return key.name;
        if (t.isStringLiteral(key)) return key.value;
        return null;
    }

    private getCallName(node: t.Node): string | null {
        if (t.isIdentifier(node)) return node.name;
        if (t.isMemberExpression(node)) return this.getCallName(node.property);
        return null;
    }

    private getFingerprint(item: { type: string, name: string, source: string }) {
        return `${item.type}:${item.name}:${item.source}`;
    }

    private deduplicateResults(results: PluginTranslationV1Ast[]) {
        const map = new Map();
        results.forEach(r => map.set(this.getFingerprint(r), r));
        return Array.from(map.values()).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    }
}
function parseExpression(arg0: string): any {
    throw new Error('Function not implemented.');
}

