import React, { memo, useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { useThemeEditorStore } from '../store';
import { TemplateCard } from '../../plugin_editor/components/common/template-card';
import { useTranslation } from 'react-i18next';

/**
 * 翻译统计卡片 - 显示翻译进度
 */
const ThemeStatsCard: React.FC = memo(() => {
    const { t } = useTranslation();
    const items = useThemeEditorStore.use.items();

    const stats = useMemo(() => {
        const total = items.length;
        const translated = items.filter(item => item.target && item.target !== item.source).length;
        const untranslated = total - translated;
        const percentage = total > 0 ? Math.round((translated / total) * 100) : 0;
        return { total, translated, untranslated, percentage };
    }, [items]);

    return (
        <TemplateCard title={t('Editor.Stats.Title')} icon={BarChart3}>
            <div className="space-y-3">
                {/* 进度条 */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{t('Editor.Stats.Progress')}</span>
                        <span className="text-xs font-semibold text-primary">{stats.percentage}%</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${stats.percentage}%` }}
                        />
                    </div>
                </div>

                {/* 统计数字 */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-1.5 rounded-md bg-muted/50">
                        <div className="text-lg font-bold text-foreground">{stats.total}</div>
                        <div className="text-[10px] text-muted-foreground">{t('Editor.Stats.TotalItems')}</div>
                    </div>
                    <div className="text-center p-1.5 rounded-md bg-green-500/10">
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">{stats.translated}</div>
                        <div className="text-[10px] text-muted-foreground">{t('Editor.Stats.Translated')}</div>
                    </div>
                    <div className="text-center p-1.5 rounded-md bg-red-500/10">
                        <div className="text-lg font-bold text-red-500 dark:text-red-400">{stats.untranslated}</div>
                        <div className="text-[10px] text-muted-foreground">{t('Editor.Stats.Untranslated')}</div>
                    </div>
                </div>
            </div>
        </TemplateCard>
    );
});

ThemeStatsCard.displayName = 'ThemeStatsCard';

export { ThemeStatsCard };
