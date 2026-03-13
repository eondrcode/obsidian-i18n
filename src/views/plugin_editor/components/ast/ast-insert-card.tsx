
import React, { memo, useState, useCallback } from 'react';
import { Button, Textarea, Label, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/shadcn';
import { ListPlus, Code, Pencil, Key, Tag } from 'lucide-react';
import { useRegexStore } from '../../store';
import { TemplateCard } from '../common/template-card';
import { useTranslation } from 'react-i18next';

interface AstAddPanelProps { }

/**
 * AST 新增卡片
 * - 支持 Key/Source/Target
 */
const AstInsertCard: React.FC<AstAddPanelProps> = memo(() => {
    const { t } = useTranslation();
    const [key, setKey] = useState<string>('');
    const [source, setSource] = useState<string>('');
    const [target, setTarget] = useState<string>('');
    const [type, setType] = useState<string>('VariableDeclarator'); // 默认类型

    const addAstItem = useRegexStore((state) => state.addAstItem);

    // 处理 Key 输入框变化
    const handleKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setKey(e.target.value);
    }, []);

    // 处理 Source 输入框变化
    const handleSourceChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setSource(e.target.value);
    }, []);

    // 处理 Target 输入框变化
    const handleTargetChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setTarget(e.target.value);
    }, []);

    // 处理新增按钮点击
    const handleAddClick = useCallback(() => {
        if (!key || !source) { return; }

        // Source 不应默认为 Key，因为 Key 是变量名，Source 是字面量值
        // Target 默认为 Source (即不翻译)
        const finalSource = source;
        const finalTarget = target || finalSource;

        const newItem: any = {
            name: key,
            source: finalSource,
            target: finalTarget,
            type: type,
            id: -1 // Store 会自动生成 ID
        };

        addAstItem(newItem);
        setKey('');
        setSource('');
        setTarget('');
        setType('VariableDeclarator');
    }, [key, source, target, type, addAstItem]);

    // 回车提交（Ctrl+Enter）
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            handleAddClick();
        }
    }, [handleAddClick]);

    // AST 类型列表
    const AST_TYPES = [
        { value: 'VariableDeclarator', label: `VariableDeclarator (${t('Editor.Ast.NodeVariable')})` },
        { value: 'AssignmentExpression', label: `AssignmentExpression (${t('Editor.Ast.NodeAssignment')})` },
        { value: 'ObjectProperty', label: `ObjectProperty (${t('Editor.Ast.NodeProperty')})` },
        { value: 'CallExpression', label: `CallExpression (${t('Editor.Ast.NodeCall')})` },
        { value: 'NewExpression', label: `NewExpression (${t('Editor.Ast.NodeNew')})` },
    ];

    return (
        <TemplateCard
            title={t('Editor.Ast.AddRule')}
            icon={ListPlus}
            className="flex flex-col gap-3"
        >
            <div className="flex flex-col gap-3">
                {/* 类型 (Type) 下拉框 */}
                <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" />
                        {t('Editor.Table.ColumnType')}
                    </Label>
                    <Select value={type} onValueChange={setType}>
                        <SelectTrigger size="sm" className="text-xs bg-background w-full">
                            <SelectValue placeholder={t('Editor.Ast.SelectTypePlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                            {AST_TYPES.map(t => (
                                <SelectItem key={t.value} value={t.value} className="text-xs">
                                    {t.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* 键名 (Key) 输入框 */}
                <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5" />
                        {t('Editor.Table.ColumnName')}
                    </Label>
                    <Input
                        value={key}
                        onChange={handleKeyChange}
                        onKeyDown={handleKeyDown}
                        placeholder={t('Editor.Ast.InputNamePlaceholder')}
                        className="h-8 text-xs bg-background"
                    />
                </div>

                {/* 原文 (Source) 输入框 */}
                <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Code className="w-3.5 h-3.5" />
                        {t('Editor.Table.ColumnSource')}
                    </Label>
                    <Textarea
                        value={source}
                        onChange={handleSourceChange}
                        onKeyDown={handleKeyDown}
                        placeholder={t('Editor.Ast.InputSourcePlaceholder')}
                        className="text-xs h-16 resize-y bg-background border-input"
                    />
                </div>

                {/* 译文 (Target) 输入框 */}
                <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Pencil className="w-3.5 h-3.5" />
                        {t('Editor.Table.ColumnTarget')}
                    </Label>
                    <Textarea
                        value={target}
                        onChange={handleTargetChange}
                        onKeyDown={handleKeyDown}
                        placeholder={source ? t('Editor.Ast.DefaultPlaceholder', { source }) : t('Editor.Ast.InputTargetPlaceholder')}
                        className="text-xs h-16 resize-y border-input bg-background"
                    />
                </div>
            </div>

            {/* 新增按钮 */}
            <Button
                variant="secondary"
                size="sm"
                onClick={handleAddClick}
                disabled={!key || !source}
                className="text-xs h-8 gap-1.5 text-foreground transition-all duration-200 hover:scale-[1.02] active:scale-95 group w-full mt-1 font-medium"
            >
                <ListPlus className="w-3.5 h-3.5" />
                {t('Editor.Ast.AddRule')}
            </Button>
        </TemplateCard>
    );
});

AstInsertCard.displayName = 'AstInsertCard';

export { AstInsertCard };
