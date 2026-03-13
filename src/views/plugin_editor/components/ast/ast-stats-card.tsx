import React, { memo, useMemo } from 'react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '~/shadcn';
import { AstItem } from '../../types';
import { ChartPie } from 'lucide-react';
import { TemplateCard } from '../common/template-card';
import { useTranslation } from 'react-i18next';

interface Props {
    items: AstItem[];
}

interface ProgressBarProps {
    progress: number;
}

interface StatBoxProps {
    label: string;
    value: number;
    bgClass: string;
    textClass: string;
    dotClass: string;
    labelTextClass: string;
}

// 统计框组件
const StatBox: React.FC<StatBoxProps> = memo(({ label, value, bgClass, textClass, dotClass, labelTextClass }) => (
    <div className={`rounded-lg p-2.5 transition-all duration-300 group ${bgClass}`}>
        <div className={`text-xs mb-0.75 flex items-center ${labelTextClass}`}>
            <span className={`mr-1.5 inline-block w-1.5 h-1.5 rounded-full ${dotClass}`}></span>
            {label}
        </div>
        <div className={`text-xl font-bold transition-transform duration-300 group-hover:translate-x-1 ${textClass}`}>
            {value}
        </div>
    </div>
), (prevProps, nextProps) => {
    return prevProps.value === nextProps.value && prevProps.label === nextProps.label && prevProps.bgClass === nextProps.bgClass && prevProps.textClass === nextProps.textClass && prevProps.dotClass === nextProps.dotClass && prevProps.labelTextClass === nextProps.labelTextClass;
});

// 进度条组件
const ProgressBar: React.FC<ProgressBarProps> = memo(({ progress }) => {
    const { t } = useTranslation();
    const progressBarStyle = useMemo(() => ({ width: `${progress}%` }), [progress]);
    const shineAnimationDuration = useMemo(() => 2000 / (progress || 1), [progress]);
    const shineStyle = useMemo(() => ({ animation: `shine ${shineAnimationDuration}ms infinite` }), [shineAnimationDuration]);

    return (
        <div className="px-3 pb-3">
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{t('Editor.Stats.Progress')}</span>
                <span className="text-xs font-medium text-muted-foreground">{progress}%</span>
            </div>
            <div className="relative h-2.5 w-full rounded-full bg-muted overflow-hidden shadow-inner [&:before]:absolute [&:before]:inset-0 [&:before]:bg-gradient-to-r [&:before]:from-white/50 [&:before]:to-transparent [&:before]:content-['']">
                <div className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary/50 transition-all duration-800 ease-out relative overflow-hidden" style={progressBarStyle} >
                    <div className="absolute top-0 right-0 h-full w-16 bg-white/20 transform -skew-x-12 translate-x-full transition-transform duration-1500 ease-in-out" style={shineStyle}  ></div>
                </div>
            </div>
        </div>
    );
}, (prevProps, nextProps) => prevProps.progress === nextProps.progress);

/** 
 * 翻译统计卡片组件
 * 根据传入的items数组自动计算统计数据
 */
const AstStatsCard: React.FC<Props> = memo(({ items }) => {
    const { t } = useTranslation();
    const stats = useMemo(() => {
        const totalCount = items.length;
        if (totalCount === 0) return { totalCount: 0, translatedCount: 0, untranslatedCount: 0, progress: 0 };

        let translatedCount = 0;
        for (let i = 0; i < totalCount; i++) {
            const item = items[i];
            const hasTarget = !!item.target && item.target.trim() !== '';
            const isTranslated = hasTarget && item.target !== item.source;
            if (isTranslated) translatedCount++;
        }

        const untranslatedCount = totalCount - translatedCount;
        const progress = Math.round((translatedCount / totalCount) * 100);
        return { totalCount, translatedCount, untranslatedCount, progress };
    }, [items]);

    const { totalCount, translatedCount, untranslatedCount, progress } = stats;

    return (
        <TemplateCard
            title={t('Editor.Stats.Overview')}
            icon={ChartPie}
            extra={
                <Badge variant="secondary" className="text-xs font-medium px-2.5 py-0.5 bg-muted text-muted-foreground border transition-all duration-300">
                    {progress}% {t('Manager.Filters.Applied')}
                </Badge>
            }
        >
            <div className="grid grid-cols-2 gap-2.5">
                <div className="col-span-2">
                    <StatBox label={t('Editor.Stats.TotalItems')} value={totalCount} bgClass="bg-muted/50 hover:bg-muted/80 transition-colors" textClass="text-foreground" dotClass="bg-blue-500" labelTextClass="text-muted-foreground" />
                </div>
                <StatBox label={t('Editor.Stats.Translated')} value={translatedCount} bgClass="bg-muted/50 hover:bg-muted/80 transition-colors" textClass="text-foreground" dotClass="bg-emerald-500" labelTextClass="text-muted-foreground" />
                <StatBox label={t('Editor.Stats.Untranslated')} value={untranslatedCount} bgClass="bg-muted/50 hover:bg-muted/80 transition-colors" textClass="text-foreground" dotClass="bg-amber-500" labelTextClass="text-muted-foreground" />
            </div>

            <div className="mt-3">
                <ProgressBar progress={progress} />
            </div>
        </TemplateCard>
    );
});

AstStatsCard.displayName = 'AstStatsCard';
StatBox.displayName = 'StatBox';
ProgressBar.displayName = 'ProgressBar';

export { AstStatsCard };