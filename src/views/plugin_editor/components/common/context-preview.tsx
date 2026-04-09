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
 * 不依赖 extractCodeContext，直接做更精准的全行搜索
 */
function findInSource(sourceCode: string, searchStr: string, radius = 10): Omit<PreviewData, 'fileName'> | null {
    const allLines = sourceCode.split('\n');
    let matchLineIndex = -1;

    // 找到第一个包含目标字符串的行
    for (let i = 0; i < allLines.length; i++) {
        if (allLines[i].includes(searchStr)) {
            matchLineIndex = i;
            break;
        }
    }

    if (matchLineIndex === -1) return null;

    const startLine = Math.max(0, matchLineIndex - radius);
    const endLine = Math.min(allLines.length - 1, matchLineIndex + radius);

    const lines = [];
    for (let i = startLine; i <= endLine; i++) {
        lines.push({
            lineNumber: i + 1,
            content: allLines[i],
            isHighlighted: allLines[i].includes(searchStr)
        });
    }

    return {
        source: searchStr,
        lines,
        matchLine: matchLineIndex + 1
    };
}

/**
 * 主动加载源码：不依赖诊断流程，直接从磁盘读取
 */
function loadSourceCode(currentFile: string): string | null {
    try {
        const { sourceCache, setSourceCache } = useRegexStore.getState();

        // 1. 缓存命中
        if (sourceCache[currentFile]) {
            return sourceCache[currentFile];
        }

        // 2. 从磁盘读取
        const i18n = useGlobalStoreInstance.getState().i18n;
        const metadata = useRegexStore.getState().metadata;
        if (!i18n || !metadata) return null;

        const pluginId = metadata.plugin;
        // @ts-ignore
        const manifest = i18n.app.plugins.manifests[pluginId];
        if (!manifest) return null;

        // @ts-ignore
        const basePath = path.normalize(i18n.app.vault.adapter.getBasePath());
        const pluginDir = path.join(basePath, manifest.dir || '');
        const targetFilePath = path.join(pluginDir, currentFile);

        if (fs.existsSync(targetFilePath)) {
            const code = fs.readFileSync(targetFilePath, 'utf8');
            if (code) {
                setSourceCache(currentFile, code);
                return code;
            }
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
        const handleSelection = (e: CustomEvent<SelectedItemDetail>) => {
            const { source } = e.detail;
            if (!source || source.trim().length < 2) {
                setPreviewData(null);
                return;
            }

            const { currentFile } = useRegexStore.getState();

            // 自主加载源码（缓存优先 → 磁盘兜底）
            const sourceCode = loadSourceCode(currentFile);
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
        if (!content.includes(source)) return content;

        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let idx = content.indexOf(source);
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
                    {source}
                </mark>
            );
            lastIndex = idx + source.length;
            idx = content.indexOf(source, lastIndex);
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
