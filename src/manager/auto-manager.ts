import I18N from '../main';
import { Notice } from 'obsidian';
import * as path from 'path';
import * as fs from 'fs-extra';
import { t } from '../locales';
import { RegistryItem, CommunityStatsData, ManifestEntry, getCloudFilePath } from '../views/cloud/types';
import { calculateChecksum } from '../utils/translator/translation';
import { TranslationSource } from '../types';

export class AutoManager {
    private i18n: I18N;
    private isRunning = false;

    constructor(i18n: I18N) {
        this.i18n = i18n;
    }

    /**
     * 一键智能自动化处理
     */
    public async runSmartAuto() {
        if (this.isRunning) {
            new Notice(t('Manager.Status.Running'));
            return;
        }

        this.isRunning = true;
        this.i18n.notice.info(t('Manager.Status.AutoStarting'));

        try {
            // 1. 获取社区注册表和统计数据
            const registryAddr = 'eondrcode/obsidian-i18n-resources';
            const [owner, repo] = registryAddr.split('/');

            const [registryRes, statsRes] = await Promise.all([
                this.i18n.api.github.getFileContentWithFallback(owner, repo, 'registry.json'),
                this.i18n.api.github.getFileContentWithFallback(owner, repo, 'stats.json'),
            ]);

            if (!registryRes.state || !statsRes.state) {
                throw new Error(t('Manager.Errors.FetchCommunityDataFailed'));
            }

            const registry: RegistryItem[] = registryRes.data;
            const stats: CommunityStatsData = statsRes.data;

            // 调试：显示获取到的总库数
            console.log('[AutoManager] Registry count:', registry.length);
            console.log('[AutoManager] Stats repos count:', Object.keys(stats.repos || {}).length);

            // 2. 扫描已安装项
            const installedPlugins = this.getInstalledPlugins();
            const installedThemes = await this.getInstalledThemes();
            const allInstalled = [...installedPlugins, ...installedThemes];

            this.i18n.notice.info(t('Manager.Status.ScanningInstalled', { count: allInstalled.length }));

            // 3. 批量获取所有受信任仓库的元数据
            // 优化过滤逻辑：如果 stats 为空或不包含 pluginIds，则不进行严格过滤，尝试加载所有 registry 中的库
            let relevantRepos = registry.filter(item => {
                const repoStats = stats.repos?.[item.repoAddress];
                if (!repoStats || !repoStats.pluginIds) return true; // 降级处理：如果没有统计数据，认为可能相关
                return allInstalled.some(installed => repoStats.pluginIds?.includes(installed.id));
            });

            // 如果过滤后为空且 registry 不为空，则至少尝试加载第一个（作为基准）或全部
            if (relevantRepos.length === 0 && registry.length > 0) {
                relevantRepos = registry;
            }

            console.log('[AutoManager] Relevant repos count:', relevantRepos.length);

            const allManifests: { repoAddress: string; entry: ManifestEntry }[] = [];
            await Promise.all(relevantRepos.map(async (item) => {
                const [rOwner, rRepo] = item.repoAddress.split('/');
                const manifestRes = await this.i18n.api.github.getFileContentWithFallback(rOwner, rRepo, 'metadata.json');
                if (manifestRes.state && Array.isArray(manifestRes.data)) {
                    manifestRes.data.forEach((entry: ManifestEntry) => {
                        allManifests.push({ repoAddress: item.repoAddress, entry });
                    });
                }
            }));

            console.log('[AutoManager] Total manifests fetched:', allManifests.length);
            this.i18n.notice.info(`正在解析 ${allManifests.length} 个云端翻译条目...`);

            // 4. 为每个已安装项寻找最佳翻译
            let successCount = 0;
            let skipCount = 0;
            let upToDateCount = 0;
            let errorCount = 0;

            for (const installed of allInstalled) {
                const matches = allManifests.filter(m => m.entry.plugin === installed.id);
                if (matches.length === 0) {
                    skipCount++;
                    continue;
                }

                // 智能优选逻辑
                const bestMatch = this.selectBestTranslation(matches, stats, installed.version);
                if (bestMatch) {
                    // 优化：下载前先检查本地是否已有相同 Hash 的翻译
                    const existing = this.i18n.sourceManager.getSource(bestMatch.entry.id);
                    if (existing && existing.cloud?.hash === bestMatch.entry.hash) {
                        // 即使 Hash 一致，如果尚未应用，也需要尝试应用
                        const state = this.i18n.stateManager.getPluginState(installed.id);
                        if (state?.isApplied && state?.translationVersion === bestMatch.entry.version) {
                            upToDateCount++;
                            continue;
                        }
                        // 如果 Hash 一致但没应用，则直接进入应用阶段（跳过下载）
                        this.i18n.notice.info(`检测到 ${installed.id} 已有缓存，正在直接应用...`, 1000);
                        // 必须先激活，injector 才能找到路径
                        this.i18n.sourceManager.setActive(bestMatch.entry.id, true);
                        const result = await this.i18n.injectorManager.applyToPlugin(installed.id);
                        if (result) successCount++;
                        else errorCount++;
                        continue;
                    }

                    this.i18n.notice.info(`正在为 ${installed.id} 下载最佳翻译...`, 2000);
                    const result = await this.applyTranslation(bestMatch, installed.type);
                    if (result === true) {
                        successCount++;
                        this.i18n.notice.success(`${installed.id} 翻译应用成功`, 3000);
                    } else if (result === null) {
                        upToDateCount++;
                    } else {
                        errorCount++;
                    }
                }
            }

            if (successCount === 0 && upToDateCount === 0 && errorCount === 0) {
                this.i18n.notice.warning(`未在社区库中找到匹配的翻译 (跳过: ${skipCount})`);
            } else {
                this.i18n.notice.success(`一键处理完成！统计：成功 ${successCount}，已最新 ${upToDateCount}，失败 ${errorCount}，未找到 ${skipCount}`);
            }
        } catch (error) {
            console.error('[AutoManager] Smart Auto failed:', error);
            this.i18n.notice.error(`${t('Manager.Errors.AutoFailed')}: ${error.message || error}`);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * 获取已安装插件
     */
    private getInstalledPlugins() {
        // @ts-ignore
        const manifests = this.i18n.app.plugins.manifests;
        return Object.values(manifests)
            .filter((m: any) => m.id !== this.i18n.manifest.id)
            .map((m: any) => ({ id: m.id, version: m.version, type: 'plugin' as const }));
    }

    /**
     * 获取已安装主题
     */
    private async getInstalledThemes() {
        const themes: { id: string; version: string; type: 'theme' }[] = [];
        try {
            // @ts-ignore
            const exists = await this.i18n.app.vault.adapter.exists(`${this.i18n.app.vault.configDir}/themes`);
            if (exists) {
                // @ts-ignore
                const folders = await this.i18n.app.vault.adapter.list(`${this.i18n.app.vault.configDir}/themes`);
                for (const folder of folders.folders) {
                    const themeId = folder.split('/').pop();
                    if (themeId) {
                        // 主题通常没有 manifest.json 暴露版本，或者需要读取里面的内容
                        // 简化处理：版本设为 0.0.0
                        themes.push({ id: themeId, version: '0.0.0', type: 'theme' });
                    }
                }
            }
        } catch (e) {
            console.error('Failed to fetch themes', e);
        }
        return themes;
    }

    /**
     * 智能优选算法
     */
    private selectBestTranslation(
        matches: { repoAddress: string; entry: ManifestEntry }[],
        stats: CommunityStatsData,
        targetVersion: string
    ) {
        // 评分逻辑
        const scored = matches.map(m => {
            const repoStats = stats.repos[m.repoAddress];
            let score = 0;

            if (repoStats) {
                // 1. 星标权重 (0-50分)
                score += Math.min(repoStats.stars || 0, 50);
                // 2. 活跃度权重 (0-30分)
                score += (repoStats.activityScore || 0) * 30;
                // 3. 插件覆盖数权重 (0-20分)
                score += Math.min(repoStats.pluginCount || 0, 20);
            }

            // 4. 版本匹配权重 (额外加分)
            if (m.entry.supported_versions === targetVersion) {
                score += 100; // 完美匹配优先
            }

            return { ...m, score };
        });

        // 按分数降序排列
        scored.sort((a, b) => b.score - a.score);
        return scored[0];
    }

    /**
     * 下载并应用翻译
     */
    private async applyTranslation(
        match: { repoAddress: string; entry: ManifestEntry },
        type: 'plugin' | 'theme'
    ): Promise<boolean | null> {
        const [owner, repo] = match.repoAddress.split('/');
        const filePath = getCloudFilePath(match.entry.id, type);

        try {
            const res = await this.i18n.api.github.getFileContentWithFallback(owner, repo, filePath);
            if (!res.state || !res.data) return false;

            const content = res.data;
            const manager = this.i18n.sourceManager;

            // 1. 检查本地是否已有同 ID 翻译
            const existing = manager.getSource(match.entry.id);

            // 如果已有且 Hash 一致，代表已是最新，返回 null
            if (existing && existing.cloud?.hash === match.entry.hash) {
                return null;
            }

            // 2. 自动备份 (如果存在且不同)
            if (existing) {
                // @ts-ignore
                this.i18n.backupManager.backupTranslationSync(existing.id, manager.sourcesDir);
            }

            // 3. 保存文件
            manager.saveSourceFile(match.entry.id, content);

            // 4. 更新元数据
            const sourceInfo: TranslationSource = {
                id: match.entry.id,
                plugin: match.entry.plugin,
                title: match.entry.title,
                type: match.entry.type,
                origin: 'cloud',
                isActive: true, // 自动化流程默认激活
                checksum: calculateChecksum(content),
                cloud: {
                    owner,
                    repo,
                    hash: match.entry.hash,
                },
                updatedAt: Date.now(),
                createdAt: existing?.createdAt || Date.now(),
            };

            // 设置激活（自动取消同插件其他激活）
            manager.saveSource(sourceInfo);
            manager.setActive(match.entry.id, true);

            // 5. 核心追加：立即应用（注入）翻译到插件
            // 如果这一步失败，我们仍然认为下载是成功的，但返回 false 以便在统计中体现
            const injectSuccess = await this.i18n.injectorManager.applyToPlugin(match.entry.plugin);
            
            return injectSuccess;
        } catch (error) {
            console.error(`Failed to apply translation for ${match.entry.plugin}:`, error);
            return false;
        }
    }
}
