import fs from 'fs';
import { parse, parseExpression } from "@babel/parser";
import traverse from '@babel/traverse';
import { generate } from "@babel/generator";
import * as t from '@babel/types';
import { PluginTranslationV1Ast } from '~/types';

// ====================================================================================================
//                                      Configuration (白名单配置)
// ====================================================================================================

/**
 * 严格白名单配置
 * 只有在以下上下文中出现的字符串才会被考虑提取
 */


export class AstTranslator {
    private settings: any; // I18nSettings
    private rejectPatterns: RegExp[] = [];
    private validPatterns: RegExp[] = [];

    constructor(settings: any) {
        this.settings = settings;
        this.initPatterns();
    }

    private initPatterns() {
        if (this.settings.astRejectRe) {
            this.rejectPatterns = this.settings.astRejectRe.map((s: string) => new RegExp(s, 'i'));
        }
        if (this.settings.astValidRe) {
            this.validPatterns = this.settings.astValidRe.map((s: string) => new RegExp(s, 'i'));
        }
    }

    // ====================================================================================================
    //                                      1. Public API
    // ====================================================================================================

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

    /**
     * 提取逻辑 (极度保守)
     * 1. 只从 settings 白名单上下文中提取
     * 2. 只提取通过 isValidText 校验的内容
     */
    public extract(ast: t.Node): PluginTranslationV1Ast[] {
        const results: PluginTranslationV1Ast[] = [];

        this.traverseWhitelist(ast, (type, name, valueNode) => {
            const source = this.extractSource(valueNode);
            // 双重校验：上下文白名单 (implicit) + 内容有效性 (explicit)
            if (source && this.isValidText(source)) {
                results.push({ type, name, source, target: source });
            }
        });

        return this.deduplicateResults(results);
    }

    /**
     * 翻译逻辑 (宽松匹配)
     * 支持严格匹配 (type:name:source) 和宽松匹配 (source only)
     */
    public translate(ast: t.Node, translations: PluginTranslationV1Ast[]): string {
        // 1. 构建查找表
        const strictMap = new Map<string, string>(); // type:name:source -> target
        const looseMap = new Map<string, string>();  // source -> target (fallback)

        translations.forEach(item => {
            if (item.type && item.name) {
                strictMap.set(this.getFingerprint(item), item.target);
            }
            looseMap.set(item.source, item.target);
        });

        // 2. 遍历所有字符串节点 (不限于白名单，以支持手动添加的条目)
        this.traverseAllStrings(ast, (type, name, valueNode) => {
            const source = this.extractSource(valueNode);
            if (!source) return;

            // 尝试匹配
            let target = strictMap.get(this.getFingerprint({ type, name, source } as any));
            if (!target) {
                target = looseMap.get(source);
            }

            if (target && target !== source) {
                this.replaceSource(valueNode, target);
            }
        });

        // 3. 生成代码
        return generate(ast, {
            minified: true,
            comments: false,
            jsescOption: { minimal: true }
        }).code;
    }

