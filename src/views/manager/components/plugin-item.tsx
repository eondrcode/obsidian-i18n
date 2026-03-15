import React, { useState, useMemo } from 'react';
import { PluginManifest, Notice } from 'obsidian';
import * as path from 'path';
import * as fs from 'fs-extra';
import { useTranslation } from 'react-i18next';
import { Settings, FolderOpen, Pen, FileOutput, XCircle, Loader2, MoreHorizontal } from 'lucide-react';
import I18N from 'src/main';
import { PluginTranslationV1 } from 'src/types';
import { i18nOpen, AstTranslator, RegexTranslator, isValidPluginTranslationV1Format } from '../../../utils';
import { loadTranslationFile } from '../../../manager/io-manager';
import { useGlobalStoreInstance } from '~/utils';
import { EDITOR_VIEW_TYPE } from '../../../views';
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

export interface PluginItemData {
    statusColor: string;
    statusText: string;
    statusDesc: string;
    isLangDoc: boolean;
    langDoc: string;
    pluginDir: string;
    sources: any[];
    activeSourceId: string | null;
    translationFormatMark: boolean;
    mainDoc: string;
    manifestDoc: string;
    isApplied: boolean;
    isTranslated: boolean;
    translationVersion?: string;
    supportedVersion?: string;
}

interface PluginItemProps {
    plugin: PluginManifest;
    i18n: I18N;
    settings: any;
    isEnabled: boolean;
    data: PluginItemData;
    refreshParent: () => void;
    reloadPlugin: (id: string) => Promise<boolean>;
    close: () => void;
    viewMode: 'list' | 'grid';
}

