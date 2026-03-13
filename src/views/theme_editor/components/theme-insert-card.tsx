import React, { memo, useState, useCallback } from 'react';
import { Input, Button } from '~/shadcn';
import { Plus, Type, AlignLeft } from 'lucide-react';
import { useThemeEditorStore } from '../store';
import { TemplateCard } from '../../plugin_editor/components/common/template-card';
import { useTranslation } from 'react-i18next';

/**
 * 新增翻译条目卡片 - 嵌入右侧操作面板
 */
const ThemeInsertCard: React.FC = memo(() => {
    const { t } = useTranslation();
    const addItem = useThemeEditorStore.use.addItem();
    const [source, setSource] = useState('');
    const [target, setTarget] = useState('');

    const handleAdd = useCallback(() => {
        if (!source.trim()) return;

        const currentItems = useThemeEditorStore.getState().items;
        const nextId = currentItems.length > 0 ? Math.max(...currentItems.map(i => i.id)) + 1 : 0;

        addItem({
            id: nextId,
            source: source.trim(),
            target: target.trim() || source.trim(),
        });

        setSource('');
        setTarget('');
    }, [source, target, addItem]);

    return (
        <TemplateCard title={t('Editor.Titles.Insert')} icon={Plus}>
            <div className="space-y-3.5">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 px-0.5">
                        <Type className="w-3.5 h-3.5" />
                        {t('Editor.Actions.Source')}
                    </label>
                    <Input
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        placeholder={t('Editor.Ast.InputSourcePlaceholder')}
                        className="h-8 text-sm px-2.5"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 px-0.5">
                        <AlignLeft className="w-3.5 h-3.5" />
                        {t('Editor.Actions.Trans')}
                    </label>
                    <Input
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        placeholder={t('Common.Placeholders.Search')}
                        className="h-8 text-sm px-2.5"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAdd();
                        }}
                    />
                </div>
                <Button
                    variant="secondary"
                    onClick={handleAdd}
                    disabled={!source.trim()}
                    className="w-full h-8 gap-1.5 font-medium transition-all"
                >
                    <Plus className="w-3.5 h-3.5" />
                    {t('Editor.Actions.Add')}
                </Button>
            </div>
        </TemplateCard>
    );
});

ThemeInsertCard.displayName = 'ThemeInsertCard';

export { ThemeInsertCard };
