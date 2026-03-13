
import React, { memo, useMemo, useRef } from 'react';
import { useRegexStore } from '../..';
import { TemplateCard } from '../common/template-card';
import { AlertTriangle, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { ScrollArea, Badge } from '@/src/shadcn';
import { validateBracketBalance, validateVariableConsistency, validatePunctuation } from '../../utils/validation-utils';
import { useTranslation } from 'react-i18next';

export const RegexValidationCard: React.FC = memo(() => {
    const { t } = useTranslation();
    const regexItems = useRegexStore.use.regexItems();
    const containerRef = useRef<HTMLDivElement>(null);
    // todo: Access highlighting state from store

    // 滚动到指定行并高亮
    const handleScrollToItem = (index: number) => {
        // 由于使用了 Shadow DOM，document.getElementById 无法直接获取元素
        // 需要通过 getRootNode() 获取 ShadowRoot
        const root = containerRef.current?.getRootNode() as ShadowRoot | Document;
        const element = root?.getElementById(`regex-row-${index}`);

        if (element) {
            // 使用 auto 替代 smooth，避免某些环境下滚动失效
            element.scrollIntoView({ behavior: 'auto', block: 'center' });

            // 添加临时高亮效果
            element.classList.add('bg-yellow-100');
            setTimeout(() => {
                element.classList.remove('bg-yellow-100');
            }, 2000);
        } else {
            console.warn(`Element regex-row-${index} not found in Shadow Root.`);
        }
    };

    // 计算验证结果
    const validationResult = useMemo(() => {
        const issues = {
            bracket: [] as number[],
            variable: [] as number[],
            punctuation: [] as number[],
            empty: [] as number[],
        };

        regexItems.forEach((item, index) => {
            // 忽略未翻译的条目 (或者源文等于译文的情况，视需求而定)
            if (!item.target || item.target === item.source) return;

            // 1. 括号检查
            if (!validateBracketBalance(item.target)) {
                issues.bracket.push(index);
            }

            // 2. 变量检查
            if (!validateVariableConsistency(item.source, item.target)) {
                issues.variable.push(index);
            }

            // 3. 标点检查 (可选)
            // if (!validatePunctuation(item.source, item.target)) {
            //     issues.punctuation.push(index);
            // }

            // 4. 空值检查 (虽然前面filter了，但如果只有空格可能也算空)
            if (item.target.trim() === '') {
                issues.empty.push(index);
            }
        });

        return issues;
    }, [regexItems]);

    const totalIssues = validationResult.bracket.length + validationResult.variable.length + validationResult.empty.length; // + validationResult.punctuation.length

    return (
        <TemplateCard
            title={t('Editor.Titles.Regex')}
            icon={ShieldCheck}
            extra={
                totalIssues === 0 ? (
                    <Badge variant="secondary" className="bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20">
                        {t('Common.Notices.Perfect')}
                    </Badge>
                ) : (
                    <Badge variant="destructive" className="px-2">
                        {t('Editor.Status.IssueCount', { count: totalIssues })}
                    </Badge>
                )
            }
        >
            <div className="space-y-4" ref={containerRef}>
                {totalIssues === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                        <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500 dark:text-green-400 opacity-80" />
                        <p className="text-sm">{t('Common.Notices.NoErrors')}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* 括号问题 */}
                        {validationResult.bracket.length > 0 && (
                            <div className="bg-red-500/10 rounded-md p-3 border border-red-500/20">
                                <div className="flex items-center gap-2 mb-2 text-red-600 dark:text-red-400 font-medium text-xs">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    {t('Editor.Labels.ParenthesesCheck')} ({validationResult.bracket.length})
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {validationResult.bracket.map(idx => (
                                        <Badge
                                            key={idx}
                                            variant="outline"
                                            className="bg-background text-xs border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/20 cursor-pointer transition-colors"
                                            onClick={() => handleScrollToItem(idx)}
                                            title={t('Editor.Labels.ClickToJump')}
                                        >
                                            #{idx + 1}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 变量问题 */}
                        {validationResult.variable.length > 0 && (
                            <div className="bg-orange-500/10 rounded-md p-3 border border-orange-500/20">
                                <div className="flex items-center gap-2 mb-2 text-orange-600 dark:text-orange-400 font-medium text-xs">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    {t('Editor.Labels.VariableCheck')} ({validationResult.variable.length})
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {validationResult.variable.map(idx => (
                                        <Badge
                                            key={idx}
                                            variant="outline"
                                            className="bg-background text-xs border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 cursor-pointer transition-colors"
                                            onClick={() => handleScrollToItem(idx)}
                                            title={t('Editor.Labels.ClickToJump')}
                                        >
                                            #{idx + 1}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 空值问题 */}
                        {validationResult.empty.length > 0 && (
                            <div className="bg-yellow-500/10 rounded-md p-3 border border-yellow-500/20">
                                <div className="flex items-center gap-2 mb-2 text-yellow-600 dark:text-yellow-400 font-medium text-xs">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    {t('Editor.Table.EmptyState')} ({validationResult.empty.length})
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {validationResult.empty.map(idx => (
                                        <Badge
                                            key={idx}
                                            variant="outline"
                                            className="bg-background text-xs border-yellow-500/30 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/20 cursor-pointer transition-colors"
                                            onClick={() => handleScrollToItem(idx)}
                                            title={t('Editor.Labels.ClickToJump')}
                                        >
                                            #{idx + 1}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </TemplateCard>
    );
});
