/**
 * 云端翻译管理状态管理
 */
import { create } from 'zustand';
import { CloudTabType, SearchParams, UploadFormData, LocalTranslationFile, ManifestEntry, RegistryItem, CommunityStatsData, OutdatedSource, BackupProgress, GithubUserInfo, GithubRepoInfo } from './types';
import { createSelectors } from '@/src/utils';

// Store 状态接口
interface CloudState {
    // ===== 通用状态 =====
    currentTab: CloudTabType;
    isLoading: boolean;
    error: string | null;

    // ===== 社区目录状态 =====
    communityRegistry: RegistryItem[];
    communityStats: CommunityStatsData | null;
    communityLoaded: boolean;
    communityLoading: boolean;

    // ===== 个人仓库状态 =====
    repoDataLoaded: boolean;
    repoInitialized: boolean;
    repoChecking: boolean;
    repoManifest: ManifestEntry[];
    githubUser: GithubUserInfo | null;
    isForking: boolean;
    canCreateRepo: boolean;
    repoNameInput: string;
    repoDescriptionInput: string;
    myRepoInfo: GithubRepoInfo | null;
    myRepoReadme: string | null;

    // ===== 下载页状态 =====
    searchParams: SearchParams;
    totalPages: number;
    targetRepoAddress: string;
    targetRepoStars: number | null;
    targetManifest: ManifestEntry[];
    savedRepos: string[];
    targetRepoReadme: string | null;

    // ===== 上传页状态 =====
    uploadForm: UploadFormData;
    uploadType: 'plugin' | 'theme';
    localFiles: LocalTranslationFile[];
    selectedPluginId: string;
    selectedSourceId: string;

    // ===== 更新检查状态 =====
    outdatedSources: OutdatedSource[];
    isCheckingUpdates: boolean;

    // ===== 历史回滚 =====
    historyDialogEntryId: string | null;

    // ===== 备份/恢复 =====
    backupDialogOpen: boolean;
    backupDialogMode: 'backup' | 'restore' | null;
    backupProgress: BackupProgress | null;

    // ===== 差异对比 =====
    diffDialogSourceId: string | null;
    refreshVersion: number;

    // ===== 权限状态 =====
    isAdmin: boolean;
    isPushing: boolean;
}


// Store Actions 接口
interface CloudActions {

    // Tab 切换
    setCurrentTab: (tab: CloudTabType) => void;

    // 社区目录
    setCommunityRegistry: (items: RegistryItem[]) => void;
    setCommunityStats: (stats: CommunityStatsData | null) => void;
    setCommunityLoaded: (loaded: boolean) => void;
    setCommunityLoading: (loading: boolean) => void;

    // 个人仓库
    setRepoDataLoaded: (loaded: boolean) => void;
    setRepoInitialized: (initialized: boolean) => void;
    setRepoChecking: (checking: boolean) => void;
    setRepoManifest: (manifest: ManifestEntry[]) => void;
    setGithubUser: (user: GithubUserInfo | null) => void;
    setIsForking: (isForking: boolean) => void;
    setCanCreateRepo: (can: boolean) => void;
    setRepoNameInput: (name: string) => void;
    setRepoDescriptionInput: (desc: string) => void;
    setMyRepoInfo: (info: GithubRepoInfo | null) => void;
    setMyRepoReadme: (content: string | null) => void;

    // 搜索
    setSearchQuery: (query: string) => void;
    setSearchLanguage: (language: string) => void;
    setSearchPage: (page: number) => void;

    // 翻译列表
    setTotalPages: (pages: number) => void;

    // 下载页
    setTargetRepoAddress: (address: string) => void;
    setTargetRepoStars: (stars: number | null) => void;
    setTargetManifest: (manifest: ManifestEntry[]) => void;
    setSavedRepos: (repos: string[]) => void;
    setTargetRepoReadme: (content: string | null) => void;
    addSavedRepo: (address: string) => void;
    removeSavedRepo: (address: string) => void;

    // ===== 上传页动作 =====
    setUploadType: (type: 'plugin' | 'theme') => void;
    setSelectedPluginId: (pluginId: string) => void;
    setSelectedSourceId: (sourceId: string) => void;
    setUploadForm: (form: Partial<UploadFormData>) => void;
    setLocalFiles: (files: LocalTranslationFile[]) => void;
    resetUploadForm: () => void;

    // 更新检查
    setOutdatedSources: (sources: OutdatedSource[]) => void;
    setIsCheckingUpdates: (is: boolean) => void;

    // 加载状态
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;

    // 历史回滚
    setHistoryDialogEntryId: (id: string | null) => void;

    // 备份/恢复
    setBackupDialogOpen: (open: boolean) => void;
    setBackupDialogMode: (mode: 'backup' | 'restore' | null) => void;
    setBackupProgress: (progress: BackupProgress | null) => void;

    // 差异对比
    setDiffDialogSourceId: (id: string | null) => void;

