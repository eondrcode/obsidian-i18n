import * as path from 'path';
import * as fs from 'fs-extra';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const BACKUP_METADATA_FILE = '.backup-info.json';

interface BackupMetadata {
    version: string;
    files?: string[];
}

/** 同一资源的应用和恢复共用会话，覆盖文件、状态及重载的完整操作。 */
export interface BackupSession {
    createBackup(pluginDir: string, files: string[], force?: boolean): Promise<boolean>;
    getBackupContent(file: string, pluginDir?: string): Promise<string | null>;
    restoreBackup(pluginDir: string): Promise<boolean>;
}

export class BackupManager {
    private backupDir: string;
    private pendingOperations = new Map<string, Promise<unknown>>();

    constructor(basePath: string, private getLegacyVersion?: (id: string) => string | undefined) {
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

    private getVersionPath(pluginId: string): string {
        return path.join(this.getPluginBackupDir(pluginId), BACKUP_METADATA_FILE);
    }

    private getPendingPath(pluginId: string): string {
        return path.join(this.backupDir, '.pending', `${pluginId}.json`);
    }

    private async withResourceLock<T>(pluginId: string, operation: () => Promise<T>): Promise<T> {
        const previous = this.pendingOperations.get(pluginId) ?? Promise.resolve();
        const current = previous.catch(() => undefined).then(operation);
        this.pendingOperations.set(pluginId, current);
        try {
            return await current;
        } finally {
            if (this.pendingOperations.get(pluginId) === current) {
                this.pendingOperations.delete(pluginId);
            }
        }
    }

    public async withBackupSession<T>(pluginId: string, operation: (backup: BackupSession) => Promise<T>): Promise<T> {
        return this.withResourceLock(pluginId, () => operation({
            createBackup: (pluginDir, files, force = false) => this.createSnapshot(pluginId, pluginDir, files, force),
            getBackupContent: (file, pluginDir) => this.readBackupContent(pluginId, file, pluginDir),
            restoreBackup: pluginDir => this.restoreSnapshot(pluginId, pluginDir)
        }));
    }

    /** 恢复上次交换中断时移走的原始快照，不能把已汉化文件重新备份为原文。 */
    private async recoverPendingSnapshot(pluginId: string): Promise<void> {
        const pendingPath = this.getPendingPath(pluginId);
        if (!(await fs.pathExists(pendingPath))) return;

        const pending = await fs.readJson(pendingPath);
        const previousDir = pending.previousDir;
        if (typeof previousDir !== 'string' || path.basename(previousDir) !== previousDir
            || !previousDir.startsWith('.snapshot-') || !previousDir.endsWith('.previous')) {
            throw new Error('备份交换记录无效，已停止操作');
        }

        const backupDir = this.getPluginBackupDir(pluginId);
        if (!(await fs.pathExists(backupDir))) {
            const previousPath = path.join(this.backupDir, previousDir);
            await fs.rename(previousPath, backupDir);
        }
        await fs.remove(pendingPath);
    }

    /** 在状态版本变化前，为旧格式备份保留来源版本。 */
    public async preserveLegacyVersion(pluginId: string, version: string): Promise<void> {
        await this.withResourceLock(pluginId, async () => {
            await this.recoverPendingSnapshot(pluginId);
            if (this.hasBackup(pluginId) && !(await fs.pathExists(this.getVersionPath(pluginId)))) {
                if (!version) throw new Error('无法确认旧备份的来源版本');
                await fs.outputJson(this.getVersionPath(pluginId), { version });
            }
        });
    }

    private async readMetadata(pluginId: string): Promise<BackupMetadata | undefined> {
        const versionPath = this.getVersionPath(pluginId);
        if (!(await fs.pathExists(versionPath))) return undefined;

        const metadata = await fs.readJson(versionPath);
        if (!metadata || typeof metadata.version !== 'string' || !metadata.version) {
            throw new Error('备份版本信息无效');
        }
        if (metadata.files !== undefined && (!Array.isArray(metadata.files) || metadata.files.length === 0
            || metadata.files.some((file: unknown) => typeof file !== 'string' || !file))) {
            throw new Error('备份文件清单无效');
        }
        return metadata as BackupMetadata;
    }

    private async getBackupVersion(pluginId: string): Promise<string | undefined> {
        const metadata = await this.readMetadata(pluginId);
        return metadata?.version ?? this.getLegacyVersion?.(pluginId);
    }

    private async getCurrentVersion(pluginDir: string): Promise<string> {
        const manifest = await fs.readJson(path.join(pluginDir, 'manifest.json'));
        if (typeof manifest.version !== 'string' || !manifest.version) {
            throw new Error('无法确认当前插件或主题版本');
        }
        return manifest.version;
    }

    private async checkVersion(pluginId: string, pluginDir: string): Promise<void> {
        const backupVersion = await this.getBackupVersion(pluginId);
        const currentVersion = await this.getCurrentVersion(pluginDir);
        if (!backupVersion || backupVersion !== currentVersion) {
            throw new Error('备份来源版本与当前版本不一致，已停止使用旧备份');
        }
    }

    /** 先完整解压校验，再允许调用方写入，避免损坏备份造成部分恢复。 */
    private async readSnapshot(pluginId: string): Promise<Map<string, Buffer>> {
        const contents = new Map<string, Buffer>();
        const backupDir = this.getPluginBackupDir(pluginId);
        const metadata = await this.readMetadata(pluginId);
        const readDirectory = async (dir: string) => {
            for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await readDirectory(fullPath);
                } else if (entry.isFile() && entry.name.endsWith('.gz')) {
                    const file = path.relative(backupDir, fullPath).replace(/\.gz$/, '');
                    contents.set(file, await gunzip(await fs.readFile(fullPath)));
                }
            }
        };
        if (await fs.pathExists(backupDir)) await readDirectory(backupDir);

