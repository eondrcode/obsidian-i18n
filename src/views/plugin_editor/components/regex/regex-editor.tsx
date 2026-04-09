import React, { useMemo, useCallback, useDeferredValue } from 'react';
import { Search } from 'lucide-react';
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/shadcn';
import { useTranslation } from 'react-i18next';

import { useRegexStore } from '../../store';
import { RegexTable } from '../..';

interface Props {
    // 不再需要 sidebar 相关 props
}

type FilterType = 'all' | 'translated' | 'untranslated';

const RegexEditor: React.FC<Props> = () => {
    const { t } = useTranslation();
    // 搜索
    const searchQuery = useRegexStore.use.searchQuery();
    const setSearchQuery = useRegexStore.use.setSearchQuery();
    const [filterType, setFilterType] = React.useState<FilterType>('all');

    // 搜索防抖：使用 useDeferredValue 延迟过滤计算
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const deferredFilterType = useDeferredValue(filterType);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    }, []);

    const [editingId, setEditingId] = React.useState<number | null>(null);

    // 获取数据
    const regexItems = useRegexStore.use.regexItems();

    const regexItemsRef = React.useRef(regexItems);
    React.useEffect(() => {
        regexItemsRef.current = regexItems;
    }, [regexItems]);

    // Cleanup when file switches
    const currentFile = useRegexStore.use.currentFile();
    React.useEffect(() => {
        setEditingId(null);
        setFilterType('all');
        setSearchQuery('');
    }, [currentFile, setSearchQuery]);

    React.useEffect(() => {
        const handleJump = (e: CustomEvent<{ type: string, id: number }>) => {
            if (e.detail.type === 'regex') {
                const item = regexItemsRef.current.find(i => i.id === e.detail.id);
                if (item && item.source) {
                    setFilterType('all');
                    setSearchQuery(item.source);
                }
                setEditingId(e.detail.id);
            }
        };
        window.addEventListener('i18n-jump-error', handleJump as EventListener);
        return () => window.removeEventListener('i18n-jump-error', handleJump as EventListener);
    }, [setSearchQuery]);

    // 过滤后的条目（使用 deferred 值）
    const filteredItems = useMemo(() => {
        let items = regexItems;

        // 1. 按状态筛选
        if (deferredFilterType === 'translated') {
            items = items.filter(item => item.target && item.target !== item.source);
        } else if (deferredFilterType === 'untranslated') {
            items = items.filter(item => !item.target || item.target === item.source);
        }

        // 2. 按搜索词筛选
        if (deferredSearchQuery.trim()) {
            const query = deferredSearchQuery.toLowerCase();
            items = items.filter(item =>
                (item.source && item.source.toLowerCase().includes(query)) ||
                (item.target && item.target.toLowerCase().includes(query))
            );
        }
        return items;
    }, [regexItems, deferredSearchQuery, deferredFilterType]);

    // 广播选中项给预览面板
    React.useEffect(() => {
        if (editingId !== null) {
            const item = regexItems.find(i => i.id === editingId);
            if (item) {
                window.dispatchEvent(new CustomEvent('i18n-item-selected', {
                    detail: {
                        source: item.source,
                        type: 'regex' as const,
                    }
                }));
            }
        } else {
            window.dispatchEvent(new CustomEvent('i18n-item-deselected'));
        }
    }, [editingId, regexItems]);

    const handleFilterChange = useCallback((v: string) => {
        setFilterType(v as FilterType);
    }, []);

    return (
        <div className="flex h-full flex-col">
            <div className="flex min-h-0 flex-1 flex-col">
                {/* 搜索框区域 */}
                <div className="mb-2 flex items-center justify-between">
                    {/* 左侧：搜索框和按钮 */}
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input className="h-8 w-64 pl-8" placeholder={t('Common.Placeholders.Search')} value={searchQuery} onChange={handleSearchChange} />
                        </div>
                        <Select value={filterType} onValueChange={handleFilterChange}>
                            <SelectTrigger size="sm" className="w-[100px]">
                                <SelectValue placeholder={t('Common.Labels.Filter')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('Common.Filters.All')}</SelectItem>
                                <SelectItem value="translated">{t('Common.Filters.Translated')}</SelectItem>
                                <SelectItem value="untranslated">{t('Common.Filters.Untranslated')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* 表格内容区域 */}
                <div className="flex-1 overflow-hidden">
                    <RegexTable key={currentFile} data={filteredItems} editingId={editingId} onEditingIdChange={setEditingId} />
                </div>
            </div>
        </div>
    );
};

export { RegexEditor };