    // 权限管理
    setIsAdmin: (isAdmin: boolean) => void;
    fetchGithubUser: (i18n: any) => Promise<void>;
    fetchCommunityRegistry: (i18n: any) => Promise<void>;
    pushRegistryToCloud: (i18n: any) => Promise<boolean>;

    // 注册表管理 (管理员功能)
    updateRegistryItem: (repoAddress: string, data: Partial<RegistryItem>) => void;

    // 重置
    reset: () => void;
}

// 初始状态
const initialState: CloudState = {
    currentTab: 'community',
    isLoading: false,
    error: null,

    communityRegistry: [],
    communityStats: null,
    communityLoaded: false,
    communityLoading: false,

    repoDataLoaded: false,
    repoInitialized: false,
    repoChecking: false,
    repoManifest: [],
    githubUser: null,
    isForking: false,
    canCreateRepo: false,
    repoNameInput: 'obsidian-i18n-resources',
    repoDescriptionInput: '',
    myRepoInfo: null,
    myRepoReadme: null,

    searchParams: {
        query: '',
        language: 'zh-cn',
        page: 1,
        page_size: 20,
    },
    totalPages: 1,
    targetRepoAddress: '',
    targetRepoStars: null,
    targetManifest: [],
    savedRepos: [],
    targetRepoReadme: null,

    uploadType: 'plugin',
    uploadForm: {
        plugin_id: '',
        title: '',
        description: '',
        version: '',
    },
    localFiles: [],
    selectedPluginId: '',
    selectedSourceId: '',

    outdatedSources: [],
    isCheckingUpdates: false,

    historyDialogEntryId: null,

    backupDialogOpen: false,
    backupDialogMode: null,
    backupProgress: null,

    diffDialogSourceId: null,
    refreshVersion: 0,
    isAdmin: false,
    isPushing: false,
};


