import I18N from '../../main';
import { loadTranslationFile } from '../../manager/io-manager';

export interface AstMatchResult {
    pluginId: string;
    file: string;
    type: string;
    name: string;
    source: string;
    target: string;
}

/**
 * 全局检索包含特定文本的 AST 信息
 * @param text 搜索文本 (通常是 UI 上点击到的文本)
 * @param i18n 指向插件实例的引用
 */
export async function findAstItemsByText(text: string, i18n: I18N): Promise<AstMatchResult[]> {
    const results: AstMatchResult[] = [];
    const searchStr = text.trim();
    if (!searchStr) return results;

    // 1. 获取所有已应用翻译的插件状态
    const pluginStates = i18n.stateManager.getAllPluginStates();
    const appliedPluginIds = Object.keys(pluginStates).filter(id => pluginStates[id].isApplied);

    for (const pluginId of appliedPluginIds) {
        // 2. 获取该插件当前激活的翻译源路径
        const sourcePath = i18n.sourceManager.getActiveSourcePath(pluginId);
        if (!sourcePath) continue;

        // 3. 加载并遍历翻译字典
        const translation = loadTranslationFile(sourcePath);
        if (!translation || !translation.dict) continue;

        for (const [filePath, fileContent] of Object.entries(translation.dict as any)) {
            const astItems = (fileContent as any).ast || [];
            
            // 4. 匹配条目 (匹配原文或译文)
            const matches = astItems.filter((item: any) => 
                item.target === searchStr || item.source === searchStr
            );

            matches.forEach((item: any) => {
                results.push({
                    pluginId,
                    file: filePath,
                    type: item.type,
                    name: item.name,
                    source: item.source,
                    target: item.target
                });
            });
        }
    }

    return results;
}
