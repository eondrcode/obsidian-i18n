import React, { useState, useMemo } from 'react';
import * as path from 'path';
import * as fs from 'fs-extra';
import { useTranslation } from 'react-i18next';
import { FolderOpen, FileOutput, XCircle, Loader2, MoreHorizontal, Pen } from 'lucide-react';
import I18N from 'src/main';
import { OBThemeManifest, ThemeTranslationV1 } from 'src/types';
import { i18nOpen } from '../../../utils';
import { loadTranslationFile } from '../../../manager/io-manager';
import { useGlobalStoreInstance } from '~/utils';
import { THEME_EDITOR_VIEW_TYPE } from '../../theme_editor/editor';
import {
    Button,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Badge,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
    Separator,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '~/shadcn';
import { cn } from '~/shadcn/lib/utils';

export interface ThemeItemData {
    statusColor: string;
    statusText: string;
    statusDesc: string;
    hasTranslation: boolean;
    translationPath: string;
    themeDir: string;
    themeCssPath: string;
    sources: any[];
    activeSourceId: string | null;
    isApplied: boolean;
    isTranslated: boolean;
}

interface ThemeItemProps {
    theme: { name: string; manifest: OBThemeManifest | null; dir: string; isActive: boolean };
    i18n: I18N;
    data: ThemeItemData;
    refreshParent: () => void;
    viewMode: 'list' | 'grid';
}

export const ThemeItem: React.FC<ThemeItemProps> = React.memo(({ theme, i18n, data, refreshParent, viewMode }) => {
    const { t } = useTranslation();
    const [extracting, setExtracting] = useState(false);
    const [replacing, setReplacing] = useState(false);
    const [restoring, setRestoring] = useState(false);

    const {
        statusColor, statusText, statusDesc, hasTranslation, translationPath,
        themeDir, themeCssPath, sources, activeSourceId, isApplied
    } = data;

    const sourceManager = i18n.sourceManager;

    const handleExtract = async () => {
        setExtracting(true);
        try {
            if (!fs.existsSync(themeCssPath)) {
                i18n.notice.error(t('Manager.Errors.ThemeCssNotFound'));
                return;
            }

            const cssStr = fs.readFileSync(themeCssPath).toString();
            const manifestPath = path.join(themeDir, 'manifest.json');
            let manifest: OBThemeManifest = { name: theme.name, version: '0.0.0', minAppVersion: '', author: '', authorUrl: '' };
            if (fs.existsSync(manifestPath)) {
                try { manifest = fs.readJsonSync(manifestPath); } catch (e) { /* use default */ }
            }

            const { generateTheme } = await import('../../../utils');
            const themeTranslation = generateTheme(manifest, cssStr, i18n.settings);

            if (themeTranslation.dict.length === 0) {
                i18n.notice.error(t('Manager.Errors.NoSettingsBlock'));
                return;
            }

            if (i18n.sourceManager) {
                await i18n.sourceManager.extractAndSaveSource(theme.name, themeTranslation, { title: theme.name, type: 'theme' });
                i18n.notice.successPrefix(t('Manager.Notices.ThemeExtractPrefix'), t('Manager.Hints.ExtractSuccessDesc'));
            }
            refreshParent();
        } catch (error) {
            i18n.notice.result(false, `${error}`);
        } finally {
            setExtracting(false);
        }
    };

    const handleReplace = async () => {
        if (replacing) return;
        setReplacing(true);
        try {
            if (!translationPath || !fs.existsSync(translationPath)) {
                i18n.notice.error(t('Manager.Errors.BackupNotFound'));
                return;
            }

            const translationJson: ThemeTranslationV1 = loadTranslationFile(translationPath);
            if (!translationJson || !translationJson.dict) {
                i18n.notice.error(t('Manager.Errors.ErrorDesc'));
                return;
            }

            await i18n.backupManager.createBackup(theme.name, themeDir, ['theme.css']);

            let cssStr = fs.readFileSync(themeCssPath).toString();

            cssStr = cssStr.replace(/\/\* @settings([\s\S]*?)\*\//g, (match, blockContent) => {
                let newBlockContent = blockContent;

                for (const item of translationJson.dict) {
                    const type = item.type;
                    const source = item.source;
                    const target = item.target;

                    if (source && target && source !== target) {
                        const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const replacerRegex = new RegExp(`^([ \\t]*)(${type}):\\s*(["']?)${escapedSource}\\3[ \\t]*(?:\\r?\\n|$)`, 'gm');

                        newBlockContent = newBlockContent.replace(replacerRegex, (fullMatch: string, indent: string, key: string, quote: string) => {
                            return `${indent}${key}: ${quote}${target}${quote}\n`;
                        });
                    }
                }
                return `/* @settings${newBlockContent}*/`;
            });

            fs.writeFileSync(themeCssPath, cssStr);

            const version = translationJson.metadata?.version || '1.0.0';
            i18n.stateManager.setThemeState(theme.name, {
                id: theme.name,
                isApplied: true,
                pluginVersion: theme.manifest?.version || '0.0.0',
                translationVersion: String(version)
            });

            i18n.notice.result(true);
            refreshParent();
        } catch (error) {
            i18n.notice.result(false, String(error));
        } finally {
            setReplacing(false);
        }
    };

    const handleRestore = async () => {
        if (restoring) return;
        setRestoring(true);
        try {
            const restored = await i18n.backupManager.restoreBackup(theme.name, themeDir);
            if (restored) {
                i18n.stateManager.deleteThemeState(theme.name);
                i18n.notice.result(true);
            } else {
                i18n.notice.result(false, t('Manager.Errors.BackupNotFound'));
            }
            refreshParent();
        } catch (error) {
            i18n.notice.result(false, String(error));
        } finally {
            setRestoring(false);
        }
    };

    if (viewMode === 'grid') {
        return (
            <div className="flex flex-col h-[150px] border rounded-lg bg-card text-card-foreground shadow-sm hover:bg-muted/50 transition-colors p-3 relative group">
                <div className="flex justify-between items-start mb-1 gap-1">
                    <div className="flex flex-col overflow-hidden mr-1 min-w-0">
                        <span className="font-medium truncate text-sm" title={theme.name}>{theme.name}</span>
                        <span className="text-xs text-muted-foreground">
                            {theme.manifest ? `v${theme.manifest.version}` : ''}
                            {theme.isActive && <span className="ml-1 text-primary">({t('Manager.Labels.ThemeActive')})</span>}
                        </span>
                    </div>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger className="flex items-center shrink-0">
                                <Badge variant="outline" className="shrink-0 pointer-events-none px-2 h-5 text-[10px] whitespace-nowrap gap-1">
                                    <span className={cn("w-2 h-2 rounded-full", statusColor)}></span>
                                    {statusText}
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p dangerouslySetInnerHTML={{ __html: statusDesc }}></p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <div className="flex-1 text-[9px] text-muted-foreground/80 line-clamp-5 overflow-hidden text-ellipsis leading-relaxed break-all">
                    {theme.manifest?.author ? `${t('Manager.Labels.Author')}: ${theme.manifest.author}` : ''}
                </div>
                <div className="flex flex-col gap-2 mt-auto pt-2">
                    <Separator />
                    <div className="flex items-center justify-between">
                        {sources.length > 0 ? (
                            <Select
                                value={activeSourceId ?? undefined}
                                onValueChange={(val) => {
                                    sourceManager?.setActive(val, true);
                                    refreshParent();
                                }}
                            >
                                <SelectTrigger className="w-[100px] text-xs px-2" size="sm">
                                    <SelectValue placeholder={t('Manager.Filters.All')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {sources.map(source => (
                                        <SelectItem key={source.id} value={source.id} className="text-xs">
                                            {source.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : <div />}
                        <div className="flex gap-1">
                            {hasTranslation && !isApplied && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="default" size="sm" className="h-8 px-3 gap-1" onClick={handleReplace} disabled={replacing}>
                                                {replacing && <Loader2 className="w-3 h-3 animate-spin" />}
                                                {t('Manager.Actions.Apply')}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{t('Manager.Notices.ThemeApplyPrefix')}</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            {isApplied && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="secondary" size="sm" className="h-8 px-3 gap-1" onClick={handleRestore} disabled={restoring}>
                                                {restoring && <Loader2 className="w-3 h-3 animate-spin" />}
                                                {t('Manager.Actions.Restore')}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{t('Manager.Notices.ThemeRestorePrefix')}</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    {hasTranslation && (
                                        <DropdownMenuItem onClick={() => {
                                            const translationJson: ThemeTranslationV1 = loadTranslationFile(translationPath);
                                            if (translationJson) {
                                                useGlobalStoreInstance.getState().setEditorTheme(
                                                    translationJson, theme.name, themeDir, translationPath
                                                );
                                                i18n.view.activateView(THEME_EDITOR_VIEW_TYPE);
                                            }
                                        }}>
                                            <Pen className="w-4 h-4 mr-2" />
                                            <span>{t('Manager.Actions.Edit')}</span>
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={handleExtract} disabled={extracting}>
                                        <FileOutput className="w-4 h-4 mr-2" />
                                        <span>{t('Manager.Notices.ThemeExtractPrefix')}</span>
                                    </DropdownMenuItem>
                                    {activeSourceId && (
                                        <DropdownMenuItem onClick={() => {
                                            sourceManager?.removeSource(activeSourceId);
                                            refreshParent();
                                        }} className="text-destructive focus:text-destructive">
                                            <XCircle className="w-4 h-4 mr-2" />
                                            <span>{t('Manager.Actions.Delete')}</span>
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => i18nOpen(i18n, themeDir)}>
                                        <FolderOpen className="w-4 h-4 mr-2" />
                                        <span>{t('Manager.Actions.OpenFolder')}</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="border rounded-lg bg-card text-card-foreground shadow-sm hover:bg-muted/50 transition-colors px-4 py-2 w-full" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'center' }}>
            <div className="flex items-center gap-3 overflow-hidden min-w-0">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger className="flex items-center shrink-0">
                            <Badge variant="outline" className="shrink-0 pointer-events-none px-2 h-5 text-[10px] whitespace-nowrap gap-1">
                                <span className={cn("w-2 h-2 rounded-full", statusColor)}></span>
                                {statusText}
                            </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p dangerouslySetInnerHTML={{ __html: statusDesc }}></p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <div className="flex items-baseline gap-2 min-w-0 overflow-hidden">
                    <span className="font-medium truncate text-sm">{theme.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0 opacity-80">
                        {theme.manifest ? `v${theme.manifest.version}` : ''}
                    </span>
                    {theme.isActive && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                            {t('Manager.Labels.ThemeActive')}
                        </Badge>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                {sources.length > 0 && (
                    <div className="flex items-center gap-1">
                        <Select
                            value={activeSourceId ?? undefined}
                            onValueChange={(val) => {
                                sourceManager?.setActive(val, true);
                                refreshParent();
                            }}
                        >
                            <SelectTrigger className="w-[120px]" size="sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {sources.map(source => (
                                    <SelectItem key={source.id} value={source.id}>
                                        {source.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {hasTranslation && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => {
                                    const translationJson: ThemeTranslationV1 = loadTranslationFile(translationPath);
                                    if (translationJson) {
                                        useGlobalStoreInstance.getState().setEditorTheme(
                                            translationJson, theme.name, themeDir, translationPath
                                        );
                                        i18n.view.activateView(THEME_EDITOR_VIEW_TYPE);
                                    }
                                }}>
                                    <Pen className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('Manager.Actions.Edit')}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {hasTranslation && !isApplied && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="default" size="sm" className="h-8 px-3 gap-1" onClick={handleReplace} disabled={replacing}>
                                    {replacing && <Loader2 className="w-3 h-3 animate-spin" />}
                                    {t('Manager.Actions.Apply')}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('Manager.Notices.ThemeApplyPrefix')}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {isApplied && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="secondary" size="sm" className="h-8 px-3 gap-1" onClick={handleRestore} disabled={restoring}>
                                    {restoring && <Loader2 className="w-3 h-3 animate-spin" />}
                                    {t('Manager.Actions.Restore')}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('Manager.Notices.ThemeRestorePrefix')}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={handleExtract} disabled={extracting}>
                            <FileOutput className="w-4 h-4 mr-2" />
                            <span>{t('Manager.Notices.ThemeExtractPrefix')}</span>
                        </DropdownMenuItem>
                        {activeSourceId && (
                            <DropdownMenuItem onClick={() => {
                                sourceManager?.removeSource(activeSourceId);
                                refreshParent();
                            }} className="text-destructive focus:text-destructive">
                                <XCircle className="w-4 h-4 mr-2" />
                                <span>{t('Manager.Actions.Delete')}</span>
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => i18nOpen(i18n, themeDir)}>
                            <FolderOpen className="w-4 h-4 mr-2" />
                            <span>{t('Manager.Actions.OpenFolder')}</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
});
