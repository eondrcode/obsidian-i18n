import React, { useEffect, useRef, useMemo } from 'react';
import { MarkdownRenderer, Component } from 'obsidian';
import { useGlobalStoreInstance } from '~/utils';
import { cn } from '~/shadcn/lib/utils';

interface MarkdownViewerProps {
    content: string;
    owner?: string;
    repo?: string;
    branch?: string;
}

/**
 * 使用 Obsidian 原生渲染引擎的 Markdown 组件
 * 完美支持 Callouts, Mermaid 等原生样式，并集成 GitHub 资源重写
 */
export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content, owner: initialOwner, repo: initialRepo, branch = 'main' }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const i18n = useGlobalStoreInstance.getState().i18n;

    // 规范化 owner 和 repo
    const [owner, repo] = useMemo(() => {
        let o = initialOwner || '';
        let r = initialRepo || '';
        if (o.includes('github.com')) {
            const parts = o.replace(/https?:\/\/github\.com\//, '').split('/');
            o = parts[0] || '';
            r = parts[1] || r;
        } else if (o.includes('/')) {
            const parts = o.split('/');
            o = parts[0] || '';
            r = parts[1] || r;
        }
        return [o.trim(), r.trim()];
    }, [initialOwner, initialRepo]);

    // 重写 URL 逻辑 (同前)
    const getFullUrl = (url: string | undefined, currentBranch: string, isImage: boolean) => {
        if (!url) return '';
        if (url.startsWith('http') || url.startsWith('//') || url.startsWith('data:')) {
            if (isImage && url.includes('github.com')) {
                const blobMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/(blob|raw)\/([^\/]+)\/(.+)/);
                if (blobMatch) {
                    const [_, o, r, type, b, p] = blobMatch;
                    return `https://cdn.jsdelivr.net/gh/${o}/${r}@${b}/${p}`;
                }
            }
            if (isImage && url.includes('raw.githubusercontent.com')) {
                const rawMatch = url.match(/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(.+)/);
                if (rawMatch) {
                    const [_, o, r, b, p] = rawMatch;
                    return `https://cdn.jsdelivr.net/gh/${o}/${r}@${b}/${p}`;
                }
            }
            return url;
        }
        if (!owner || !repo) return url;
        const cleanPath = url.replace(/^\.?\//, '');
        const encodedPath = cleanPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
        if (isImage) {
            return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${currentBranch}/${encodedPath}`;
        } else {
            return `https://github.com/${owner}/${repo}/blob/${currentBranch}/${encodedPath}`;
        }
    };

    // 预处理内容
    const processedContent = useMemo(() => {
        if (!content) return '';
        let c = content;

        // 1. 转换 HTML img 到 Markdown
        c = c.replace(/<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']+)["'][^>]*\/?>/gi, (match, src, alt) => `![${alt}](${src})`);
        c = c.replace(/<img[^>]+alt=["']([^"']+)["'][^>]*src=["']([^"']+)["'][^>]*\/?>/gi, (match, alt, src) => `![${alt}](${src})`);
        c = c.replace(/<img[^>]+src=["']([^"']+)["'][^>]*\/?>/gi, (match, src) => `![](${src})`);

        // 2. 重写 Markdown 中的相对图片链接
        // 匹配 ![alt](url)
        c = c.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
            return `![${alt}](${getFullUrl(url, branch, true)})`;
        });

        // 3. 重写 Markdown 中的相对普通链接
        // 匹配 [text](url) (排除图片)
        c = c.replace(/(?<!\!)\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
            return `[${text}](${getFullUrl(url, branch, false)})`;
        });

        return c;
    }, [content, owner, repo, branch]);

    useEffect(() => {
        if (!containerRef.current || !processedContent) return;

        const container = containerRef.current;
        container.empty();
        container.addClass('markdown-rendered');
        container.addClass('obsidian-i18n-readme');

        const component = new Component();
        component.load();

        // 使用 Obsidian 原生渲染器
        MarkdownRenderer.render(i18n.app, processedContent, container, '', component).then(() => {
            // 后处理：添加图片点击交互
            const imgs = container.querySelectorAll('img');
            imgs.forEach((img: HTMLImageElement) => {
                img.addClass('cursor-pointer');
                img.addClass('hover:opacity-90');
                img.addClass('transition-opacity');
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.addEventListener('click', () => {
                    if (img.src) window.open(img.src);
                });
            });

            // 处理链接在新窗口打开
            const links = container.querySelectorAll('a');
            links.forEach((link: HTMLAnchorElement) => {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
            });
        });

        return () => {
            component.unload();
        };
    }, [processedContent, i18n]);

    return (
        <div
            ref={containerRef}
            className="markdown-container native-markdown-view max-w-none"
        />
    );
};