    /**
     * 验证目标翻译内容的语法合法性
     * @param target 目标翻译字符串
     * @returns boolean 是否合法
     */
    public validateTargetSyntax(target: string): boolean {
        try {
            // 1. 基础字符串验证 (简单字符串直接通过)
            if (!target.includes('${') && !target.includes('`')) {
                return true;
            }

            // 2. 尝试作为模板字面量解析
            // 处理转义字符
            const safeTarget = target.replace(/`/g, '\\`');
            parseExpression('`' + safeTarget + '`', {
                plugins: ["typescript", "jsx", "classProperties", "objectRestSpread", "optionalChaining", "nullishCoalescingOperator", "decorators-legacy"]
            });
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * 克隆 AST 节点 (深拷贝)
     */
    public cloneAst(ast: t.Node): t.Node {
        return t.cloneNode(ast, true);
    }

    // ====================================================================================================
    //                                      2. Content Validation
    // ====================================================================================================

    /**
     * 判断文本内容是否是有效的 UI 文本
     * 策略：必须通过 REJECT 检查，且必须满足至少一个 VALID 特征
     */
    private isValidText(text: string): boolean {
        // 0. 基础长度
        if (text.length < 2) return false;

        // 1. 拒绝匹配任何 REJECT 模式
        if (this.rejectPatterns.some(regex => regex.test(text))) {
            return false;
        }

        // 2. 必须满足至少一个 VALID 特征 (空格/中文/标点)
        if (this.validPatterns.some(regex => regex.test(text))) {
            return true;
        }

        // 3. 默认拒绝 (宁可少提，不可错提)
        return false;
    }

    // ====================================================================================================
    //                                      3. AST Traversal
    // ====================================================================================================

    /**
     * 白名单遍历器 (用于提取)
     * 只访问 settings 中明确列出的上下文
     */
    private traverseWhitelist(ast: t.Node, callback: (type: string, name: string, valueNode: t.StringLiteral | t.TemplateLiteral) => void) {
        traverse(ast, {
            // 1. 变量声明 (const title = "...")
            VariableDeclarator: (path) => {
                const node = path.node;
                const name = t.isIdentifier(node.id) ? node.id.name : null;
                if (name && this.settings.astAssignments.includes(name) && this.isStrNode(node.init)) {
                    callback('VariableDeclarator', name, node.init);
                }
            },
            // 2. 赋值表达式 (obj.title = "...")
            AssignmentExpression: (path) => {
                const node = path.node;
                const name = this.getAssignName(node.left);
                if (name && this.settings.astAssignments.includes(name) && this.isStrNode(node.right)) {
                    callback('AssignmentExpression', name, node.right);
                }
            },
            // 3. 对象属性 ({ name: "..." })
            ObjectProperty: (path) => {
                const node = path.node;
                const name = this.getObjKeyName(node.key);
                if (name && this.settings.astKeys.includes(name) && this.isStrNode(node.value)) {
                    callback('ObjectProperty', name, node.value);
                }
            },
            // 4. 函数调用 (Notice("..."))
            CallExpression: (path) => {
                const node = path.node;
                const name = this.getCallName(node.callee);
                if (name && this.settings.astFunctions.includes(name)) {
                    node.arguments.forEach(arg => {
                        if (this.isStrNode(arg)) {
                            callback('CallExpression', name, arg);
                        }
                    });
                }
            },
            // 5. 构造函数 (new Notice("..."))
            NewExpression: (path) => {
                const node = path.node;
                const name = this.getCallName(node.callee);
                if (name && this.settings.astFunctions.includes(name)) {
                    node.arguments.forEach(arg => {
                        if (this.isStrNode(arg)) {
                            callback('NewExpression', name, arg);
                        }
                    });
                }
            }
        });
    }

    /**
     * 全字符串遍历器 (用于翻译)
     * 遍历所有字符串节点，不受白名单限制
     */
    private traverseAllStrings(ast: t.Node, callback: (type: string, name: string, valueNode: t.StringLiteral | t.TemplateLiteral) => void) {
        traverse(ast, {
            VariableDeclarator: (path) => {
                const node = path.node;
                const name = t.isIdentifier(node.id) ? node.id.name : 'var';
                if (this.isStrNode(node.init)) {
                    callback('VariableDeclarator', name, node.init);
                }
            },
            AssignmentExpression: (path) => {
                const node = path.node;
                const name = this.getAssignName(node.left) || 'assign';
                if (this.isStrNode(node.right)) {
                    callback('AssignmentExpression', name, node.right);
                }
            },
            ObjectProperty: (path) => {
                const node = path.node;
                const name = this.getObjKeyName(node.key) || 'prop';
                if (this.isStrNode(node.value)) {
                    callback('ObjectProperty', name, node.value);
                }
            },
            CallExpression: (path) => {
                const node = path.node;
                const name = this.getCallName(node.callee) || 'func';
                node.arguments.forEach(arg => {
                    if (this.isStrNode(arg)) {
                        callback('CallExpression', name, arg);
                    }
                });
            },
            NewExpression: (path) => {
                const node = path.node;
                const name = this.getCallName(node.callee) || 'new';
                node.arguments.forEach(arg => {
                    if (this.isStrNode(arg)) {
                        callback('NewExpression', name, arg);
                    }
                });
            }
        });
    }

    // ====================================================================================================
    //                                      4. Helpers
    // ====================================================================================================

    private parseAst(code: string, isModule: boolean) {
        try {
            return parse(code, {
                sourceType: isModule ? 'module' : 'script',
                attachComment: false,
                plugins: [
                    "typescript", "jsx", "classProperties", "objectRestSpread",
                    "optionalChaining", "nullishCoalescingOperator", "decorators-legacy"
                ],
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
        if (t.isTemplateLiteral(node) && node.quasis.length === 1) {
            return node.quasis[0].value.raw;
        }
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
            if (t.isTemplateLiteral(ast)) {
                Object.assign(node, { type: 'TemplateLiteral', quasis: ast.quasis, expressions: ast.expressions });
            }
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

    /**
     * 在 AST 中查找目标文本的位置
     * @param targetText 目标文本
     * @param ast AST 节点
     * @returns 匹配项列表
     */
    public findString(targetText: string, ast: t.Node): { line: number, column: number, type: string, name: string, source: string }[] {
        const matches: { line: number, column: number, type: string, name: string, source: string }[] = [];

        this.traverseAllStrings(ast, (type, name, valueNode) => {
            const source = this.extractSource(valueNode);
            if (source && source.includes(targetText)) {
                const loc = valueNode.loc?.start;
                matches.push({
                    line: loc?.line || 0,
                    column: loc?.column || 0,
                    type,
                    name,
                    source
                });
            }
        });

        return matches;
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