export const PluginItem: React.FC<PluginItemProps> = React.memo(({ plugin, i18n, settings, isEnabled, data, reloadPlugin, refreshParent, close, viewMode }) => {
    const { t } = useTranslation();
    const [extracting, setExtracting] = useState(false);
    const [replacing, setReplacing] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [showEmptyDialog, setShowEmptyDialog] = useState(false);

    const {
        statusColor, statusText, statusDesc, isLangDoc, langDoc, pluginDir,
        sources, activeSourceId, translationFormatMark, mainDoc, manifestDoc, isApplied,
        isTranslated, translationVersion, supportedVersion
    } = data;

    const sourceManager = i18n.sourceManager;

    const handleExtract = async () => {
        setExtracting(true);
        try {
            if (!await fs.pathExists(mainDoc)) {
                i18n.notice.error(t('Manager.Errors.MainNotFound'));
                return;
            }
            const mainBuffer = await fs.readFile(mainDoc);
            const mainStr = mainBuffer.toString();
            const manifestJSON = await fs.readJson(manifestDoc);

            // 延时一下避免 UI 冻结感
            await new Promise(resolve => setTimeout(resolve, 0));
            const { generatePlugin } = await import('../../../utils');
            const translationJson = generatePlugin(plugin.version, manifestJSON, mainStr, settings.language, i18n.settings);

            if (sourceManager) {
                await sourceManager.extractAndSaveSource(plugin.id, translationJson, { title: plugin.name });
                i18n.notice.successPrefix(t('Manager.Notices.ExtractSuccess'), t('Manager.Hints.ExtractSuccessDesc'));
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
            const translationJson: PluginTranslationV1 = loadTranslationFile(langDoc);
            if (translationJson.dict) {
                const files = Object.keys(translationJson.dict);
                await i18n.backupManager.createBackup(plugin.id, pluginDir, files);

                for (const [file, dict] of Object.entries(translationJson.dict as Record<string, any>)) {
                    const targetFilePath = path.join(pluginDir, file);
                    if (!fs.existsSync(targetFilePath)) continue;

                    let fileString = fs.readFileSync(targetFilePath).toString();

                    if (dict.ast && dict.ast.length > 0) {
                        const astTranslator = new AstTranslator(i18n.settings);
                        const ast = astTranslator.loadCode(fileString);
                        if (ast) {
                            fileString = astTranslator.translate(ast, dict.ast);
                        }
                    }

                    if (dict.regex && dict.regex.length > 0) {
                        const regexTranslator = new RegexTranslator(i18n.settings);
                        fileString = regexTranslator.translate(fileString, dict.regex);
                    }

                    if (targetFilePath.endsWith('.js')) {
                        const checkTranslator = new AstTranslator(i18n.settings);
                        if (!checkTranslator.loadCode(fileString)) {
                            throw new Error(t('Manager.Errors.SyntaxError', { file }));
                        }
                    }

                    fs.writeFileSync(targetFilePath, fileString);
                }
            }
            i18n.stateManager.setPluginState(plugin.id, {
                id: plugin.id,
                isApplied: true,
                pluginVersion: plugin.version,
                translationVersion: translationJson.metadata.version
            });
            if (isEnabled) {
                const reloadRes = await reloadPlugin(plugin.id);
                // @ts-ignore
                if (reloadRes && !i18n.app.plugins.enabledPlugins.has(plugin.id)) {
                    i18n.notice.error(t('Manager.Errors.LoadFailedAfterApply'));
                }
            }
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
            const restored = await i18n.backupManager.restoreBackup(plugin.id, pluginDir);
            if (restored) {
                i18n.stateManager.deletePluginState(plugin.id);
                if (isEnabled) await reloadPlugin(plugin.id);
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
                {/* Side Status Accent */}
                <div className={cn("absolute left-0 top-0 bottom-0 w-[4px] transition-colors duration-300 z-10 bg-opacity-100", statusColor)} />

                <div className="p-4 flex flex-col h-full relative z-0">
                    <div className="flex justify-between items-start mb-3 gap-2">
                        <div className="flex flex-col overflow-hidden min-w-0">
                            <span className="font-bold truncate text-[14px] leading-tight text-foreground/90 group-hover:text-primary transition-colors duration-300" title={plugin.name}>{plugin.name}</span>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-muted-foreground/60 font-semibold tracking-tight bg-muted/30 px-1.5 py-0.5 rounded-none">v{plugin.version}</span>
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
                        className="flex-1 text-[11px] text-muted-foreground overflow-hidden leading-relaxed break-words font-medium relative"
                        title={plugin.description}
                        style={{
                            WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
                            maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)'
                        }}
                    >
                        {plugin.description || t('Common.Status.Unknown')}
                    </div>
                    <div className="flex flex-col gap-3 mt-auto pt-3 border-t border-border/30">
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
                                        <SelectValue placeholder={t('Manager.Actions.SelectSource')} />
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
                                {isLangDoc && !isApplied && (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="default" size="sm" className="h-7 px-3 text-[10px] font-bold shadow-sm hover:shadow-md hover:bg-primary/90 transition-all active:scale-95 rounded-none" onClick={handleReplace} disabled={replacing}>
                                                    {replacing && <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" />}
                                                    {t('Manager.Actions.Apply')}
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-[10px]">{t('Manager.Actions.Apply')}</TooltipContent>
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
                                            <TooltipContent side="top" className="text-[10px]">{t('Manager.Actions.Restore')}</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none hover:bg-muted/50 transition-all">
                                            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 shadow-2xl backdrop-blur-md bg-background/95 border-border/40">
                                        {translationFormatMark && isLangDoc && (
                                            <DropdownMenuItem onClick={() => {
                                                const pluginTranslationV1 = loadTranslationFile(langDoc);
                                                useGlobalStoreInstance.getState().setEditorPluginTranslation(pluginTranslationV1);
                                                useGlobalStoreInstance.getState().setEditorPluginTranslationPath(langDoc);
                                                i18n.view.activateView(EDITOR_VIEW_TYPE);
                                            }} className="text-[12px] py-2">
                                                <Pen className="w-3.5 h-3.5 mr-2.5 text-primary/70" />
                                                <span>{t('Manager.Actions.Edit')}</span>
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem onClick={handleExtract} disabled={extracting} className="text-[12px] py-2">
                                            <FileOutput className="w-3.5 h-3.5 mr-2.5 text-blue-500/70" />
                                            <span>{t('Manager.Actions.Extract')}</span>
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
                                        {isEnabled && (
                                            <DropdownMenuItem onClick={() => {
                                                // @ts-ignore
                                                i18n.app.setting.open();
                                                // @ts-ignore
                                                i18n.app.setting.openTabById(plugin.id);
                                            }} className="text-[12px] py-2">
                                                <Settings className="w-3.5 h-3.5 mr-2.5 text-orange-500/70" />
                                                <span>{t('Manager.Actions.OpenSettings')}</span>
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem onClick={() => i18nOpen(i18n, pluginDir)} className="text-[12px] py-2">
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
            {/* Side Status Accent */}
            <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] transition-colors duration-300 z-10 bg-opacity-100", statusColor)} />

            <div className="flex items-center gap-5 overflow-hidden min-w-0 relative z-0">
                <div className={cn("px-2.5 py-0.5 text-[9px] uppercase tracking-[0.1em] font-extrabold rounded-none bg-background border border-border shadow-xs flex items-center gap-1.5", statusColor.replace(/bg-/g, 'text-'))}>
                    <span className={cn("w-1.5 h-1.5 rounded-full shadow-sm", statusColor)}></span>
                    {statusText}
                </div>

                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="font-bold truncate text-[13.5px] text-foreground/90 group-hover:text-primary transition-colors duration-300 shrink-0 max-w-[40%]">{plugin.name}</span>
                    <span className="text-[10px] text-muted-foreground/50 shrink-0 font-bold bg-muted/20 px-1.5 py-0.5 rounded-none">v{plugin.version}</span>
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
                                <SelectValue placeholder={t('Manager.Actions.SelectSource')} />
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
                        {translationFormatMark && isLangDoc && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-primary/10 hover:text-primary transition-all" onClick={() => {
                                            const pluginTranslationV1 = loadTranslationFile(langDoc);
                                            useGlobalStoreInstance.getState().setEditorPluginTranslation(pluginTranslationV1);
                                            useGlobalStoreInstance.getState().setEditorPluginTranslationPath(langDoc);
                                            i18n.view.activateView(EDITOR_VIEW_TYPE);
                                        }}>
                                            <Pen className="w-3.5 h-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-[10px]">{t('Manager.Actions.Edit')}</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}

                        {isLangDoc && !isApplied && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="default" size="sm" className="h-8 px-4 text-[11px] font-bold shadow-sm hover:shadow-md hover:translate-y-[-1px] active:scale-95 transition-all rounded-none" onClick={handleReplace} disabled={replacing}>
                                            {replacing && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />}
                                            {t('Manager.Actions.Apply')}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-[10px]">{t('Manager.Actions.Apply')}</TooltipContent>
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
                                    <TooltipContent className="text-[10px]">{t('Manager.Actions.Restore')}</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
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
                                    <span>{t('Manager.Actions.Extract')}</span>
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
                                {isEnabled && (
                                    <DropdownMenuItem onClick={() => {
                                        // @ts-ignore
                                        i18n.app.setting.open();
                                        // @ts-ignore
                                        i18n.app.setting.openTabById(plugin.id);
                                    }} className="text-[12px] py-2">
                                        <Settings className="w-3.5 h-3.5 mr-2.5 text-orange-500/70" />
                                        <span>{t('Manager.Actions.OpenSettings')}</span>
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => i18nOpen(i18n, pluginDir)} className="text-[12px] py-2">
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