        if (metadata?.files) {
            const expectedFiles = new Set(metadata.files.map(file => path.normalize(file)));
            if (contents.size !== expectedFiles.size || [...expectedFiles].some(file => !contents.has(file))) {
                throw new Error('备份文件缺失或清单不一致，已停止使用该备份');
            }
        } else if (!contents.has('main.js')) {
            // 旧版可能同时留下部分多文件备份和单文件原文，应按文件合并。
            const legacyPath = this.getLegacyBackupPath(pluginId);
            const uncompressedPath = this.getLegacyUncompressedBackupPath(pluginId);
            if (await fs.pathExists(legacyPath)) {
                contents.set('main.js', await gunzip(await fs.readFile(legacyPath)));
            } else if (await fs.pathExists(uncompressedPath)) {
                contents.set('main.js', await fs.readFile(uncompressedPath));
            }
        }
        return contents;
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
        return this.withBackupSession(pluginId, backup => backup.createBackup(pluginDir, files, force));
    }

    private async createSnapshot(pluginId: string, pluginDir: string, files: string[], force: boolean): Promise<boolean> {
        const pluginBackupDir = this.getPluginBackupDir(pluginId);
        let stagingDir: string | undefined;

        try {
            await this.recoverPendingSnapshot(pluginId);
            if (await fs.pathExists(pluginBackupDir) && !(await fs.stat(pluginBackupDir)).isDirectory()) {
                throw new Error('备份目录被其他文件占用，已停止应用');
            }
            const version = await this.getCurrentVersion(pluginDir);
            const hasBackup = this.hasBackup(pluginId);
            const backupVersion = hasBackup ? await this.getBackupVersion(pluginId) : undefined;
            if (hasBackup && !backupVersion) throw new Error('无法确认旧备份的来源版本，已停止应用');

            // 同版本复用最初的原文；跨版本必须完整重建，不能混入旧版文件。
            const contents = !force && hasBackup && backupVersion === version
                ? await this.readSnapshot(pluginId)
                : new Map<string, Buffer>();
            let existingFiles = 0;
            for (const file of files) {
                const originalPath = path.join(pluginDir, file);
                if (!(await fs.pathExists(originalPath))) continue;
                existingFiles++;
                const backupFile = path.normalize(file);
                if (!contents.has(backupFile)) contents.set(backupFile, await fs.readFile(originalPath));
            }
            if (existingFiles === 0) return false;

            // 完整快照和版本信息准备好后才替换备份；失败时保留旧快照。
            stagingDir = await fs.mkdtemp(path.join(this.backupDir, '.snapshot-'));
            for (const [file, content] of contents) {
                const backupPath = path.join(stagingDir, `${file}.gz`);
                await fs.ensureDir(path.dirname(backupPath));
                await fs.writeFile(backupPath, await gzip(content));
            }
            await fs.writeJson(path.join(stagingDir, BACKUP_METADATA_FILE), { version, files: [...contents.keys()] });

            const previousDir = `${stagingDir}.previous`;
            const hadDirectory = await fs.pathExists(pluginBackupDir);
            if (hadDirectory) {
                await fs.outputJson(this.getPendingPath(pluginId), { previousDir: path.basename(previousDir) });
                await fs.rename(pluginBackupDir, previousDir);
            }
            try {
                await fs.rename(stagingDir, pluginBackupDir);
                stagingDir = undefined;
            } catch (error) {
                if (hadDirectory) {
                    try {
                        await fs.rename(previousDir, pluginBackupDir);
                    } catch (restoreError) {
                        console.error(`[i18n] Backup preserved at ${previousDir}:`, restoreError);
                        throw restoreError;
                    }
                }
                throw error;
            }

            // 新快照已生效，旧格式此时才可清理；清理失败不影响备份可用性。
            try {
                if (hadDirectory) await fs.remove(previousDir);
                await this.removeLegacyBackups(pluginId);
                await fs.remove(this.getPendingPath(pluginId));
            } catch (error) {
                console.warn(`[i18n] Failed to clean old backups for [${pluginId}]:`, error);
            }

            return true;
        } catch (error) {
            console.error(`[i18n] Backup failed for [${pluginId}]:`, error);
            return false;
        } finally {
            if (stagingDir) await fs.remove(stagingDir).catch(() => undefined);
        }
    }

    /**
     * 还原备份 (自动解压)
     * @param pluginId 目标插件ID
     * @param pluginDir 还原目标插件目录
     * @returns boolean 还原是否成功
     */
    public async restoreBackup(pluginId: string, pluginDir: string): Promise<boolean> {
        return this.withBackupSession(pluginId, backup => backup.restoreBackup(pluginDir));
    }

    private async restoreSnapshot(pluginId: string, pluginDir: string): Promise<boolean> {
        try {
            await this.recoverPendingSnapshot(pluginId);
            if (!this.hasBackup(pluginId)) return false;
            await this.checkVersion(pluginId, pluginDir);
            const contents = await this.readSnapshot(pluginId);
            if (contents.size === 0) return false;
            for (const [file, content] of contents) {
                const targetPath = path.join(pluginDir, file);
                await fs.ensureDir(path.dirname(targetPath));
                await fs.writeFile(targetPath, content);
            }
            await this.removeSnapshot(pluginId);
            return true;
        } catch (error) {
            console.error(`[i18n] Restore failed for [${pluginId}]:`, error);
            return false;
        }
    }

    /**
     * 检查备份是否存在
     */
    public hasBackup(pluginId: string): boolean {
        const backupDir = this.getPluginBackupDir(pluginId);
        return (fs.existsSync(backupDir) && fs.statSync(backupDir).isDirectory()) ||
            fs.existsSync(this.getLegacyBackupPath(pluginId)) ||
            fs.existsSync(this.getLegacyUncompressedBackupPath(pluginId)) ||
            fs.existsSync(this.getPendingPath(pluginId));
    }

    /**
     * 获取备份文件内容 (自动解压)
     */
    public async getBackupContent(pluginId: string, file: string, pluginDir?: string): Promise<string | null> {
        return this.withBackupSession(pluginId, backup => backup.getBackupContent(file, pluginDir));
    }

    private async readBackupContent(pluginId: string, file: string, pluginDir?: string): Promise<string | null> {
        await this.recoverPendingSnapshot(pluginId);
        if (pluginDir) await this.checkVersion(pluginId, pluginDir);
        const contents = await this.readSnapshot(pluginId);
        return contents.get(path.normalize(file))?.toString() ?? null;
    }

    /**
     * 清理所有类型备份文件
     */
    public async removeBackup(pluginId: string): Promise<void> {
        await this.withResourceLock(pluginId, async () => {
            await this.recoverPendingSnapshot(pluginId);
            await this.removeSnapshot(pluginId);
        });
    }

    private async removeSnapshot(pluginId: string): Promise<void> {
        // 先清理旧格式，防止元数据已删而旧备份残留，被误认成当前版本。
        await this.removeLegacyBackups(pluginId);
        const pluginBackupDir = this.getPluginBackupDir(pluginId);
        if (await fs.pathExists(pluginBackupDir)) {
            await fs.remove(pluginBackupDir);
        }
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

    /**
     * 备份单个翻译源文件 (同步版)
     */
    public backupTranslationSync(sourceId: string, sourcesDir: string): void {
        const sourcePath = path.join(sourcesDir, `${sourceId}.json`);
        const backupPath = path.join(this.backupDir, 'translations', `${sourceId}.json.gz`);

        try {
            if (!fs.existsSync(sourcePath)) return;

            fs.ensureDirSync(path.dirname(backupPath));
            const content = fs.readFileSync(sourcePath);
            const compressed = zlib.gzipSync(content);
            fs.writeFileSync(backupPath, compressed);
        } catch (error) {
            console.error(`[i18n] Backup translation sync failed for [${sourceId}]:`, error);
        }
    }
}