// 创建 Store
const useCloudStoreBase = create<CloudState & CloudActions>()((set, get) => ({
    ...initialState,

    // Tab 切换
    setCurrentTab: (tab) => set({ currentTab: tab }),

    // 社区目录
    setCommunityRegistry: (communityRegistry) => set({ communityRegistry }),
    setCommunityStats: (communityStats) => set({ communityStats }),
    setCommunityLoaded: (communityLoaded) => set({ communityLoaded }),
    setCommunityLoading: (communityLoading) => set({ communityLoading }),

    // 个人仓库
    setRepoDataLoaded: (repoDataLoaded) => set({ repoDataLoaded }),
    setRepoInitialized: (repoInitialized) => set({ repoInitialized }),
    setRepoChecking: (repoChecking) => set({ repoChecking }),
    setRepoManifest: (repoManifest) => set({ repoManifest }),
    setGithubUser: (githubUser) => set({ githubUser }),
    setIsForking: (isForking) => set({ isForking }),
    setCanCreateRepo: (canCreateRepo) => set({ canCreateRepo }),
    setRepoNameInput: (repoNameInput) => set({ repoNameInput }),
    setRepoDescriptionInput: (repoDescriptionInput) => set({ repoDescriptionInput }),
    setMyRepoInfo: (myRepoInfo) => set({ myRepoInfo }),
    setMyRepoReadme: (myRepoReadme) => set({ myRepoReadme }),

    // 搜索
    setSearchQuery: (query) => set((state) => ({
        searchParams: { ...state.searchParams, query, page: 1 }
    })),
    setSearchLanguage: (language) => set((state) => ({
        searchParams: { ...state.searchParams, language, page: 1 }
    })),
    setSearchPage: (page) => set((state) => ({
        searchParams: { ...state.searchParams, page }
    })),

    // 翻译列表
    setTotalPages: (totalPages) => set({ totalPages }),

    // 下载页
    setTargetRepoAddress: (targetRepoAddress) => set({ targetRepoAddress }),
    setTargetRepoStars: (targetRepoStars) => set({ targetRepoStars }),
    setTargetManifest: (targetManifest) => set({ targetManifest }),
    setTargetRepoReadme: (targetRepoReadme) => set({ targetRepoReadme }),
    setSavedRepos: (savedRepos) => set({ savedRepos }),
    addSavedRepo: (address) => set((state) => ({ savedRepos: Array.from(new Set([...state.savedRepos, address])) })),
    removeSavedRepo: (address) => set((state) => ({ savedRepos: state.savedRepos.filter(a => a !== address) })),

    // 上传表单
    setUploadType: (type) => set({ uploadType: type }),
    setSelectedPluginId: (pluginId) => set({ selectedPluginId: pluginId, localFiles: [], selectedSourceId: '', uploadForm: { plugin_id: pluginId, title: '', description: '', version: '' } }),
    setSelectedSourceId: (sourceId) => set({ selectedSourceId: sourceId }),
    setUploadForm: (form) => set((state) => ({
        uploadForm: { ...state.uploadForm, ...form }
    })),
    setLocalFiles: (files) => set({ localFiles: files }),
    resetUploadForm: () => set({
        uploadForm: initialState.uploadForm,
        selectedPluginId: '',
        selectedSourceId: '',
        localFiles: [],
    }),

    // 更新检查
    setOutdatedSources: (outdatedSources) => set({ outdatedSources }),
    setIsCheckingUpdates: (isCheckingUpdates) => set({ isCheckingUpdates }),

    // 加载状态
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),

    // 历史回滚
    setHistoryDialogEntryId: (historyDialogEntryId) => set({ historyDialogEntryId }),

    // 备份/恢复
    setBackupDialogOpen: (backupDialogOpen) => set({ backupDialogOpen }),
    setBackupDialogMode: (backupDialogMode) => set({ backupDialogMode }),
    setBackupProgress: (backupProgress) => set({ backupProgress }),

    // 差异对比
    setDiffDialogSourceId: (diffDialogSourceId) => set({ diffDialogSourceId }),

    // 权限管理
    setIsAdmin: (isAdmin) => set({ isAdmin }),
    fetchGithubUser: async (i18n) => {
        const { githubUser, setGithubUser, setLoading, setIsAdmin, setCanCreateRepo } = get();
        const token = i18n.settings.shareToken;
        if (!token || githubUser) return;

        setLoading(true);
        try {
            const res = await i18n.api.github.getUser();
            if (res.state) {
                const user = {
                    login: res.data.login,
                    id: res.data.id,
                    avatar_url: res.data.avatar_url,
                    name: res.data.name,
                    followers: res.data.followers,
                    following: res.data.following,
                    public_repos: res.data.public_repos,
                    created_at: res.data.created_at,
                    bio: res.data.bio,
                };
                setGithubUser(user);
                setIsAdmin(user.login === i18n.api.github.owner);
                
                // 解析权限
                const scopes: string[] = res.scopes || [];
                setCanCreateRepo(scopes.includes('public_repo') || scopes.includes('repo'));
            }
        } catch (e) {
            console.error('Failed to fetch github user', e);
        } finally {
            setLoading(false);
        }
    },

    fetchCommunityRegistry: async (i18n) => {
        const { communityLoading, setCommunityLoading, setCommunityRegistry, setCommunityStats, setCommunityLoaded } = get();
        if (communityLoading) return;

        setCommunityLoading(true);
        try {
            const owner = i18n.api.github.owner;
            const repo = i18n.api.github.repo;

            // 并发加载 registry.json 和 stats.json
            const [registryRes, statsRes] = await Promise.all([
                i18n.api.github.getFileContentWithFallback(owner, repo, 'registry.json'),
                i18n.api.github.getFileContentWithFallback(owner, repo, 'stats.json'),
            ]);

            // 解析 registry.json
            if (registryRes.state && registryRes.data) {
                if (Array.isArray(registryRes.data)) {
                    setCommunityRegistry(registryRes.data);
                }
            }

            // 解析 stats.json
            if (statsRes.state && statsRes.data) {
                if (statsRes.data && typeof statsRes.data === 'object') {
                    setCommunityStats(statsRes.data);
                }
            }

            if (registryRes.state || statsRes.state) {
                setCommunityLoaded(true);
            }
        } catch (error) {
            console.error('Failed to fetch community registry', error);
        } finally {
            setCommunityLoading(false);
        }
    },

    pushRegistryToCloud: async (i18n) => {
        const { communityRegistry, isPushing } = get();
        if (isPushing) return false;

        set({ isPushing: true });
        try {
            const owner = i18n.api.github.owner;
            const repo = i18n.api.github.repo;
            const path = 'registry.json';
            
            // 1. 序列化并 Base64 编码
            const contentJson = JSON.stringify(communityRegistry, null, 2);
            const contentBase64 = Buffer.from(contentJson, 'utf-8').toString('base64');
            
            // 2. 上传文件
            const res = await i18n.api.github.uploadFile(
                owner, repo, path, contentBase64, 
                `Update registry.json from Admin Panel (${new Date().toLocaleString()})`
            );

            if (res.state) {
                return true;
            } else {
                console.error('Push to Registry failed:', res.data);
                return false;
            }
        } catch (error) {
            console.error('Push registry error:', error);
            return false;
        } finally {
            set({ isPushing: false });
        }
    },

    // 注册表管理
    updateRegistryItem: (repoAddress, data) => set((state) => ({
        communityRegistry: state.communityRegistry.map(item => 
            item.repoAddress === repoAddress ? { ...item, ...data } : item
        )
    })),

    // 重置 (保留下载页地址簿和当前目标状态)
    reset: () => set((state) => ({
        ...initialState,
        refreshVersion: state.refreshVersion + 1,
        savedRepos: state.savedRepos,
        targetRepoAddress: state.targetRepoAddress,
        targetManifest: state.targetManifest,
        targetRepoReadme: state.targetRepoReadme,
        communityRegistry: state.communityRegistry,
        communityStats: state.communityStats,
        communityLoaded: state.communityLoaded,
        outdatedSources: state.outdatedSources,
    })),
}));

// 导出带选择器的 Store
export const useCloudStore = createSelectors(useCloudStoreBase);
