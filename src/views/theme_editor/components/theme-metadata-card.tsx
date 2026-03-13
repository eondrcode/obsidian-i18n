import React, { memo, useState, useEffect } from 'react';
import * as path from 'path';
import { Input } from '~/shadcn';
import { Palette, Hash, Layers, Globe, User, Type, AlignLeft, Cloud, HardDrive } from 'lucide-react';
import { useThemeEditorStore } from '../store';
import { TemplateCard } from '../../plugin_editor/components/common/template-card';
import { useTranslation } from 'react-i18next';
import { useGlobalStoreInstance } from '~/utils';
import { TranslationSource } from '~/types';

/**
 * 主题元信息卡片 - 可编辑的元数据表单
 */
const ThemeMetadataCard: React.FC = memo(() => {
    const { t } = useTranslation();
    const metadata = useThemeEditorStore.use.metadata();
    const themeName = useThemeEditorStore.use.themeName();
    const translationPath = useThemeEditorStore.use.translationPath();
    const updateMetadata = useThemeEditorStore.use.updateMetadata();

    const i18n = useGlobalStoreInstance(state => state.i18n);
    const editorThemeTranslation = useGlobalStoreInstance(state => state.editorThemeTranslation);

    const [source, setSource] = useState<TranslationSource | null>(null);

    useEffect(() => {
        if (i18n?.sourceManager && translationPath) {
            try {
                const ext = path.extname(translationPath);
                const baseName = path.basename(translationPath, ext);
                const s = i18n.sourceManager.getSource(baseName);
                if (s) {
                    setSource({ ...s });
                }
            } catch (e) {
                console.error("Failed to load translation source info", e);
            }
        }
    }, [i18n, translationPath, editorThemeTranslation]);

    return (
        <TemplateCard title={t('Editor.Titles.Metadata')} icon={Palette}>
            <div className="space-y-3.5">
                {/* 1. 主题基本信息 (只读) */}
                <div className="space-y-1.5 focus-within:z-10">
                    <label className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider flex items-center gap-1.5 px-0.5">
                        <Palette className="w-3.5 h-3.5" />
                        {t('Editor.Labels.ThemeName')}
                    </label>
                    <Input
                        value={themeName || t('Common.Status.Unknown')}
                        readOnly
                        disabled
                        className="h-8 text-xs bg-muted/30 text-muted-foreground border-dashed px-2.5"
                    />
                </div>

                {/* 2. 译文核心元信息 */}
                <div className="space-y-3">
                    {/* 标题 */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 px-0.5">
                            <Type className="w-3.5 h-3.5" />
                            {t('Editor.Table.ColumnTarget')}
                        </label>
                        <Input
                            value={metadata?.title || ''}
                            onChange={(e) => updateMetadata({ title: e.target.value })}
                            placeholder={t('Editor.Labels.DescPlaceholder')}
                            className="h-8 text-sm px-2.5"
                        />
                    </div>

                    {/* 描述 */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 px-0.5">
                            <AlignLeft className="w-3.5 h-3.5" />
                            {t('Editor.Labels.Desc')}
                        </label>
                        <Input
                            value={metadata?.description || ''}
                            onChange={(e) => updateMetadata({ description: e.target.value })}
                            placeholder={t('Editor.Labels.DescPlaceholder')}
                            className="h-8 text-sm px-2.5"
                        />
                    </div>

                    {/* 语言 & 作者 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 px-0.5">
                                <Globe className="w-3.5 h-3.5" />
                                {t('Editor.Labels.Lang')}
                            </label>
                            <Input
                                value={metadata?.language || ''}
                                onChange={(e) => updateMetadata({ language: e.target.value })}
                                placeholder={t('Editor.Labels.Lang')}
                                className="h-8 text-sm px-2.5"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 px-0.5">
                                <User className="w-3.5 h-3.5" />
                                {t('Editor.Labels.Author')}
                            </label>
                            <Input
                                value={metadata?.author || ''}
                                onChange={(e) => updateMetadata({ author: e.target.value })}
                                placeholder={t('Editor.Labels.Author')}
                                className="h-8 text-sm px-2.5"
                            />
                        </div>
                    </div>

                    {/* 版本信息 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 px-0.5">
                                <Layers className="w-3.5 h-3.5" />
                                {t('Editor.Labels.SupportedVer')}
                            </label>
                            <Input
                                value={metadata?.supportedVersions || ''}
                                onChange={(e) => updateMetadata({ supportedVersions: e.target.value })}
                                placeholder={t('Editor.Labels.Ver')}
                                className="h-8 text-sm px-2.5"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 px-0.5">
                                <Hash className="w-3.5 h-3.5" />
                                {t('Editor.Labels.Ver')}
                            </label>
                            <Input
                                value={metadata?.version || ''}
                                onChange={(e) => updateMetadata({ version: e.target.value })}
                                placeholder={t('Editor.Labels.Ver')}
                                className="h-8 text-sm px-2.5"
                            />
                        </div>
                    </div>
                </div>

                {/* 3. 来源信息 (只读) */}
                <div className="grid grid-cols-2 gap-3 pt-0.5">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 px-0.5">
                            {source?.origin === 'cloud' ? <Cloud className="w-3.5 h-3.5" /> : <HardDrive className="w-3.5 h-3.5" />}
                            {t('Editor.Labels.Source')}
                        </label>
                        <div className="flex items-center h-8 px-2.5 text-sm bg-muted/50 text-muted-foreground font-medium border rounded-md">
                            {source?.origin === 'cloud' ? t('Editor.Labels.SourceCloud') : t('Editor.Labels.SourceLocal')}
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 px-0.5">
                            <Hash className="w-3.5 h-3.5" />
                            {t('Editor.Labels.Checksum')}
                        </label>
                        <Input
                            value={source?.checksum?.substring(0, 8) || '-'}
                            readOnly
                            disabled
                            className="h-8 text-sm bg-muted/50 text-muted-foreground font-mono px-2.5"
                            title={source?.checksum}
                        />
                    </div>
                </div>
            </div>
        </TemplateCard>
    );
});

ThemeMetadataCard.displayName = 'ThemeMetadataCard';

export { ThemeMetadataCard };
