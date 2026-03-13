import React, { useMemo, useState, useCallback, useDeferredValue } from 'react';
import { Search } from 'lucide-react';
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/shadcn';
import { useTranslation } from 'react-i18next';
import { useRegexStore } from '../../store';
import { ASTTable } from './ast-table';

type FilterType = 'all' | 'translated' | 'untranslated';

interface Props {
    // 不再需要 sidebar 相关 props
}

const AstEditor: React.FC<Props> = () => {
    const { t } = useTranslation();
    // 搜索
    const searchQuery = useRegexStore.use.searchQuery();
    const setSearchQuery = useRegexStore.use.setSearchQuery();
    const [filterType, setFilterType] = useState<FilterType>('all');

    // 搜索防抖：使用 useDeferredValue 延迟过滤计算
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const deferredFilterType = useDeferredValue(filterType);

    // AST数据（从store获取）
    const astItems = useRegexStore.use.astItems();
    const updateAstItem = useRegexStore.use.updateAstItem();
    const deleteAstItem = useRegexStore.use.deleteAstItem();
    const resetAstItem = useRegexStore.use.resetAstItem();

    // 当前编辑项ID
    const [editingId, setEditingId] = useState<number | null>(null);

    // 过滤后的条目（使用 deferred 值，避免每次按键都同步计算）
    const filteredItems = useMemo(() => {
        let items = astItems;

        // 1. 按状态筛选
        if (deferredFilterType === 'translated') {
            items = items.filter(item => item.target && item.target !== item.source && item.target.trim() !== '');
        } else if (deferredFilterType === 'untranslated') {
            items = items.filter(item => !item.target || item.target === item.source || item.target.trim() === '');
        }

        // 2. 按搜索词筛选
        if (deferredSearchQuery.trim()) {
            const query = deferredSearchQuery.toLowerCase();
            items = items.filter(item => item.source.toLowerCase().includes(query) || item.target.toLowerCase().includes(query) || item.name.toLowerCase().includes(query) || item.type.toLowerCase().includes(query));
        }
        return items;
    }, [astItems, deferredSearchQuery, deferredFilterType]);

    // 稳定化回调
    const handleRowClick = useCallback((id: number) => {
        setEditingId(id);
    }, []);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    }, []);

    const handleFilterChange = useCallback((v: string) => {
        setFilterType(v as FilterType);
    }, []);

    return (
        <div className="flex h-full flex-col">
            <div className="flex min-h-0 flex-1 flex-col">
                {/* 搜索框区域 */}
                <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input className="h-8 w-64 pl-8"
                                placeholder={t('Common.Placeholders.Search')}
                                value={searchQuery}
                                onChange={handleSearchChange}
                            />
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

                {/* AST条目表格 */}
                <div className="flex-1 overflow-hidden h-full">
                    <ASTTable
                        data={filteredItems}
                        editingId={editingId}
                        onRowClick={handleRowClick}
                        onDelete={deleteAstItem}
                        onReset={resetAstItem}
                    />
                </div>
            </div>
        </div>
    );
};

export { AstEditor };
