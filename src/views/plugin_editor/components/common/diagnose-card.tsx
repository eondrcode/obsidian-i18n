import React, { useState } from 'react';
import { Button, Badge, Separator, Tooltip, TooltipTrigger, TooltipContent } from "~/shadcn";
import { TemplateCard } from './template-card';
import {
    Activity, AlertTriangle, CheckCircle2, ChevronRight,
    Trash2, RotateCcw, ShieldAlert, Search, Eraser, Play,
    CircleDot, ChevronDown, Sparkles, Loader2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from "~/utils";
import { DiagnoseError } from '../../types';

interface DiagnoseCardProps {
    onDiagnose: () => void;
    onUnusedDiagnose?: () => void;
    onSecurityDiagnose?: () => void;
    onDeleteUnused?: () => void;
    onClear?: () => void;
    onRestoreAllErrors?: () => void;
    onAiFixError?: (error: DiagnoseError) => Promise<void>;
    isDiagnosing: boolean;
    isUnusedScan?: boolean;
    isSecurityScan?: boolean;
    errorItems: DiagnoseError[];
    hasChecked?: boolean;
    setActiveTab?: (tab: string) => void;
    onJumpError?: (error: DiagnoseError) => void;
}

type ScanMode = 'syntax' | 'unused' | 'security';

export const DiagnoseCard: React.FC<DiagnoseCardProps> = ({
    onDiagnose,
    onUnusedDiagnose,
    onSecurityDiagnose,
    onDeleteUnused,
    onClear,
    onRestoreAllErrors,
    onAiFixError,
    isDiagnosing,
    isUnusedScan,
    isSecurityScan,
    errorItems,
    hasChecked,
    setActiveTab,
    onJumpError
}) => {
    const { t } = useTranslation();
    const [activeMode, setActiveMode] = useState<ScanMode>('syntax');
    const [fixingIds, setFixingIds] = useState<Set<string>>(new Set());

    const handleJump = (error: DiagnoseError) => {
        if (setActiveTab) {
            setActiveTab(error.type);
        }
        if (onJumpError) {
            onJumpError(error);
        }
        window.dispatchEvent(new CustomEvent('i18n-jump-error', {
            detail: { type: error.type, id: error.id }
        }));
    };

    const securityErrors = errorItems.filter(e => e.severity === 'critical' || e.severity === 'warning');
    const syntaxErrors = errorItems.filter(e => (!e.severity || e.severity === 'error') && !e.isUnused);
    const unusedErrors = errorItems.filter(e => e.isUnused);

    const securityCount = securityErrors.length;
    const errorCount = syntaxErrors.length;
    const unusedCount = unusedErrors.length;
    const totalCount = errorItems.length;

    // 当前正在扫描的类型
    const currentScanType: ScanMode | null = isDiagnosing
        ? (isSecurityScan ? 'security' : isUnusedScan ? 'unused' : 'syntax')
        : null;

    const handleScan = () => {
        switch (activeMode) {
            case 'syntax': onDiagnose(); break;
            case 'unused': onUnusedDiagnose?.(); break;
            case 'security': onSecurityDiagnose?.(); break;
        }
    };

    const scanModes: { key: ScanMode; icon: React.ElementType; label: string; color: string }[] = [
        { key: 'syntax', icon: Activity, label: t('Editor.Actions.Diagnose'), color: 'text-blue-500' },
        { key: 'unused', icon: Search, label: t('Editor.Actions.UnusedDiagnose'), color: 'text-orange-500' },
        { key: 'security', icon: ShieldAlert, label: t('Editor.Actions.SecurityDiagnose'), color: 'text-purple-500' },
    ];

    // 获取当前模式的颜色信息
    const getModeStyles = (mode: ScanMode) => {
        switch (mode) {
            case 'syntax':
                return { accent: 'blue', bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-600 dark:text-blue-400', hoverBg: 'hover:bg-blue-500/20' };
            case 'unused':
                return { accent: 'orange', bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-600 dark:text-orange-400', hoverBg: 'hover:bg-orange-500/20' };
            case 'security':
                return { accent: 'purple', bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-600 dark:text-purple-400', hoverBg: 'hover:bg-purple-500/20' };
        }
    };

    const currentModeStyles = getModeStyles(activeMode);

    // 获取错误项的样式
    const getErrorStyles = (error: DiagnoseError) => {
        const isSecurity = error.severity === 'critical' || error.severity === 'warning';
        if (isSecurity) {
            return {
                bg: 'bg-purple-500/5 hover:bg-purple-500/10',
                border: 'border-purple-500/15 hover:border-purple-500/30',
                text: 'text-purple-600 dark:text-purple-400',
                dot: 'bg-purple-500',
                badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
            };
        }
        if (error.isUnused) {
            return {
                bg: 'bg-orange-500/5 hover:bg-orange-500/10',
                border: 'border-orange-500/15 hover:border-orange-500/30',
                text: 'text-orange-600 dark:text-orange-400',
                dot: 'bg-orange-500',
                badgeBg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
            };
        }
        return {
            bg: 'bg-destructive/5 hover:bg-destructive/10',
            border: 'border-destructive/15 hover:border-destructive/30',
            text: 'text-destructive',
            dot: 'bg-destructive',
            badgeBg: 'bg-destructive/10 text-destructive border-destructive/20',
        };
    };

    // 获取错误项的标签
    const getErrorLabel = (error: DiagnoseError) => {
        const isSecurity = error.severity === 'critical' || error.severity === 'warning';
        if (isSecurity) {
            return error.severity === 'critical' ? t('Editor.Errors.SecurityCritical') : t('Editor.Errors.SecurityWarning');
        }
        return error.type.toUpperCase();
    };

    return (
        <TemplateCard
            title={t('Editor.Actions.Diagnose')}
            icon={Activity}
        >
            <div className="space-y-3">
                {/* ═══════ 扫描模式选择器 ═══════ */}
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/50">
                    {scanModes.map(mode => {
                        const isActive = activeMode === mode.key;
                        const isScanning = currentScanType === mode.key;
                        const ModeIcon = mode.icon;
                        return (
                            <button
                                key={mode.key}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-background shadow-sm text-foreground border border-border/50"
                                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                )}
                                onClick={() => setActiveMode(mode.key)}
                            >
                                <ModeIcon className={cn(
                                    "w-3.5 h-3.5 shrink-0",
                                    isScanning && "animate-spin",
                                    isActive ? mode.color : ""
                                )} />
                                <span className="truncate">{mode.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* ═══════ 操作按钮 ═══════ */}
                <div className="flex gap-2">
                    {/* 主扫描按钮 */}
                    <Button
                        size="sm"
                        className={cn(
                            "flex-1 gap-2 h-8 text-xs font-medium transition-all duration-200",
                            currentModeStyles.bg, currentModeStyles.text, currentModeStyles.hoverBg,
                            "border", currentModeStyles.border,
                            "hover:scale-[1.01] active:scale-95"
                        )}
                        variant="outline"
                        onClick={handleScan}
                        disabled={isDiagnosing}
                    >
                        {isDiagnosing && currentScanType === activeMode ? (
                            <>
                                <Activity className="w-3.5 h-3.5 animate-spin" />
                                {t('Editor.Status.Diagnosing')}
                            </>
                        ) : (
                            <>
                                <Play className="w-3.5 h-3.5" />
                                {t('Editor.Actions.StartScan')}
                            </>
                        )}
                    </Button>

                    {/* 次要操作 */}
                    <div className="flex gap-1">
                        {activeMode === 'unused' ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 shrink-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-500/10"
                                        onClick={onDeleteUnused}
                                        disabled={isDiagnosing || errorItems.length === 0}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    {t('Common.Actions.Delete')}
                                </TooltipContent>
                            </Tooltip>
                        ) : (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 shrink-0"
                                        onClick={onRestoreAllErrors}
                                        disabled={isDiagnosing || errorItems.length === 0 || isSecurityScan}
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    {t('Editor.Actions.RestoreAllErrors')}
                                </TooltipContent>
                            </Tooltip>
                        )}

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    onClick={onClear}
                                    disabled={isDiagnosing || (!hasChecked && errorItems.length === 0)}
                                >
                                    <Eraser className="w-3.5 h-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                {t('Editor.Actions.ClearDiagnose')}
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </div>

                {/* ═══════ 统计概览 ═══════ */}
                {errorItems.length > 0 && (
                    <>
                        <Separator />
                        <div className="flex items-center gap-2">
                            {securityCount > 0 && (
                                <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[10px] px-1.5 py-0 h-5 gap-1">
                                    <ShieldAlert className="w-3 h-3" />
                                    {securityCount}
                                </Badge>
                            )}
                            {errorCount > 0 && (
                                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] px-1.5 py-0 h-5 gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    {errorCount}
                                </Badge>
                            )}
                            {unusedCount > 0 && (
                                <Badge variant="outline" className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 text-[10px] px-1.5 py-0 h-5 gap-1">
                                    <Search className="w-3 h-3" />
                                    {unusedCount}
                                </Badge>
                            )}
                            <span className="ml-auto text-[10px] text-muted-foreground font-medium">
                                {t('Editor.Errors.TotalCount', { count: totalCount })}
                            </span>
                        </div>
                    </>
                )}

                {/* ═══════ 错误列表 ═══════ */}
                {errorItems.length > 0 && (
                    <div className="max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                        <div className="space-y-1.5">
                            {errorItems.map((error, index) => {
                                const styles = getErrorStyles(error);
                                const label = getErrorLabel(error);

                                return (
                                    <div
                                        key={index}
                                        className={cn(
                                            "group flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all duration-200",
                                            styles.bg, styles.border
                                        )}
                                        onClick={() => handleJump(error)}
                                        title={t('Editor.Labels.ClickToJump')}
                                    >
                                        {/* 左侧状态指示器 */}
                                        <div className="flex flex-col items-center gap-1 pt-0.5">
                                            <CircleDot className={cn("w-3.5 h-3.5 shrink-0", styles.text)} />
                                        </div>

                                        {/* 内容区 */}
                                        <div className="flex-1 min-w-0 space-y-0.5">
                                            <div className="flex items-center gap-1.5">
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "h-4 px-1 text-[8px] uppercase font-bold shrink-0",
                                                        styles.badgeBg
                                                    )}
                                                >
                                                    {label}
                                                </Badge>
                                                <span className={cn(
                                                    "text-[9px] font-mono opacity-50",
                                                    styles.text
                                                )}>
                                                    #{index + 1}
                                                </span>
                                            </div>
                                            <p className={cn(
                                                "text-[11px] font-medium break-all line-clamp-2 leading-relaxed",
                                                styles.text
                                            )}>
                                                {error.isUnused && <span className="opacity-60">[{t('Editor.Errors.Unused')}] </span>}
                                                {error.message && <span className="opacity-80">{error.message}: </span>}
                                                <span className="font-mono">"{error.source}"</span>
                                            </p>
                                        </div>

                                        {/* 右侧操作按钮 */}
                                        <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                                            {/* AI 修复按钮 (仅语法错误模式下可用) */}
                                            {onAiFixError && !error.isUnused && error.severity !== 'critical' && error.severity !== 'warning' && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            className={cn(
                                                                "p-1 rounded-md transition-all duration-200",
                                                                "hover:bg-primary/10 text-primary",
                                                                fixingIds.has(`${error.type}-${error.id}`) && "pointer-events-none"
                                                            )}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const fixKey = `${error.type}-${error.id}`;
                                                                setFixingIds(prev => new Set(prev).add(fixKey));
                                                                onAiFixError(error).finally(() => {
                                                                    setFixingIds(prev => {
                                                                        const next = new Set(prev);
                                                                        next.delete(fixKey);
                                                                        return next;
                                                                    });
                                                                });
                                                            }}
                                                        >
                                                            {fixingIds.has(`${error.type}-${error.id}`) ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            ) : (
                                                                <Sparkles className="w-3.5 h-3.5" />
                                                            )}
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="left" className="text-xs">
                                                        {t('Editor.Actions.AiFixTip')}
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}

                                            <ChevronRight className={cn(
                                                "w-3.5 h-3.5 shrink-0 transition-all duration-200",
                                                "opacity-0 -translate-x-1 group-hover:opacity-70 group-hover:translate-x-0",
                                                styles.text
                                            )} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ═══════ 通过状态 ═══════ */}
                {hasChecked && errorItems.length === 0 && !isDiagnosing && (
                    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-green-500/10 border border-green-500/20 transition-all duration-300 animate-in fade-in-50 slide-in-from-top-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                        <span className="text-[11px] font-medium text-green-700 dark:text-green-300">
                            {t('Editor.Notices.DiagnosisSuccess')}
                        </span>
                    </div>
                )}
            </div>
        </TemplateCard>
    );
};
