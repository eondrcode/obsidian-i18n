import * as path from 'path';
import * as fs from 'fs-extra';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export class BackupManager {
    private backupDir: string;

    constructor(basePath: string) {
        // basePath 应该是 i18n 插件的根目录
        this.backupDir = path.join(basePath, 'backups');
        fs.ensureDirSync(this.backupDir);
    }

    /**
     * 获取备份文件的压缩路径 (.js.gz) (旧版兼容)
     */
    public getLegacyBackupPath(pluginId: string): string {
        return path.join(this.backupDir, `${pluginId}.js.gz`);
    }

    /**
     * 获取旧版备份文件的路径 (.js) - 用于兼容性检查 (旧旧版兼容)
     */
    public getLegacyUncompressedBackupPath(pluginId: string): string {
        return path.join(this.backupDir, `${pluginId}.js`);
    }

    /**
     * 获取当前多文件备份所在文件夹路径
     */
    public getPluginBackupDir(pluginId: string): string {
        return path.join(this.backupDir, pluginId);
    }


    /**
     * 创建多文件备份 (压缩)
     * @param pluginId 目标插件ID
     * @param pluginDir 插件工作目录
     * @param files 需要备份的文件列表 (相对 pluginDir 的路径，如 ['main.js', 'styles.css'])
     * @param force 是否强制覆盖现有备份 (默认为 false)
     * @returns boolean 备份是否成功
     */
    public async createBackup(pluginId: string, pluginDir: string, files: string[], force: boolean = false): Promise<boolean> {
        const pluginBackupDir = this.getPluginBackupDir(pluginId);

        try {
            await fs.ensureDir(pluginBackupDir);

            for (const file of files) {
                const originalPath = path.join(pluginDir, file);
                const backupPath = path.join(pluginBackupDir, `${file}.gz`);

                // 确保文件的父级目录存在 (应对带子目录的情况，如 'lang/zh-cn.js')
                await fs.ensureDir(path.dirname(backupPath));

                // 如果文件本身就不存在，跳过
                if (!(await fs.pathExists(originalPath))) continue;

                // 如果备份已存在且未强制覆盖，跳过该文件
                if (await fs.pathExists(backupPath) && !force) {
                    continue;
                }

                // 读取原始文件
                const content = await fs.readFile(originalPath);
                // 压缩
                const compressed = await gzip(content);
                // 写入压缩文件
                await fs.writeFile(backupPath, compressed);
            }

            // 可选：清理可能存在的旧备份，节省空间
            await this.removeLegacyBackups(pluginId);

            return true;
        } catch (error) {
            console.error(`[i18n] Backup failed for [${pluginId}]:`, error);
            return false;
        }
    }

    /**
     * 还原备份 (自动解压)
     * @param pluginId 目标插件ID
     * @param pluginDir 还原目标插件目录
     * @returns boolean 还原是否成功
     */
    public async restoreBackup(pluginId: string, pluginDir: string): Promise<boolean> {
        const pluginBackupDir = this.getPluginBackupDir(pluginId);
        const legacyPath = this.getLegacyBackupPath(pluginId);
        const legacyUncompressedPath = this.getLegacyUncompressedBackupPath(pluginId);

        try {
            let restored = false;

            // 1. 优先尝试还原新版多文件备份
            if (await fs.pathExists(pluginBackupDir)) {
                // 递归遍历备份目录
                const restoreFiles = async (dir: string, baseDir: string) => {
                    const entries = await fs.readdir(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry.name);
                        if (entry.isDirectory()) {
                            await restoreFiles(fullPath, baseDir);
                        } else if (entry.isFile() && entry.name.endsWith('.gz')) {
                            // 还原文件
                            const relPath = path.relative(baseDir, fullPath).replace(/\.gz$/, '');
                            const targetPath = path.join(pluginDir, relPath);

                            // 确保目标父目录存在
                            await fs.ensureDir(path.dirname(targetPath));

                            const compressed = await fs.readFile(fullPath);
                            const content = await gunzip(compressed);
                            await fs.writeFile(targetPath, content);
                            restored = true;
                        }
                    }
                };

                await restoreFiles(pluginBackupDir, pluginBackupDir);
                await fs.remove(pluginBackupDir);

                return restored; // 即使内容为空，但只要走到了这里通常代表新备份目录操作结束
            }

            // 2. 兼容性：尝试还原旧版的单文件 main.js (.gz)
            if (await fs.pathExists(legacyPath)) {
                const targetPath = path.join(pluginDir, 'main.js');
                const compressed = await fs.readFile(legacyPath);
                const content = await gunzip(compressed);
                await fs.writeFile(targetPath, content);
                await fs.remove(legacyPath);
                return true;
            }

            // 3. 兼容性：尝试还原未压缩的旧旧版备份
            if (await fs.pathExists(legacyUncompressedPath)) {
                const targetPath = path.join(pluginDir, 'main.js');
                await fs.copy(legacyUncompressedPath, targetPath, { overwrite: true });
                await fs.remove(legacyUncompressedPath);
                return true;
            }

            return false; // 无任何可用备份
        } catch (error) {
            console.error(`[i18n] Restore failed for [${pluginId}]:`, error);
            return false;
        }
    }

    /**
     * 检查备份是否存在
     */
    public hasBackup(pluginId: string): boolean {
        return fs.existsSync(this.getPluginBackupDir(pluginId)) ||
            fs.existsSync(this.getLegacyBackupPath(pluginId)) ||
            fs.existsSync(this.getLegacyUncompressedBackupPath(pluginId));
    }

    /**
     * 获取备份文件内容 (自动解压)
     */
    public async getBackupContent(pluginId: string, file: string): Promise<string | null> {
        const pluginBackupDir = this.getPluginBackupDir(pluginId);
        const backupPath = path.join(pluginBackupDir, `${file}.gz`);

        if (await fs.pathExists(backupPath)) {
            const compressed = await fs.readFile(backupPath);
            const content = await gunzip(compressed);
            return content.toString();
        }

        // 兼容单文件老版本 (仅限 main.js)
        if (file === 'main.js') {
            const legacyPath = this.getLegacyBackupPath(pluginId);
            if (await fs.pathExists(legacyPath)) {
                const compressed = await fs.readFile(legacyPath);
                const content = await gunzip(compressed);
                return content.toString();
            }
        }

        return null;
    }

    /**
     * 清理所有类型备份文件
     */
    public async removeBackup(pluginId: string): Promise<void> {
        const pluginBackupDir = this.getPluginBackupDir(pluginId);
        if (await fs.pathExists(pluginBackupDir)) {
            await fs.remove(pluginBackupDir);
        }
        await this.removeLegacyBackups(pluginId);
    }

    /**
     * 清理旧版本备份文件
     */
    private async removeLegacyBackups(pluginId: string): Promise<void> {
        const legacyPath = this.getLegacyBackupPath(pluginId);
        if (await fs.pathExists(legacyPath)) {
            await fs.remove(legacyPath);
        }

        const legacyUncompressedPath = this.getLegacyUncompressedBackupPath(pluginId);
        if (await fs.pathExists(legacyUncompressedPath)) {
            await fs.remove(legacyUncompressedPath);
        }
    }
}
