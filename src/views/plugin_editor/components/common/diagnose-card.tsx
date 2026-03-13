import React from 'react';
import { Button, Badge } from "~/shadcn";
import { TemplateCard } from './template-card';
import { Activity, AlertTriangle, CheckCircle2, ChevronRight, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from "~/utils";
import { useRegexStore } from '../../store';
import { DiagnoseError } from '../../types';

interface DiagnoseCardProps {
    onDiagnose: () => void;
    onClear?: () => void;
    isDiagnosing: boolean;
    errorItems: DiagnoseError[];
    hasChecked?: boolean;
    setActiveTab?: (tab: string) => void;
}

export const DiagnoseCard: React.FC<DiagnoseCardProps> = ({
    onDiagnose,
    onClear,
    isDiagnosing,
    errorItems,
    hasChecked,
    setActiveTab
}) => {
    const { t } = useTranslation();

    const containerRef = React.useRef<HTMLDivElement>(null);
    const handleJump = (error: DiagnoseError) => {
        if (setActiveTab) {
            setActiveTab(error.type);
        }

        // 延迟执行以等待 Tab 切换渲染完成
        setTimeout(() => {
            const root = containerRef.current?.getRootNode() as ShadowRoot | Document;
            const element = root?.getElementById(`${error.type}-row-${error.id}`);

            if (element) {
                element.scrollIntoView({ behavior: 'auto', block: 'center' });
                element.classList.add('bg-yellow-100', 'dark:bg-yellow-900/30');
                setTimeout(() => {
                    element.classList.remove('bg-yellow-100', 'dark:bg-yellow-900/30');
                }, 2000);
            }
        }, 100);
    };

    return (
        <TemplateCard
            title={t('Editor.Actions.Diagnose')}
            icon={Activity}
        >
            <div className="space-y-3" ref={containerRef}>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-2 h-8"
                        onClick={onDiagnose}
                        disabled={isDiagnosing}
                    >
                        <Activity className={cn("w-3.5 h-3.5", isDiagnosing && "animate-spin text-blue-500")} />
                        {isDiagnosing ? t('Editor.Status.Diagnosing') : t('Editor.Actions.Diagnose')}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={onClear}
                        disabled={isDiagnosing || (!hasChecked && errorItems.length === 0)}
                        title={t('Common.Actions.Clear')}
                    >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive transition-colors" />
                    </Button>
                </div>

                {errorItems.length > 0 && (
                    <div className="space-y-2 mt-4">
                        <div className="flex items-center gap-2 text-[11px] font-medium text-destructive">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {t('Editor.Errors.SyntaxErrorTotal', { count: errorItems.length })}
                        </div>
                        <div className="max-h-[200px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                            {errorItems.map((error, index) => (
                                <div
                                    key={index}
                                    className="group flex flex-col p-2 rounded border bg-destructive/5 hover:bg-destructive/10 border-destructive/20 cursor-pointer transition-colors"
                                    onClick={() => handleJump(error)}
                                    title={t('Editor.Labels.ClickToJump')}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-destructive/70 font-mono uppercase tracking-wider">#{index + 1}</span>
                                            <Badge variant="outline" className="h-4 px-1 text-[8px] uppercase font-bold border-destructive/30 text-destructive/60">
                                                {error.type}
                                            </Badge>
                                        </div>
                                        <ChevronRight className="w-3 h-3 text-destructive/40 group-hover:text-destructive transition-colors" />
                                    </div>
                                    <div className="mt-1 text-[11px] font-medium text-destructive break-all line-clamp-2 font-mono">
                                        "{error.source}"
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {hasChecked && errorItems.length === 0 && !isDiagnosing && (
                    <div className="p-2 rounded bg-green-500/10 border border-green-500/20 text-[11px] text-green-600 flex gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{t('Editor.Notices.DiagnosisSuccess')}</span>
                    </div>
                )}
            </div>
        </TemplateCard>
    );
};
