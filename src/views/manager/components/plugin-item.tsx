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

    const {
        statusColor, statusText, statusDesc, isLangDoc, langDoc, pluginDir,
        sources, activeSourceId, translationFormatMark, mainDoc, manifestDoc, isApplied
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
            <div className="flex flex-col h-[200px] border rounded-lg bg-card text-card-foreground shadow-sm hover:bg-muted/50 transition-colors p-3 relative group">
                <div className="flex justify-between items-start mb-1 gap-1">
                    <div className="flex flex-col overflow-hidden mr-1 min-w-0">
                        <span className="font-medium truncate text-sm" title={plugin.name}>{plugin.name}</span>
                        <span className="text-xs text-muted-foreground">v{plugin.version}</span>
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
                <div className="flex-1 text-[9px] text-muted-foreground/80 line-clamp-5 overflow-hidden text-ellipsis leading-relaxed break-all" title={plugin.description}>
                    {plugin.description || t('Common.Status.Unknown')}
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
                                    <SelectValue placeholder={t('Manager.Actions.SelectSource')} />
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
                            {isLangDoc && !isApplied && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="default" size="sm" className="h-8 px-3 gap-1" onClick={handleReplace} disabled={replacing}>
                                                {replacing && <Loader2 className="w-3 h-3 animate-spin" />}
                                                {t('Manager.Actions.Apply')}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{t('Manager.Actions.Apply')}</TooltipContent>
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
                                        <TooltipContent>{t('Manager.Actions.Restore')}</TooltipContent>
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
                                    {translationFormatMark && isLangDoc && (
                                        <DropdownMenuItem onClick={() => {
                                            const pluginTranslationV1 = loadTranslationFile(langDoc);
                                            useGlobalStoreInstance.getState().setEditorPluginTranslation(pluginTranslationV1);
                                            useGlobalStoreInstance.getState().setEditorPluginTranslationPath(langDoc);
                                            i18n.view.activateView(EDITOR_VIEW_TYPE);
                                        }}>
                                            <Pen className="w-4 h-4 mr-2" />
                                            <span>{t('Manager.Actions.Edit')}</span>
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={handleExtract} disabled={extracting}>
                                        <FileOutput className="w-4 h-4 mr-2" />
                                        <span>{t('Manager.Actions.Extract')}</span>
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
                                    {isEnabled && (
                                        <DropdownMenuItem onClick={() => {
                                            // @ts-ignore
                                            i18n.app.setting.open();
                                            // @ts-ignore
                                            i18n.app.setting.openTabById(plugin.id);
                                        }}>
                                            <Settings className="w-4 h-4 mr-2" />
                                            <span>{t('Manager.Actions.OpenSettings')}</span>
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => i18nOpen(i18n, pluginDir)}>
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
                <div className="flex flex-col min-w-0 overflow-hidden">
                    <div className="flex items-baseline gap-2 min-w-0">
                        <span className="font-medium truncate text-sm">{plugin.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0 opacity-80">v{plugin.version}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate" title={plugin.description}>
                        {plugin.description}
                    </div>
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
                                <SelectValue placeholder={t('Manager.Actions.SelectSource')} />
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

                {translationFormatMark && isLangDoc && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => {
                                    const pluginTranslationV1 = loadTranslationFile(langDoc);
                                    useGlobalStoreInstance.getState().setEditorPluginTranslation(pluginTranslationV1);
                                    useGlobalStoreInstance.getState().setEditorPluginTranslationPath(langDoc);
                                    i18n.view.activateView(EDITOR_VIEW_TYPE);
                                }}>
                                    <Pen className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('Manager.Actions.Edit')}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {isLangDoc && !isApplied && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="default" size="sm" className="h-8 px-3 gap-1" onClick={handleReplace} disabled={replacing}>
                                    {replacing && <Loader2 className="w-3 h-3 animate-spin" />}
                                    {t('Manager.Actions.Apply')}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('Manager.Actions.Apply')}</TooltipContent>
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
                            <TooltipContent>{t('Manager.Actions.Restore')}</TooltipContent>
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
                            <span>{t('Manager.Actions.Extract')}</span>
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
                        {isEnabled && (
                            <DropdownMenuItem onClick={() => {
                                // @ts-ignore
                                i18n.app.setting.open();
                                // @ts-ignore
                                i18n.app.setting.openTabById(plugin.id);
                            }}>
                                <Settings className="w-4 h-4 mr-2" />
                                <span>{t('Manager.Actions.OpenSettings')}</span>
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => i18nOpen(i18n, pluginDir)}>
                            <FolderOpen className="w-4 h-4 mr-2" />
                            <span>{t('Manager.Actions.OpenFolder')}</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
});
