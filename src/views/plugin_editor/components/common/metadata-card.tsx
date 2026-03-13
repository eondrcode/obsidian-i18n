import React, { memo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as path from 'path';
import { Tag, User, Hash, Globe, FileText, Package, Layers, Cloud, HardDrive, Wand2 } from 'lucide-react';
import { Input, Textarea, Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Button } from '@/src/shadcn';
import { TemplateCard } from './template-card';
import { useRegexStore } from '../../store';
import { useGlobalStoreInstance } from '~/utils';
import { TranslationSource } from '~/types';

import { SUPPORTED_LANGUAGES } from '~/constants/languages';


export const MetadataCard: React.FC = memo(() => {
    const { t } = useTranslation();
    const metadata = useRegexStore.use.metadata();
    const updateMetadata = useRegexStore.use.updateMetadata();

    const i18n = useGlobalStoreInstance(state => state.i18n);
    const editorPluginTranslationPath = useGlobalStoreInstance(state => state.editorPluginTranslationPath);
    // 订阅 editorPluginTranslation，保存后全局 store 更新时触发重新获取 source（含最新 checksum）
    const editorPluginTranslation = useGlobalStoreInstance(state => state.editorPluginTranslation);

    const [source, setSource] = useState<TranslationSource | null>(null);

    useEffect(() => {
        if (i18n?.sourceManager && editorPluginTranslationPath) {
            try {
                const ext = path.extname(editorPluginTranslationPath);
                const baseName = path.basename(editorPluginTranslationPath, ext);
                const s = i18n.sourceManager.getSource(baseName);
                if (s) {
                    // 浅拷贝以确保 React 检测到状态变化
                    setSource({ ...s });
                }
            } catch (e) {
                console.error("Failed to load translation source info", e);
            }
        }
    }, [i18n, editorPluginTranslationPath, editorPluginTranslation]);




    if (!metadata) return null;

    const handleChange = (field: keyof typeof metadata, value: string) => {
        updateMetadata({ [field]: value });
    };

    return (
        <TemplateCard
            title={t('Editor.Titles.Metadata')}
            icon={FileText}
        >
            <div className="space-y-3">
                {/* 插件ID (只读) */}
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" />
                        {t('Editor.Labels.PluginId')}
                    </label>
                    <Input value={metadata.plugin} readOnly disabled className="h-8 text-sm bg-muted/50 text-muted-foreground" />
                </div>
                {/* 标题 */}
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" />
                        {t('Editor.Labels.Name')}
                    </label>
                    <div className="flex gap-2">
                        <Input value={metadata.title} onChange={(e) => handleChange('title', e.target.value)} placeholder={t('Editor.Labels.NamePlaceholder')} className="h-8 text-sm bg-background" />
                        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" title={t('Editor.Titles.Metadata')}
                            onClick={() => {
                                const baseTitle = (metadata.title || '').replace(/^(\[[^\]]+\])+\s*/, '');
                                let prefix = '';
                                if (metadata.author) { prefix += `[${metadata.author}]`; }
                                if (metadata.language) { prefix += `[${metadata.language}]`; }

                                const newTitle = `${prefix} ${baseTitle}`.trim();
                                handleChange('title', newTitle);
                            }}
                        >
                            <Wand2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>

                {/* 描述 */}
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        {t('Editor.Labels.Desc')}
                    </label>
                    <Textarea
                        value={metadata.description}
                        onChange={(e) => handleChange('description', e.target.value)}
                        placeholder={t('Editor.Labels.DescPlaceholder')}
                        className="min-h-[60px] text-sm bg-background resize-none"
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    {/* 作者 */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            {t('Editor.Labels.Author')}
                        </label>
                        <Input
                            value={metadata.author}
                            onChange={(e) => handleChange('author', e.target.value)}
                            placeholder={t('Editor.Labels.Author')}
                            className="h-8 text-sm bg-background px-2"
                        />
                    </div>

                    {/* 语言 */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5" />
                            {t('Editor.Labels.Lang')}
                        </label>
                        <Select
                            value={metadata.language}
                            onValueChange={(val) => handleChange('language', val)}
                        >
                            <SelectTrigger size="sm" className="w-full text-sm bg-background px-2">
                                <SelectValue placeholder={t('Editor.Labels.Lang')} />
                            </SelectTrigger>
                            <SelectContent>
                                {SUPPORTED_LANGUAGES.map((lang) => (
                                    <SelectItem key={lang.value} value={lang.value}>
                                        {lang.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    {/* 支持的插件版本 */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5" />
                            {t('Editor.Labels.SupportedVer')}
                        </label>
                        <Input
                            value={metadata.supportedVersions}
                            onChange={(e) => handleChange('supportedVersions', e.target.value)}
                            placeholder=">=1.0.0"
                            className="h-8 text-sm bg-background px-2"
                        />
                    </div>

                    {/* 版本 */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <Hash className="w-3.5 h-3.5" />
                            {t('Editor.Labels.Ver')}
                        </label>
                        <Input
                            value={metadata.version}
                            onChange={(e) => handleChange('version', e.target.value)}
                            placeholder="1.0.0"
                            className="h-8 text-sm bg-background px-2"
                        />
                    </div>
                </div>

                {/* 来源信息 (只读) */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            {source?.origin === 'cloud' ? <Cloud className="w-3.5 h-3.5" /> : <HardDrive className="w-3.5 h-3.5" />}
                            {t('Editor.Labels.Source')}
                        </label>
                        <div className="flex items-center h-8 px-2 text-sm bg-muted/50 text-muted-foreground font-medium border rounded-md">
                            {source?.origin === 'cloud' ? t('Editor.Labels.SourceCloud') : t('Editor.Labels.SourceLocal')}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <Hash className="w-3.5 h-3.5" />
                            {t('Editor.Labels.Checksum')}
                        </label>
                        <Input
                            value={source?.checksum?.substring(0, 8) || '-'}
                            readOnly
                            disabled
                            className="h-8 text-sm bg-muted/50 text-muted-foreground font-mono px-2"
                            title={source?.checksum}
                        />
                    </div>
                </div>
            </div>
        </TemplateCard>
    );
});

MetadataCard.displayName = 'MetadataCard';
