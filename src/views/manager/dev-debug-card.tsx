import React, { useState, useRef, useEffect } from 'react';
import I18N from 'src/main';
import { Notice } from 'obsidian';
import * as path from 'path';

interface DevDebugCardProps {
    i18n: I18N;
}

export const DevDebugCard: React.FC<DevDebugCardProps> = ({ i18n }) => {
    const [isActionRunning, setIsActionRunning] = useState(false);

    // 拖拽相关状态
    const [position, setPosition] = useState(() => {
        const saved = localStorage.getItem('i18n-debug-pos');
        return saved ? JSON.parse(saved) : { x: window.innerWidth - 260, y: 100 };
    });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const cardRef = useRef<HTMLDivElement>(null);

    // 主题适配
    const [isDark, setIsDark] = useState(document.body.classList.contains('theme-dark'));

    useEffect(() => {
        const syncTheme = () => setIsDark(document.body.classList.contains('theme-dark'));
        const observer = new MutationObserver(syncTheme);
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    // 拖拽逻辑
    const onMouseDown = (e: React.MouseEvent) => {
        if (cardRef.current) {
            const rect = cardRef.current.getBoundingClientRect();
            dragOffset.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            setIsDragging(true);
        }
    };

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const pos = {
                x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - 240)),
                y: Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 100))
            };
            setPosition(pos);
            localStorage.setItem('i18n-debug-pos', JSON.stringify(pos));
        };
        const onMouseUp = () => setIsDragging(false);
        if (isDragging) {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [isDragging]);

    // 功能函数
    const handleReload = async () => {
        setIsActionRunning(true);
        try {
            // @ts-ignore
            await i18n.app.plugins.disablePlugin(i18n.manifest.id);
            // @ts-ignore
            await i18n.app.plugins.enablePlugin(i18n.manifest.id);
            new Notice('I18N: 插件已重载');
        } finally {
            setIsActionRunning(false);
        }
    };

    const handleSnapshot = () => {
        console.log('🛠️ i18n Snapshot:', {
            settings: i18n.settings,
            states: i18n.stateManager.getAllPluginStates(),
            sources: i18n.sourceManager.getAllSources()
        });
        new Notice('快照已存至控制台');
    };

    const handleClearCache = async () => {
        if (!confirm('清理云端缓存？')) return;
        const manager = i18n.sourceManager;
        manager.getAllSources().filter(s => s.origin === 'cloud').forEach(s => manager.deleteSource(s.id));
        new Notice('缓存已清理');
    };

    const handleSync = () => i18n.autoManager.runSmartAuto();

    // 一键还原
    const handleOneClickRestore = async () => {
        if (!confirm('确定要还原所有已应用翻译的插件吗？这将恢复源码备份。')) return;
        setIsActionRunning(true);
        try {
            const states = Object.values(i18n.stateManager.getAllPluginStates());
            let count = 0;
            for (const state of states) {
                if (state.isApplied) {
                    // @ts-ignore
                    const plugin = i18n.app.plugins.manifests[state.id];
                    if (!plugin) continue;

                    // @ts-ignore
                    const pluginDir = path.join(path.normalize(i18n.app.vault.adapter.getBasePath()), plugin.dir ?? '');

                    const success = await i18n.backupManager.restoreBackup(state.id, pluginDir);
                    if (success) {
                        i18n.stateManager.setPluginState(state.id, { ...state, isApplied: false });
                        // @ts-ignore
                        if (i18n.app.plugins.enabledPlugins.has(state.id)) {
                            // @ts-ignore
                            await i18n.app.plugins.disablePlugin(state.id);
                            // @ts-ignore
                            await i18n.app.plugins.enablePlugin(state.id);
                        }
                        count++;
                    }
                }
            }
            new Notice(`已成功还原 ${count} 个插件`);
        } catch (e) {
            console.error(e);
            new Notice('还原失败，请检查控制台');
        } finally {
            setIsActionRunning(false);
        }
    };

    // 一键替换 (重新注入)
    const handleOneClickReplace = async () => {
        if (!confirm('确定要强制重新应用所有当前翻译吗？')) return;
        setIsActionRunning(true);
        try {
            const states = Object.values(i18n.stateManager.getAllPluginStates());
            let count = 0;
            for (const state of states) {
                if (state.isApplied) {
                    const success = await i18n.injectorManager.applyToPlugin(state.id);
                    if (success) count++;
                }
            }
            new Notice(`已重新应用 ${count} 个插件翻译`);
        } catch (e) {
            console.error(e);
            new Notice('替换失败，请检查控制台');
        } finally {
            setIsActionRunning(false);
        }
    };

    // [新增] 删除所有翻译文件
    const handleDeleteAll = async () => {
        if (!confirm('🛑 警告：确定要删除所有本地翻译文件吗？此操作不可撤销！')) return;

        const shouldRestore = confirm('在删除文件前，是否先将所有插件还原为原始源码状态？\n(建议选择“是”，否则已被翻译的插件将保持翻译状态且无法通过插件还原)');

        setIsActionRunning(true);
        try {
            if (shouldRestore) {
                await handleOneClickRestore();
            }

            // 清理文件和元数据
            i18n.sourceManager.clearAll();
            // 清理应用状态
            i18n.stateManager.clearAllStates();

            new Notice('所有翻译文件及重置状态已清理完毕');
        } catch (e) {
            console.error(e);
            new Notice('清理失败，请查看控制台');
        } finally {
            setIsActionRunning(false);
        }
    };

    // 基础样式定义
    const colors = isDark ? {
        bg: '#1e1e1e',
        border: '#444',
        text: '#ddd',
        headerBg: '#4a1515',
        btnBg: '#333',
        btnHover: '#444'
    } : {
        bg: '#fff',
        border: '#ccc',
        text: '#333',
        headerBg: '#fee2e2',
        btnBg: '#f3f4f6',
        btnHover: '#e5e7eb'
    };

    return (
        <div
            ref={cardRef}
            style={{
                position: 'fixed',
                left: position.x + 'px',
                top: position.y + 'px',
                width: '240px',
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                zIndex: 10000,
                color: colors.text,
                fontFamily: 'sans-serif',
                overflow: 'hidden',
                userSelect: 'none'
            }}
        >
            {/* Header / Drag Handle */}
            <div
                onMouseDown={onMouseDown}
                style={{
                    padding: '10px 12px',
                    backgroundColor: colors.headerBg,
                    cursor: 'move',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    borderBottom: `1px solid ${colors.border}`
                }}
            >
                <span>🛠️ I18N DEBUGGER</span>
                <span style={{ fontSize: '10px', opacity: 0.7 }}>DEV</span>
            </div>

            {/* Content */}
            <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                    onClick={handleReload}
                    disabled={isActionRunning}
                    style={{
                        padding: '8px',
                        fontSize: '11px',
                        backgroundColor: colors.btnBg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    {isActionRunning ? '♻️...' : '♻️ 重载'}
                </button>
                <button
                    onClick={handleSnapshot}
                    style={{
                        padding: '8px',
                        fontSize: '11px',
                        backgroundColor: colors.btnBg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    📸 快照
                </button>
                <button
                    onClick={handleSync}
                    style={{
                        padding: '8px',
                        fontSize: '11px',
                        backgroundColor: colors.btnBg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    ⚡ 同步
                </button>
                <button
                    onClick={handleClearCache}
                    style={{
                        padding: '8px',
                        fontSize: '11px',
                        backgroundColor: colors.btnBg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    🗑️ 清理
                </button>

                {/* 底部功能区 */}
                <button
                    onClick={handleOneClickRestore}
                    disabled={isActionRunning}
                    style={{
                        padding: '8px',
                        fontSize: '11px',
                        backgroundColor: isDark ? '#2d1a1a' : '#fff1f1',
                        color: isDark ? '#ff9999' : '#c53030',
                        border: `1px solid ${isDark ? '#5c2d2d' : '#fbcfe8'}`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        gridColumn: 'span 2'
                    }}
                >
                    ⏪ 一键还原 (恢复源码)
                </button>
                <button
                    onClick={handleOneClickReplace}
                    disabled={isActionRunning}
                    style={{
                        padding: '8px',
                        fontSize: '11px',
                        backgroundColor: isDark ? '#1a2d1a' : '#f1fff1',
                        color: isDark ? '#99ff99' : '#2f855a',
                        border: `1px solid ${isDark ? '#2d5c2d' : '#c6f6d5'}`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        gridColumn: 'span 2'
                    }}
                >
                    🔄 一键替换 (重新翻译)
                </button>
                <button
                    onClick={handleDeleteAll}
                    disabled={isActionRunning}
                    style={{
                        padding: '8px',
                        fontSize: '11px',
                        backgroundColor: isDark ? '#3d0a0a' : '#742a2a',
                        color: '#fff',
                        border: `1px solid #000`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        gridColumn: 'span 2',
                        marginTop: '4px',
                        fontWeight: 'bold'
                    }}
                >
                    💀 彻底删除所有译文
                </button>
            </div>

            {/* Footer */}
            <div style={{ padding: '8px 12px', fontSize: '10px', opacity: 0.6, borderTop: `1px solid ${colors.border}` }}>
                AutoUpdate: {i18n.settings.automaticUpdate ? '✅' : '❌'}<br />
                Native HTML/CSS Debugger.
            </div>
        </div>
    );
};
