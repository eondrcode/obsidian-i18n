import React, { useState, useMemo } from 'react';
import * as path from 'path';
import * as fs from 'fs-extra';
import { useTranslation } from 'react-i18next';
import { FolderOpen, FileOutput, XCircle, Loader2, MoreHorizontal, Pen, CloudDownload, Cloud } from 'lucide-react';
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
    translationVersion?: string;
    description?: string;
    supportedVersion?: string;
    cloudEntries?: any[];
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
    const [showEmptyDialog, setShowEmptyDialog] = useState(false);

    const {
        statusColor, statusText, statusDesc, hasTranslation, translationPath,
        themeDir, themeCssPath, sources, activeSourceId, isApplied,
        isTranslated, translationVersion, description, supportedVersion, cloudEntries
    } = data;

    const sourceManager = i18n.sourceManager;
    const [downloadingCloudId, setDownloadingCloudId] = useState<string | null>(null);

    const handleCloudDownload = async (entry: any) => {
        if (downloadingCloudId) return;
        setDownloadingCloudId(entry.id);
        try {
            const repo = i18n.settings.defaultCloudRepo;
            if (!repo) {
                i18n.notice.error(t('Cloud.Errors.FetchFail' as any) || 'No default cloud repo set');
                return;
            }
            const parts = repo.split('/');
            if (parts.length !== 2) return;
            const [owner, repoName] = parts;

            const fileRes = await i18n.api.github.getFileContentWithFallback(owner, repoName, `themes/${entry.id}.json`);
            if (!fileRes.state || !fileRes.data) {
                throw new Error(fileRes.isRateLimit ? 'Rate limit exceeded' : fileRes.data?.message || 'Download failed');
            }
            
            const content = typeof fileRes.data === 'string' ? JSON.parse(fileRes.data) : fileRes.data;
            const { calculateChecksum } = await import('../../../utils');
            
            const existingSource = sourceManager?.getAllSources().find(s => s.id === entry.id);
            if (existingSource) {
                sourceManager?.saveSourceFile(existingSource.id, content);
                sourceManager?.saveSource({
                    ...existingSource,
                    origin: 'cloud',
                    title: entry.title || existingSource.title,
                    checksum: calculateChecksum(content),
                    cloud: { owner, repo: repoName, hash: entry.hash },
                    updatedAt: Date.now()
                });
                i18n.notice.successPrefix('Cloud' , t('Cloud.Notices.UpdateSuccess' as any) || 'Update success');
            } else {
                sourceManager?.saveSourceFile(entry.id, content);
                const isOnly = !sourceManager?.getActiveSourceId(theme.name);
                sourceManager?.saveSource({
                    id: entry.id,
                    plugin: entry.plugin,
                    title: entry.title || 'Unknown',
                    type: entry.type,
                    origin: 'cloud',
                    isActive: isOnly,
                    checksum: calculateChecksum(content),
                    cloud: { owner, repo: repoName, hash: entry.hash },
                    updatedAt: Date.now(),
                    createdAt: Date.now()
                });
                i18n.notice.successPrefix('Cloud', t('Cloud.Notices.DownloadSuccess' as any) || 'Download success');
            }
            refreshParent();
        } catch (e) {
            i18n.notice.error(`Failed to download: ${e}`);
        } finally {
            setDownloadingCloudId(null);
        }
    };

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
        if (!isApplied && !isTranslated) {
            setShowEmptyDialog(true);
            return;
        }
        setReplacing(true);
        try {
            const success = await i18n.injectorManager.applyToTheme(theme.name);
            if (success) {
                i18n.notice.result(true);
                refreshParent();
            } else {
                i18n.notice.result(false, t('Manager.Errors.ErrorDesc'));
            }
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
            <div className="group relative flex flex-col h-[200px] border rounded-none bg-card/85 text-card-foreground shadow-xs hover:shadow-lg hover:bg-muted/30 transition-all duration-300 overflow-hidden border-border/60 backdrop-blur-md">
                {/* Side Status Accent */}
                <div className={cn("absolute left-0 top-0 bottom-0 w-[4px] transition-colors duration-300 z-10 bg-opacity-100", statusColor)} />

                <div className="p-4 flex flex-col h-full relative z-0">
                    <div className="flex justify-between items-start mb-3 gap-2">
                        <div className="flex flex-col overflow-hidden min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="font-bold truncate text-[14px] leading-tight text-foreground/90 group-hover:text-primary transition-colors duration-300 whitespace-nowrap" title={theme.name}>{theme.name}</span>
                                {theme.isActive && <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[8px] font-extrabold uppercase tracking-tighter rounded-none bg-primary/10 text-primary border-none shadow-xs shrink-0">{t('Manager.Labels.ThemeActive')}</Badge>}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-muted-foreground/60 font-semibold tracking-tight bg-muted/30 px-1.5 py-0.5 rounded-none">
                                    {theme.manifest ? `v${theme.manifest.version}` : 'v0.0.0'}
                                </span>
                                {translationVersion && (
                                    <span className="text-[10px] text-primary/80 font-bold bg-primary/5 border border-primary/10 px-1.5 py-0.5 rounded-none">
                                        v{translationVersion}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className={cn("px-2 py-0.5 text-[9px] uppercase tracking-widest font-extrabold rounded-none bg-background border border-border shadow-xs flex items-center gap-1.5", statusColor.replace(/bg-/g, 'text-'))}>
                            <span className={cn("w-1.5 h-1.5 rounded-full shadow-sm animate-pulse-slow", statusColor)}></span>
                            {statusText}
                        </div>
                    </div>

                    <div
                        className="flex-1 text-[11px] text-muted-foreground overflow-hidden leading-relaxed break-words font-medium relative line-clamp-2"
                    >
                        {description || (theme.manifest?.author ? `${t('Manager.Labels.Author')}: ${theme.manifest.author}` : t('Common.Status.Unknown'))}
                        <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-card to-transparent pointer-events-none opacity-50" />
                    </div>
                    <div className="flex flex-col gap-3 mt-auto pt-3 border-t border-border/50">
                        <div className="flex items-center justify-between gap-2">
                            {sources.length > 0 ? (
                                <Select
                                    value={activeSourceId ?? undefined}
                                    onValueChange={(val) => {
                                        sourceManager?.setActive(val, true);
                                        refreshParent();
                                    }}
                                >
                                    <SelectTrigger className="w-[110px] text-[10px] px-2 h-7 bg-muted/40 border-none shadow-none hover:bg-muted/60 transition-all rounded-none" size="sm">
                                        <SelectValue placeholder={t('Manager.Filters.All')} />
                                    </SelectTrigger>
                                    <SelectContent className="backdrop-blur-md bg-background/95 border-border/40">
                                        {sources.map(source => (
                                            <SelectItem key={source.id} value={source.id} className="text-[11px]">
                                                {source.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : <div />}
                            <div className="flex gap-2">
                                {hasTranslation && !isApplied && (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="default" size="sm" className="h-7 px-3 text-[10px] font-bold shadow-sm hover:shadow-md hover:bg-primary/90 transition-all active:scale-95 rounded-none" onClick={handleReplace} disabled={replacing}>
                                                    {replacing && <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" />}
                                                    {t('Manager.Actions.Apply')}
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-[10px]">{t('Manager.Notices.ThemeApplyPrefix')}</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                                {isApplied && (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="outline" size="sm" className="h-7 px-3 text-[10px] font-bold border-border/50 hover:bg-secondary/20 transition-all active:scale-95 rounded-none" onClick={handleRestore} disabled={restoring}>
                                                    {restoring && <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" />}
                                                    {t('Manager.Actions.Restore')}
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-[10px]">{t('Manager.Notices.ThemeRestorePrefix')}</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}

                                {cloudEntries && cloudEntries.length > 0 && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none hover:bg-muted/50 transition-all">
                                                {downloadingCloudId ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <CloudDownload className="w-4 h-4 text-primary/80" />}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56 shadow-2xl backdrop-blur-md bg-background/95 border-border/40">
                                            {cloudEntries.map(entry => {
                                                const isDownloaded = sources.some(s => s.id === entry.id);
                                                const isOutdated = sources.some(s => s.id === entry.id && s.cloud?.hash !== entry.hash);
                                                return (
                                                    <DropdownMenuItem key={entry.id} onClick={() => handleCloudDownload(entry)} className="text-[11px] py-1.5 flex items-center justify-between">
                                                        <div className="flex items-center truncate">
                                                            <Cloud className="w-3.5 h-3.5 mr-2 text-primary/60" />
                                                            <span className="truncate" title={entry.title}>{entry.title} <span className="text-muted-foreground/60">v{entry.version}</span></span>
                                                        </div>
                                                        {(isDownloaded && !isOutdated) ? (
                                                            <Badge variant="outline" className="text-[8px] h-4 px-1 ml-2 bg-green-500/10 text-green-600 border-none shrink-0">已下载</Badge>
                                                        ) : isOutdated ? (
                                                            <Badge variant="outline" className="text-[8px] h-4 px-1 ml-2 bg-amber-500/10 text-amber-600 border-none shrink-0 animate-pulse">有更新</Badge>
                                                        ) : null}
                                                    </DropdownMenuItem>
                                                );
                                            })}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none hover:bg-muted/50 transition-all">
                                            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 shadow-2xl backdrop-blur-md bg-background/95 border-border/40">
                                        {hasTranslation && (
                                            <DropdownMenuItem onClick={() => {
                                                const translationJson: ThemeTranslationV1 = loadTranslationFile(translationPath);
                                                if (translationJson) {
                                                    useGlobalStoreInstance.getState().setEditorTheme(
                                                        translationJson, theme.name, themeDir, translationPath
                                                    );
                                                    i18n.view.activateView(THEME_EDITOR_VIEW_TYPE);
                                                }
                                            }} className="text-[12px] py-2">
                                                <Pen className="w-3.5 h-3.5 mr-2.5 text-primary/70" />
                                                <span>{t('Manager.Actions.Edit')}</span>
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem onClick={handleExtract} disabled={extracting} className="text-[12px] py-2">
                                            <FileOutput className="w-3.5 h-3.5 mr-2.5 text-blue-500/70" />
                                            <span>{t('Manager.Notices.ThemeExtractPrefix')}</span>
                                        </DropdownMenuItem>
                                        {activeSourceId && (
                                            <DropdownMenuItem onClick={() => {
                                                sourceManager?.removeSource(activeSourceId);
                                                refreshParent();
                                            }} className="text-[12px] py-2 text-destructive focus:text-destructive focus:bg-destructive/5">
                                                <XCircle className="w-3.5 h-3.5 mr-2.5 opacity-70" />
                                                <span>{t('Manager.Actions.Delete')}</span>
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator className="bg-border/40" />
                                        <DropdownMenuItem onClick={() => i18nOpen(i18n, themeDir)} className="text-[12px] py-2">
                                            <FolderOpen className="w-3.5 h-3.5 mr-2.5 text-amber-500/70" />
                                            <span>{t('Manager.Actions.OpenFolder')}</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="group relative border rounded-none bg-card/75 text-card-foreground shadow-xs hover:shadow-md hover:bg-muted/20 transition-all duration-300 px-4 py-1.5 w-full border-border/50 overflow-hidden backdrop-blur-md">
            {/* Side Status Accent */}
            <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] transition-colors duration-300 z-10 bg-opacity-100", statusColor)} />

            <div className="flex items-center gap-5 overflow-hidden min-w-0 relative z-0">
                <div className={cn("px-2.5 py-0.5 text-[9px] uppercase tracking-[0.1em] font-extrabold rounded-none bg-background border border-border shadow-xs flex items-center gap-1.5", statusColor.replace(/bg-/g, 'text-'))}>
                    <span className={cn("w-1.5 h-1.5 rounded-full shadow-sm", statusColor)}></span>
                    {statusText}
                </div>

                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="font-bold truncate text-[13.5px] text-foreground/90 group-hover:text-primary transition-colors duration-300 shrink-0 max-w-[40%]">{theme.name}</span>
                    <span className="text-[10px] text-muted-foreground/50 shrink-0 font-bold bg-muted/20 px-1.5 py-0.5 rounded-none">
                        {theme.manifest ? `v${theme.manifest.version}` : 'v0.0.0'}
                    </span>
                    {theme.isActive && (
                        <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[8px] font-extrabold uppercase tracking-tighter rounded-none bg-primary/10 text-primary border-none shadow-xs shrink-0">
                            {t('Manager.Labels.ThemeActive')}
                        </Badge>
                    )}
                    {translationVersion && (
                        <span className="text-[10px] text-primary/80 font-bold bg-primary/5 border border-primary/10 px-1.5 py-0.5 rounded-none shrink-0">
                            v{translationVersion}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2.5 ml-auto shrink-0 pl-2">
                    {sources.length > 0 && (
                        <Select
                            value={activeSourceId ?? undefined}
                            onValueChange={(val) => {
                                sourceManager?.setActive(val, true);
                                refreshParent();
                            }}
                        >
                            <SelectTrigger className="w-[125px] h-8 text-[11px] bg-muted/40 border-none shadow-none hover:bg-muted/60 transition-all rounded-none" size="sm">
                                <SelectValue placeholder={t('Manager.Filters.All')} />
                            </SelectTrigger>
                            <SelectContent className="backdrop-blur-md bg-background/95 border-border/40">
                                {sources.map(source => (
                                    <SelectItem key={source.id} value={source.id} className="text-[11px]">
                                        {source.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    <div className="flex items-center gap-1.5">
                        {hasTranslation && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-primary/10 hover:text-primary transition-all" onClick={() => {
                                            const translationJson: ThemeTranslationV1 = loadTranslationFile(translationPath);
                                            if (translationJson) {
                                                useGlobalStoreInstance.getState().setEditorTheme(
                                                    translationJson, theme.name, themeDir, translationPath
                                                );
                                                i18n.view.activateView(THEME_EDITOR_VIEW_TYPE);
                                            }
                                        }}>
                                            <Pen className="w-3.5 h-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-[10px]">{t('Manager.Actions.Edit')}</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}

                        {hasTranslation && !isApplied && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="default" size="sm" className="h-8 px-4 text-[11px] font-bold shadow-sm hover:shadow-md hover:translate-y-[-1px] active:scale-95 transition-all rounded-none" onClick={handleReplace} disabled={replacing}>
                                            {replacing && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />}
                                            {t('Manager.Actions.Apply')}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-[10px]">{t('Manager.Notices.ThemeApplyPrefix')}</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}

                        {isApplied && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8 px-4 text-[11px] font-bold border-border/50 hover:bg-secondary/20 transition-all active:scale-95 rounded-none" onClick={handleRestore} disabled={restoring}>
                                            {restoring && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />}
                                            {t('Manager.Actions.Restore')}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-[10px]">{t('Manager.Notices.ThemeRestorePrefix')}</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}

                        {cloudEntries && cloudEntries.length > 0 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-primary/10 hover:text-primary transition-all">
                                        {downloadingCloudId ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 shadow-2xl backdrop-blur-md bg-background/95 border-border/40">
                                    {cloudEntries.map(entry => {
                                        const isDownloaded = sources.some(s => s.id === entry.id);
                                        const isOutdated = sources.some(s => s.id === entry.id && s.cloud?.hash !== entry.hash);
                                        return (
                                            <DropdownMenuItem key={entry.id} onClick={() => handleCloudDownload(entry)} className="text-[12px] py-2 flex items-center justify-between">
                                                <div className="flex items-center truncate">
                                                    <Cloud className="w-4 h-4 mr-2.5 text-primary/60" />
                                                    <span className="truncate" title={entry.title}>{entry.title} <span className="text-muted-foreground/50 ml-1">v{entry.version}</span></span>
                                                </div>
                                                {(isDownloaded && !isOutdated) ? (
                                                    <Badge variant="outline" className="text-[9px] h-5 px-1.5 ml-2 bg-green-500/10 text-green-600 border-none shrink-0">已下载</Badge>
                                                ) : isOutdated ? (
                                                    <Badge variant="outline" className="text-[9px] h-5 px-1.5 ml-2 bg-amber-500/10 text-amber-600 border-none shrink-0 animate-pulse">有更新</Badge>
                                                ) : null}
                                            </DropdownMenuItem>
                                        );
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-muted/50 transition-all">
                                    <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 shadow-2xl backdrop-blur-md bg-background/95 border-border/40">
                                <DropdownMenuItem onClick={handleExtract} disabled={extracting} className="text-[12px] py-2">
                                    <FileOutput className="w-3.5 h-3.5 mr-2.5 text-blue-500/70" />
                                    <span>{t('Manager.Notices.ThemeExtractPrefix')}</span>
                                </DropdownMenuItem>
                                {activeSourceId && (
                                    <DropdownMenuItem onClick={() => {
                                        sourceManager?.removeSource(activeSourceId);
                                        refreshParent();
                                    }} className="text-[12px] py-2 text-destructive focus:text-destructive focus:bg-destructive/5">
                                        <XCircle className="w-3.5 h-3.5 mr-2.5 opacity-70" />
                                        <span>{t('Manager.Actions.Delete')}</span>
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator className="bg-border/40" />
                                <DropdownMenuItem onClick={() => i18nOpen(i18n, themeDir)} className="text-[12px] py-2">
                                    <FolderOpen className="w-3.5 h-3.5 mr-2.5 text-amber-500/70" />
                                    <span>{t('Manager.Actions.OpenFolder')}</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        {/* Empty Translation Explanation Dialog */}
                        <Dialog open={showEmptyDialog} onOpenChange={setShowEmptyDialog}>
                            <DialogContent className="sm:max-w-[425px] rounded-none border-border/60">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-amber-500">
                                        <span className="text-xl">⚠️</span>
                                        {t('Manager.Dialogs.EmptyTranslationTitle')}
                                    </DialogTitle>
                                    <DialogDescription className="pt-4 leading-relaxed text-foreground/80">
                                        {t('Manager.Dialogs.EmptyTranslationDesc')}
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter className="mt-6 flex justify-center">
                                    <Button
                                        variant="secondary"
                                        onClick={() => setShowEmptyDialog(false)}
                                        className="w-full rounded-none h-10 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                    >
                                        {t('Common.Actions.Confirm')}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </div>
        </div>
    );
});
