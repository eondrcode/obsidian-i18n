import React, { useState, useEffect, useCallback } from 'react';
import * as path from 'path';
import * as fs from 'fs-extra';
import { useTranslation } from 'react-i18next';
import { Code2, ChevronDown, ChevronUp, FileCode } from 'lucide-react';
import { Button } from '@/src/shadcn';
import { useRegexStore } from '../../store';
import { useGlobalStoreInstance } from '~/utils';

/** 选中项事件 payload */
interface SelectedItemDetail {
    source: string;
    type: 'ast' | 'regex';
    name?: string;
    astType?: string;
}

/** 预览数据 */
interface PreviewData {
    source: string;
    lines: { lineNumber: number; content: string; isHighlighted: boolean }[];
    fileName: string;
    matchLine: number;
}

/**
 * 从源代码中搜索字符串并返回带行号的上下文
 * 阶梯式搜索：精确满足 -> 转义容错 -> 模糊匹配 (忽略空白)
 */
function findInSource(sourceCode: string, searchStr: string, radius = 10): Omit<PreviewData, 'fileName'> | null {
    if (!sourceCode || !searchStr) return null;

    // 清理搜索词，去掉首位可能的噪音
    const target = searchStr.trim();
    if (target.length < 2) return null;

    // --- 阶段 1: 精确/转义查找 ---
    let matchIndex = sourceCode.indexOf(target);
    let finalSearchStr = target;

    if (matchIndex === -1) {
        // 尝试还原转义字符（处理 AST 提取后的文本）
        const escaped = target
            .replace(/\\/g, '\\\\')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/"/g, '\\"')
            .replace(/'/g, "\\'");

        matchIndex = sourceCode.indexOf(escaped);
        if (matchIndex !== -1) {
            finalSearchStr = escaped;
        }
    }

    // --- 阶段 2: 忽略包裹引号 ---
    if (matchIndex === -1) {
        const unquoted = target.replace(/^(['"`])(.*)\1$/, '$2');
        if (unquoted !== target) {
            matchIndex = sourceCode.indexOf(unquoted);
            if (matchIndex !== -1) finalSearchStr = unquoted;
        }
    }

    // --- 阶段 3: 模糊匹配 (针对空格/换行不一致的情况) ---
    if (matchIndex === -1) {
        // 将搜索词转为忽略空白的正则
        try {
            // 逸出正则特殊字符，并将空白转为 \s+
            const escapedForRegex = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const fuzzyRegex = new RegExp(escapedForRegex.replace(/\s+/g, '\\s*'), 'g');
            const match = fuzzyRegex.exec(sourceCode);
            if (match) {
                matchIndex = match.index;
                finalSearchStr = match[0];
            }
        } catch (e) { /* ignore */ }
    }

    // --- 阶段 4: 极端情况 - 部分匹配 (仅用于大文本) ---
    if (matchIndex === -1 && target.length > 30) {
        const head = target.slice(0, 20);
        matchIndex = sourceCode.indexOf(head);
        if (matchIndex !== -1) finalSearchStr = head;
    }

    if (matchIndex === -1) return null;

    // 计算上下文
    const beforeMatch = sourceCode.slice(0, matchIndex);
    const matchLineIndex = beforeMatch.split('\n').length - 1;
    const allLines = sourceCode.split('\n');

    const startLine = Math.max(0, matchLineIndex - radius);
    const endLine = Math.min(allLines.length - 1, matchLineIndex + radius);

    const searchParts = finalSearchStr.split('\n').filter(p => p.trim().length > 0);

    const lines = [];
    for (let i = startLine; i <= endLine; i++) {
        const content = allLines[i];
        const isMatch = searchParts.some(part => content.includes(part));
        lines.push({
            lineNumber: i + 1,
            content: content,
            isHighlighted: isMatch
        });
    }

    return {
        source: finalSearchStr,
        lines,
        matchLine: matchLineIndex + 1
    };
}

/**
 * 异步加载源码：支持备份读取（用于已翻译场景）
 */
async function loadSourceCodeAsync(currentFile: string): Promise<string | null> {
    try {
        const { sourceCache, setSourceCache, metadata } = useRegexStore.getState();

        // 1. 缓存优先
        if (sourceCache[currentFile]) return sourceCache[currentFile];

        const i18n = useGlobalStoreInstance.getState().i18n;
        if (!i18n || !metadata) return null;

        const pluginId = metadata.plugin;

        // 2. 检查应用状态
        const state = i18n.stateManager.getPluginState(pluginId);
        const isApplied = !!(state && state.isApplied);

        let code: string | null = null;

        // 3. 如果已应用翻译，强制从备份中提取原汁原味的源码
        if (isApplied) {
            code = await i18n.backupManager.getBackupContent(pluginId, currentFile);
        }

        // 4. 如果未应用或备份获取失败，从磁盘读取
        if (!code) {
            // @ts-ignore
            const manifest = i18n.app.plugins.manifests[pluginId];
            if (!manifest) return null;

            // @ts-ignore
            const basePath = path.normalize(i18n.app.vault.adapter.getBasePath());
            const pluginDir = path.join(basePath, manifest.dir || '');
            const targetFilePath = path.join(pluginDir, currentFile);

            if (await fs.pathExists(targetFilePath)) {
                code = await fs.readFile(targetFilePath, 'utf8');
            }
        }

        if (code) {
            setSourceCache(currentFile, code);
            return code;
        }

        return null;
    } catch (e) {
        console.warn('[ContextPreview] 源码加载失败:', e);
        return null;
    }
}

/**
 * 源码位置预览面板
 *
 * 当翻译者选中表格中的条目时，实时显示该字符串在源码中的位置。
 * 自动从磁盘加载源码，无需先运行诊断。
 */
const ContextPreview: React.FC = () => {
    const { t } = useTranslation();
    const [collapsed, setCollapsed] = useState(false);
    const [previewData, setPreviewData] = useState<PreviewData | null>(null);

    // 监听选中事件
    useEffect(() => {
        const handleSelection = async (e: CustomEvent<SelectedItemDetail>) => {
            const { source } = e.detail;
            if (!source || source.length < 2) {
                setPreviewData(null);
                return;
            }

            const { currentFile } = useRegexStore.getState();

            // 改为异步加载，确保能读到备份内容
            const sourceCode = await loadSourceCodeAsync(currentFile);
            if (!sourceCode) {
                setPreviewData(null);
                return;
            }

            const result = findInSource(sourceCode, source, 10);
            if (!result) {
                setPreviewData(null);
                return;
            }

            setPreviewData({
                ...result,
                fileName: currentFile,
            });
        };

        const handleClear = () => setPreviewData(null);

        window.addEventListener('i18n-item-selected', handleSelection as EventListener);
        window.addEventListener('i18n-item-deselected', handleClear);
        return () => {
            window.removeEventListener('i18n-item-selected', handleSelection as EventListener);
            window.removeEventListener('i18n-item-deselected', handleClear);
        };
    }, []);

    // 高亮渲染函数：将行内匹配文本用 <mark> 包裹
    const renderHighlightedContent = useCallback((content: string, source: string) => {
        const searchParts = source.split('\n').filter(p => p.trim().length > 0);
        if (searchParts.length === 0) return content;

        // 找到当前行包含的所有片段
        const matches = searchParts.filter(p => content.includes(p));
        if (matches.length === 0) return content;

        // 简单处理：对该行内最长的匹配片段进行高亮
        // (注：这里可以更复杂，但对于代码预览来说，定位到主片段已足够)
        const bestMatch = matches.sort((a, b) => b.length - a.length)[0];

        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let idx = content.indexOf(bestMatch);
        let keyCounter = 0;

        while (idx !== -1) {
            if (idx > lastIndex) {
                parts.push(content.slice(lastIndex, idx));
            }
            parts.push(
                <mark
                    key={keyCounter++}
                    className="bg-yellow-400/30 dark:bg-yellow-500/25 text-foreground rounded-sm px-0.5 ring-1 ring-yellow-400/40"
                >
                    {bestMatch}
                </mark>
            );
            lastIndex = idx + bestMatch.length;
            idx = content.indexOf(bestMatch, lastIndex);
        }

        if (lastIndex < content.length) {
            parts.push(content.slice(lastIndex));
        }

        return <>{parts}</>;
    }, []);

    // 折叠状态：仅显示一行标题栏
    if (collapsed) {
        return (
            <div className="flex items-center justify-between px-3 py-1.5 border-t bg-muted/30 shrink-0">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Code2 className="w-3.5 h-3.5" />
                    <span className="font-medium">{t('Editor.Titles.ContextPreview')}</span>
                    {previewData && (
                        <span className="text-primary/70 ml-1">
                            {previewData.fileName} · {t('Editor.Labels.LineNumber', { line: previewData.matchLine })}
                        </span>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => setCollapsed(false)}
                >
                    <ChevronUp className="w-3.5 h-3.5" />
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full border-t overflow-hidden">
            {/* 标题栏 */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 shrink-0 border-b">
                <div className="flex items-center gap-1.5 text-xs">
                    <Code2 className="w-3.5 h-3.5 text-primary" />
                    <span className="font-medium">{t('Editor.Titles.ContextPreview')}</span>
                    {previewData && (
                        <>
                            <span className="text-muted-foreground mx-1">·</span>
                            <FileCode className="w-3 h-3 text-muted-foreground" />
                            <span className="text-muted-foreground">{previewData.fileName}</span>
                            <span className="text-primary font-mono text-[11px]">
                                :{previewData.matchLine}
                            </span>
                        </>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => setCollapsed(true)}
                >
                    <ChevronDown className="w-3.5 h-3.5" />
                </Button>
            </div>

            {/* 代码预览区 — 支持垂直+水平滚动 */}
            {previewData ? (
                <div className="flex-1 min-h-0 overflow-auto">
                    <div className="font-mono text-xs leading-relaxed min-w-max">
                        {previewData.lines.map((line) => (
                            <div
                                key={line.lineNumber}
                                className={`flex ${line.isHighlighted
                                    ? 'bg-primary/8 border-l-2 border-l-primary'
                                    : 'border-l-2 border-l-transparent hover:bg-accent/30'
                                    } transition-colors duration-150`}
                            >
                                {/* 行号 — sticky 固定在左侧 */}
                                <span
                                    className={`sticky left-0 inline-block w-12 shrink-0 text-right pr-3 py-px select-none z-10 ${line.isHighlighted
                                        ? 'text-primary font-semibold bg-primary/8'
                                        : 'text-muted-foreground/50 bg-background/80'
                                        }`}
                                >
                                    {line.lineNumber}
                                </span>
                                {/* 代码内容 — 不换行，水平滚动 */}
                                <span className="whitespace-pre px-2 py-px">
                                    {line.isHighlighted
                                        ? renderHighlightedContent(line.content, previewData.source)
                                        : line.content
                                    }
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center p-6">
                    <div className="text-center space-y-2">
                        <Code2 className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                        <p className="text-xs text-muted-foreground/60">
                            {t('Editor.Hints.SelectItemToPreview')}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

ContextPreview.displayName = 'ContextPreview';

export { ContextPreview };
