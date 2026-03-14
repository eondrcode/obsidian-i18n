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
    repo = 'obsidian-i18n-resources';

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

    private wrapError(error: any): { state: false; data: any; isRateLimit: boolean } {
        const isRateLimit = !!(error?.status === 403 && (error?.text?.includes('rate limit') || error?.json?.message?.includes('rate limit')));
        return { state: false, data: error, isRateLimit };
    }

    // ========== 用户信息 ==========

    /** 获取当前 Token 对应的 GitHub 用户信息 */
    public async getUser(): Promise<
        { state: true; data: any; scopes: string[] } | 
        { state: false; data: any; isRateLimit?: boolean }
    > {
        try {
            const params: RequestUrlParam = {
                url: `https://api.github.com/user`,
                method: 'GET',
                headers: this.authHeaders(),
            };
            const response = await requestUrl(params);
            // 从响应头解析权限范围
            const scopesStr = response.headers['x-oauth-scopes'] || '';
            const scopes = scopesStr.split(',').map((s: string) => s.trim()).filter(Boolean);
            
            return {
                state: true,
                data: response.json,
                scopes: scopes
            };
        } catch (error: any) {
            return this.wrapError(error);
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
     * 获取文件内容（带大文件降级）
     * 对于超过 1MB 的文件，Contents API 不返回 content 字段，
     * 此方法会自动降级到 raw.githubusercontent.com 节点。
     * 返回的 data 直接是解析后的 JSON 对象（如果文件是 JSON），或者是文本内容。
     */
    public async getFileContentWithFallback(
        owner: string, repo: string, path: string, branch: string = 'main'
    ): Promise<{ state: boolean; data: any; isRateLimit?: boolean }> {
        // 策略 1: 先尝试普通 Contents API（带 Auth）
        try {
            const res = await this.getFileContent(owner, repo, path, branch);
            if (res.state && res.data) {
                // 如果有 content 字段，直接解码返回
                if (res.data.content) {
                    const decoded = Buffer.from(res.data.content, 'base64').toString('utf-8');
                    try {
                        return { state: true, data: JSON.parse(decoded) };
                    } catch {
                        return { state: true, data: decoded };
                    }
                }
                // 大文件场景：虽然 Contents API 成功，但没有 content 字段（通常会有 download_url）
                if (res.data.download_url) {
                    const rawRes = await requestUrl({ url: res.data.download_url, method: 'GET' });
                    return { state: true, data: rawRes.json || rawRes.text };
                }
            } else if (res.data?.status === 403) {
                // 可能是频率限制，记录状态但继续尝试 Raw 降级
                const isRateLimit = res.data?.text?.includes('rate limit') || res.data?.json?.message?.includes('rate limit');
                if (isRateLimit) {
                    // 如果是频率限制且没有 Token，API 大概率会一直失败，直接尝试 Raw
                }
            }
        } catch (e) {
            // 继续尝试下一种方案
        }

        // 策略 2: 通过 raw.githubusercontent.com 直接获取（避开 Contents API 1MB 限制和某些 403）
        try {
            const rawRes = await this.getRawContent(owner, repo, path, branch);
            if (rawRes.state && rawRes.data) {
                return { state: true, data: rawRes.data };
            }
            
            // 如果 Raw 也失败了，且之前有 API 失败记录，检查是否是频率限制
            if (rawRes.data?.status === 403 || rawRes.data?.status === 429) {
                 return { state: false, data: rawRes.data, isRateLimit: true };
            }
        } catch (e) {
            // raw 节点也失败
        }

        return { state: false, data: 'Cannot fetch file content' };
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
                url: `https://raw.githubusercontent.com/${this.owner}/${this.repo}/master/translation/dict/${id}/zh-cn/${version}.json`,
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
                url: `https://raw.githubusercontent.com/${this.owner}/${this.repo}/master/translation/directory/zh-cn.json`,
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
                url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}?t=${Date.now()}`,
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

    /**
     * 获取引用 (Ref) 的详细信息，主要是为了拿到最新的 Commit SHA
     */
    public async getRef(owner: string, repo: string, ref: string = 'heads/main'): Promise<{ state: boolean; data: any }> {
        try {
            const params: RequestUrlParam = {
                url: `https://api.github.com/repos/${owner}/${repo}/git/refs/${ref}?t=${Date.now()}`,
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
     * 创建一个新的 Tree 对象
     * @param treeData 
     * [
     *   {
     *     "path": "file.rb",
     *     "mode": "100644",
     *     "type": "blob",
     *     "content": "..."
     *   }
     * ]
     */
    public async createTree(owner: string, repo: string, baseTree: string, treeData: any[]): Promise<{ state: boolean; data: any }> {
        try {
            const params: RequestUrlParam = {
                url: `https://api.github.com/repos/${owner}/${repo}/git/trees`,
                method: 'POST',
                headers: {
                    ...this.authHeaders(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    base_tree: baseTree,
                    tree: treeData
                }),
            };
            const response = await requestUrl(params);
            return { state: true, data: response.json };
        } catch (error) {
            return { state: false, data: error };
        }
    }

    /**
     * 创建一个新的 Commit 对象
     */
    public async createCommit(owner: string, repo: string, message: string, tree: string, parents: string[]): Promise<{ state: boolean; data: any }> {
        try {
            const params: RequestUrlParam = {
                url: `https://api.github.com/repos/${owner}/${repo}/git/commits`,
                method: 'POST',
                headers: {
                    ...this.authHeaders(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    tree,
                    parents
                }),
            };
            const response = await requestUrl(params);
            return { state: true, data: response.json };
        } catch (error) {
            return { state: false, data: error };
        }
    }

    /**
     * 更新引用指向新的 Commit
     */
    public async updateRef(owner: string, repo: string, ref: string, sha: string): Promise<{ state: boolean; data: any }> {
        try {
            const params: RequestUrlParam = {
                url: `https://api.github.com/repos/${owner}/${repo}/git/refs/${ref}`,
                method: 'PATCH',
                headers: {
                    ...this.authHeaders(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sha,
                    force: false // 默认不强制，保证安全
                }),
            };
            const response = await requestUrl(params);
            return { state: true, data: response.json };
        } catch (error) {
            return { state: false, data: error };
        }
    }

    /**
     * 批量上传文件封装函数
     * @param files 数组，每个元素包含 path 和 content (UTF-8 字符串)
     */
    public async batchUploadFiles(
        owner: string,
        repo: string,
        files: { path: string; content: string }[],
        message: string,
        branch: string = 'main'
    ): Promise<{ state: boolean; data: any }> {
        try {
            if (!this.token) return { state: false, data: '请先在设置中配置 GitHub Token' };
            if (files.length === 0) return { state: true, data: 'no files to upload' };

            // 1. 获取最新 Commit
            const refRes = await this.getRef(owner, repo, `heads/${branch}`);
            if (!refRes.state) return { state: false, data: `获取分支信息失败: ${refRes.data}` };
            const lastCommitSha = refRes.data.object.sha;

            // 2. 获取该 Commit 的 Tree SHA
            const commitDetailParams: RequestUrlParam = {
                url: `https://api.github.com/repos/${owner}/${repo}/git/commits/${lastCommitSha}`,
                method: 'GET',
                headers: this.authHeaders(),
            };
            const commitDetailRes = await requestUrl(commitDetailParams);
            const baseTreeSha = commitDetailRes.json.tree.sha;

            // 3. 创建新的 Tree
            const treeItems = files.map(f => ({
                path: f.path,
                mode: '100644', // 普通文本文件
                type: 'blob',
                content: f.content
            }));
            const newTreeRes = await this.createTree(owner, repo, baseTreeSha, treeItems);
            if (!newTreeRes.state) return { state: false, data: `创建 Tree 失败: ${newTreeRes.data}` };
            const newTreeSha = newTreeRes.data.sha;

            // 4. 创建新 Commit
            const newCommitRes = await this.createCommit(owner, repo, message, newTreeSha, [lastCommitSha]);
            if (!newCommitRes.state) return { state: false, data: `创建 Commit 失败: ${newCommitRes.data}` };
            const newCommitSha = newCommitRes.data.sha;

            // 5. 更新 Ref
            const updateRefRes = await this.updateRef(owner, repo, `heads/${branch}`, newCommitSha);
            if (!updateRefRes.state) return { state: false, data: `更新引用失败: ${updateRefRes.data}` };

            return { state: true, data: updateRefRes.data };
        } catch (error) {
            console.error('GitHub batchUploadFiles error:', error);
            return { state: false, data: error };
        }
    }
}
