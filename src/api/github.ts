/**
 * 文件名称: github.ts
 * 模块描述: GitHub API 交互模块
 * 核心功能:
 *   - 个人翻译仓库管理（检查、创建、读写文件）
 *   - 翻译资源获取
 *
 * 修改日期:
 *   - 2026-02-21 重构：改为个人仓库模式，移除 Fork/Branch/PR 流程
 */

import I18N from "main";
import { I18nSettings } from "src/settings/data";
import { RequestUrlParam, requestUrl } from "obsidian";

export class GitHubAPI {
    i18n: I18N;
    settings: I18nSettings;

    /** 主仓库拥有者（用于获取翻译目录等） */
    owner = 'eondrcode';
    /** 主仓库名 */
    repo = 'obsidian-translations';

    /** 获取用户配置的个人翻译仓库名 */
    get userRepo(): string {
        return this.settings.shareRepo || '';
    }

    constructor(i18n: I18N) {
        this.i18n = i18n;
        this.settings = this.i18n.settings;
    }

    // ========== 通用辅助 ==========

    private get token(): string {
        return this.settings.shareToken;
    }

    private authHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Accept': 'application/vnd.github.v3+json',
        };
        if (this.token) {
            headers['Authorization'] = `token ${this.token}`;
        }
        return headers;
    }

    // ========== 用户信息 ==========

    /** 获取当前 Token 对应的 GitHub 用户信息 */
    public async getUser() {
        try {
            const params: RequestUrlParam = {
                url: `https://api.github.com/user`,
                method: 'GET',
                headers: this.authHeaders(),
            };
            const response = await requestUrl(params);
            // 从响应头解析权限范围
            const scopes = response.headers['x-oauth-scopes'] || '';
            return {
                state: true,
                data: response.json,
                scopes: scopes.split(',').map((s: string) => s.trim())
            };
        } catch (error) {
            return { state: false, data: error };
        }
    }

    // ========== 仓库管理 ==========

    /**
     * 检查用户名下是否存在指定仓库
     */
    public async checkRepoExists(username: string, repoName: string): Promise<{ state: boolean; data: any }> {
        try {
            const params: RequestUrlParam = {
                url: `https://api.github.com/repos/${username}/${repoName}`,
                method: 'GET',
                headers: this.authHeaders(),
            };
            const response = await requestUrl(params);
            return { state: true, data: response.json };
        } catch (error) {
            // 404 = 不存在
            return { state: false, data: error };
        }
    }

    /**
     * 获取仓库详细信息 (如 stargazers_count 等)
     */
    public async getRepoInfo(owner: string, repo: string): Promise<{ state: boolean; data: any }> {
        try {
            const params: RequestUrlParam = {
                url: `https://api.github.com/repos/${owner}/${repo}`,
                method: 'GET',
                headers: this.authHeaders(),
            };
            const response = await requestUrl(params);
            return { state: true, data: response.json };
        } catch (error) {
            return { state: false, data: error };
        }
    }

    /**
     * 获取最新 Release 信息
     */
    public async getLatestRelease(owner: string, repo: string): Promise<{ state: boolean; data: any }> {
        try {
            const params: RequestUrlParam = {
                url: `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
                method: 'GET',
                headers: this.authHeaders(),
            };
            const response = await requestUrl(params);
            return { state: true, data: response.json };
        } catch (error) {
            return { state: false, data: error };
        }
    }

    /**
     * 直接创建新的 GitHub 仓库
     * @param name 仓库名称
     */
    public async createRepo(name: string): Promise<{ state: boolean; data: any }> {
        try {
            const params: RequestUrlParam = {
                url: `https://api.github.com/user/repos`,
                method: 'POST',
                headers: {
                    ...this.authHeaders(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    description: 'My Obsidian plugin translations (created by obsidian-i18n)',
                    private: false,
                    auto_init: true,
                }),
            };
            const response = await requestUrl(params);
            return { state: true, data: response.json };
        } catch (error) {
            return { state: false, data: error };
        }
    }

    /**
     * 初始化仓库结构 — 创建空的 metadata.json
     * @param owner 仓库拥有者
     * @param repo 仓库名
     */
    public async initRepoStructure(owner: string, repo: string): Promise<{ state: boolean; data: any }> {
        try {
            // 检查 metadata.json 是否已存在
            const existing = await this.getFileContent(owner, repo, 'metadata.json');
            if (existing.state) {
                // 已存在，无需初始化
                return { state: true, data: 'already initialized' };
            }

            // 创建空的 metadata.json
            const content = Buffer.from('[]').toString('base64');
            return await this.uploadFile(
                owner, repo, 'metadata.json', content,
                'Initialize metadata.json'
            );
        } catch (error) {
            return { state: false, data: error };
        }
    }

    // ========== 文件操作 ==========

    /**
     * 获取仓库文件内容
     * @param owner 仓库拥有者
     * @param repo 仓库名
     * @param path 文件路径
     * @param ref 分支/标签 (可选)
     */
    public async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<{ state: boolean; data: any }> {
        try {
            let url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
            const separator = url.includes('?') ? '&' : '?';
            url += `${separator}t=${Date.now()}`;
            if (ref) url += `&ref=${ref}`;

            const params: RequestUrlParam = {
                url,
                method: 'GET',
                headers: this.authHeaders(),
            };
            const response = await requestUrl(params);
            return { state: true, data: response.json };
        } catch (error) {
            return { state: false, data: error };
        }
    }

    /**
     * 上传/更新文件到 GitHub 仓库
     * @param owner 仓库拥有者
     * @param repo 仓库名
     * @param path 仓库路径
     * @param content Base64 编码的文件内容
     * @param message 提交信息
     * @param branch 分支名称 (默认 main)
     */
    public async uploadFile(
        owner: string,
        repo: string,
        path: string,
        content: string,
        message: string,
        branch: string = 'main',
        shaFromExternal?: string
    ): Promise<{ state: boolean; data: any }> {
        try {
            if (!this.token) {
                return { state: false, data: '请先在设置中配置 GitHub Token' };
            }

            // 检查文件是否已存在（获取 sha 用于更新）
            let sha = shaFromExternal || '';
            if (!sha) {
                try {
                    const checkParams: RequestUrlParam = {
                        url: `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}&t=${Date.now()}`,
                        method: 'GET',
                        headers: this.authHeaders(),
                        throw: false,
                    };
                    const checkRes = await requestUrl(checkParams);
                    if (checkRes.status === 200) {
                        sha = checkRes.json.sha;
                    }
                } catch (e) {
                    // 文件不存在，新建
                }
            }

            const bodyPayload: any = {
                message,
                content,
                branch,
            };
            if (sha) {
                bodyPayload.sha = sha;
            }

            const params: RequestUrlParam = {
                url: `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
                method: 'PUT',
                headers: {
                    ...this.authHeaders(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bodyPayload),
                throw: false,
            };

            const response = await requestUrl(params);

            if (response.status >= 400) {
                const errorMsg = response.json?.message || response.text || `HTTP ${response.status}`;
                return { state: false, data: new Error(`GitHub 拒绝了上传 (Status ${response.status}): ${errorMsg}`) };
            }

            return { state: true, data: response.json };
        } catch (error) {
            console.error('GitHub uploadFile error:', error);
            return { state: false, data: error };
        }
    }

    /**
     * 删除 GitHub 仓库中的文件
     * @param owner 仓库拥有者
     * @param repo 仓库名
     * @param path 仓库路径
     * @param message 提交信息
     * @param branch 分支名称 (默认 main)
     */
    public async deleteFile(
        owner: string,
        repo: string,
        path: string,
        message: string,
        branch: string = 'main'
    ): Promise<{ state: boolean; data: any }> {
        try {
            if (!this.token) {
                return { state: false, data: '请先在设置中配置 GitHub Token' };
            }

            // 1. 获取文件的 SHA 以便能够删除它
            let sha = '';
            try {
                const checkParams: RequestUrlParam = {
                    url: `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}&t=${Date.now()}`,
                    method: 'GET',
                    headers: this.authHeaders(),
                    throw: false,
                };
                const checkRes = await requestUrl(checkParams);
                if (checkRes.status === 200) {
                    sha = checkRes.json.sha;
                } else {
                    return { state: false, data: '文件不存在' };
                }
            } catch (e) {
                return { state: false, data: '检查文件失败' };
            }

            // 2. 发起 DELETE 请求
            const params: RequestUrlParam = {
                url: `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
                method: 'DELETE',
                headers: {
                    ...this.authHeaders(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    sha,
                    branch,
                }),
                throw: false,
            };

            const response = await requestUrl(params);

            if (response.status >= 400) {
                const errorMsg = response.json?.message || response.text || `HTTP ${response.status}`;
                return { state: false, data: new Error(`GitHub 拒绝了删除 (Status ${response.status}): ${errorMsg}`) };
            }

            return { state: true, data: response.json };
        } catch (error) {
            console.error('GitHub deleteFile error:', error);
            return { state: false, data: error };
        }
    }

    // ========== 翻译资源（从主仓库获取） ==========

    /** 从主仓库获取翻译文件 */
    public async getTranslation(type: string, id: string, version: string) {
        try {
            const params: RequestUrlParam = {
                url: `https://raw.githubusercontent.com/${this.owner}/${this.repo}/refs/heads/master/translation/dict/${id}/zh-cn/${version}.json`,
                method: 'GET',
            };
            const response = await requestUrl(params);
            return { state: true, data: response.json };
        } catch (error) {
            return { state: false, data: '' };
        }
    }

    /** 获取翻译目录 */
    public async getDirectory(type: string) {
        try {
            const params: RequestUrlParam = {
                url: `https://raw.githubusercontent.com/${this.owner}/${this.repo}/refs/heads/master/translation/directory/zh-cn.json`,
                method: 'GET',
            };
            const response = await requestUrl(params);
            return { state: true, data: response.json };
        } catch (error) {
            return { state: false, data: error };
        }
    }

    /** 
     * 获取 raw 文件内容（无需认证，用于快速读取公开仓库文件）
     */
    public async getRawContent(owner: string, repo: string, path: string, branch: string = 'main'): Promise<{ state: boolean; data: any }> {
        try {
            // 注意：raw.githubusercontent.com 有 5 分钟 CDN 缓存
            // 我们通过添加随机参数尝试强制刷新，但在某些情况下仍可能受限
            const params: RequestUrlParam = {
                url: `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/${branch}/${path}?t=${Date.now()}`,
                method: 'GET',
            };
            const response = await requestUrl(params);
            return { state: true, data: response.json };
        } catch (error) {
            return { state: false, data: error };
        }
    }

    /**
     * 下载二进制或文本资产
     */
    public async downloadAsset(url: string): Promise<{ state: boolean; data: any }> {
        try {
            const params: RequestUrlParam = {
                url: url,
                method: 'GET',
            };
            const response = await requestUrl(params);
            // 这里根据实际需要返回 arraybuffer 还是 text
            return { state: true, data: response.arrayBuffer || response.text };
        } catch (error) {
            return { state: false, data: error };
        }
    }

    /** 检查是否已有同仓库正在申请收录的 Issue */
    public async checkHasOpenRegistrationIssue(targetOwner: string, targetRepo: string, repoAddress: string, creator: string): Promise<{ state: boolean; data: any; hasOpenIssue: boolean }> {
        try {
            if (!this.token) {
                return { state: false, data: '请先在设置中配置 GitHub Token', hasOpenIssue: false };
            }
            // 使用 issues 列表 API 代替 search API，避免 GitHub 的索引延迟导致能够连续创建多个 Issue
            // 移除 labels 过滤，因为普通用户提交 Issue 时无权限直接打标签（这需要仓库管理员或 Action 操作），会导致检测不到延迟添加的标签
            const issueUrl = `https://api.github.com/repos/${targetOwner}/${targetRepo}/issues?state=open&creator=${encodeURIComponent(creator)}&t=${Date.now()}`;
            const params: RequestUrlParam = { url: issueUrl, method: 'GET', headers: this.authHeaders(), };
            const response = await requestUrl(params);
            const issues = response.json;
            const hasOpenIssue = Array.isArray(issues) && issues.some((issue: any) =>
                issue.title.includes(repoAddress) || (issue.body && issue.body.includes(repoAddress))
            );
            return { state: true, data: issues, hasOpenIssue };
        } catch (error) {
            console.error('GitHub checkHasOpenRegistrationIssue error:', error);
            return { state: false, data: error, hasOpenIssue: false };
        }
    }

    /** 创建 GitHub Issue（支持指定目标仓库） */
    public async postIssue(title: string, body: string, label?: string, targetOwner?: string, targetRepo?: string) {
        try {
            if (!this.token) {
                return { state: false, data: '请先在设置中配置 GitHub Token' };
            }
            const issueOwner = targetOwner || this.owner;
            const issueRepo = targetRepo || this.repo;
            const params: RequestUrlParam = {
                url: `https://api.github.com/repos/${issueOwner}/${issueRepo}/issues`,
                method: 'POST',
                headers: {
                    ...this.authHeaders(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title,
                    body,
                    labels: label ? [label] : [],
                }),
            };
            const response = await requestUrl(params);
            return { state: true, data: response.json };
        } catch (error) {
            console.error('GitHub postIssue error:', error);
            return { state: false, data: error };
        }
    }

    // ========== 翻译历史与版本管理 ==========

    /**
     * 获取指定文件的提交历史
     * @param owner 仓库拥有者
     * @param repo 仓库名
     * @param path 文件路径
     * @param page 页码 (默认 1)
     * @param perPage 每页条数 (默认 20)
     */
    public async getFileCommits(
        owner: string,
        repo: string,
        path: string,
        page: number = 1,
        perPage: number = 20
    ): Promise<{ state: boolean; data: any }> {
        try {
            const params: RequestUrlParam = {
                url: `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodeURIComponent(path)}&page=${page}&per_page=${perPage}&t=${Date.now()}`,
                method: 'GET',
                headers: this.authHeaders(),
            };
            const response = await requestUrl(params);
            return { state: true, data: response.json };
        } catch (error) {
            console.error('GitHub getFileCommits error:', error);
            return { state: false, data: error };
        }
    }

    /**
     * 获取某次提交时文件的内容
     * @param owner 仓库拥有者
     * @param repo 仓库名
     * @param path 文件路径
     * @param ref commit SHA 或分支名
     */
    public async getFileAtCommit(
        owner: string,
        repo: string,
        path: string,
        ref: string
    ): Promise<{ state: boolean; data: any }> {
        try {
            const params: RequestUrlParam = {
                url: `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}&t=${Date.now()}`,
                method: 'GET',
                headers: this.authHeaders(),
            };
            const response = await requestUrl(params);
            return { state: true, data: response.json };
        } catch (error) {
            console.error('GitHub getFileAtCommit error:', error);
            return { state: false, data: error };
        }
    }

    /**
     * 获取仓库文件树 (用于列出 plugins/ 目录下所有文件)
     * @param owner 仓库拥有者
     * @param repo 仓库名
     * @param treeSha 树的 SHA (默认 'main')
     * @param recursive 是否递归 (默认 true)
     */
    public async getRepoTree(
        owner: string,
        repo: string,
        treeSha: string = 'main',
        recursive: boolean = true
    ): Promise<{ state: boolean; data: any }> {
        try {
            const params: RequestUrlParam = {
                url: `https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}${recursive ? '?recursive=1' : ''}&t=${Date.now()}`,
                method: 'GET',
                headers: this.authHeaders(),
            };
            const response = await requestUrl(params);
            return { state: true, data: response.json };
        } catch (error) {
            console.error('GitHub getRepoTree error:', error);
            return { state: false, data: error };
        }
    }
}
