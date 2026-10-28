import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
import fs from 'fs-extra';
import { transformSync } from 'esbuild';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadSource(relativePath) {
    const filename = path.resolve(projectRoot, relativePath);
    const compiled = transformSync(fs.readFileSync(filename, 'utf8'), {
        loader: 'ts', format: 'cjs', target: 'node20'
    }).code;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', compiled)(createRequire(filename), module, module.exports);
    return module.exports;
}

const { BackupManager } = loadSource('src/manager/backup-manager.ts');
const pluginId = 'target-plugin';
const version = '1.0.0';
const originalMain = 'module.exports = { label: "English" };\n';
const translatedMain = 'module.exports = { label: "中文" };\n';
const originalStyles = 'body { color: red; }\n';
const translatedStyles = 'body { color: blue; }\n';

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-backup-recovery-'));
    t.after(() => fs.removeSync(root));
    const i18nDir = path.join(root, 'i18n');
    const pluginDir = path.join(root, pluginId);
    fs.ensureDirSync(pluginDir);
    fs.writeJsonSync(path.join(pluginDir, 'manifest.json'), { id: pluginId, version });
    const mainPath = path.join(pluginDir, 'main.js');
    const stylesPath = path.join(pluginDir, 'styles.css');
    fs.writeFileSync(mainPath, originalMain);
    fs.writeFileSync(stylesPath, originalStyles);
    const restart = () => new BackupManager(i18nDir, () => version);
    const backup = restart();
    const backupDir = backup.getPluginBackupDir(pluginId);
    const backupsDir = path.dirname(backupDir);
    const pendingPath = path.join(backupsDir, '.pending', `${pluginId}.json`);
    return { backup, backupDir, backupsDir, mainPath, pendingPath, pluginDir, restart, stylesPath };
}

for (const compressed of [true, false]) {
    test(`混合目录与旧 ${compressed ? '.js.gz' : '.js'} 备份迁移时保留 main.js 原文`, async (t) => {
        const f = fixture(t);
        fs.outputFileSync(path.join(f.backupDir, 'styles.css.gz'), gzipSync(originalStyles));
        const legacyPath = compressed
            ? f.backup.getLegacyBackupPath(pluginId)
            : f.backup.getLegacyUncompressedBackupPath(pluginId);
        fs.writeFileSync(legacyPath, compressed ? gzipSync(originalMain) : originalMain);
        fs.writeFileSync(f.mainPath, translatedMain);
        fs.writeFileSync(f.stylesPath, translatedStyles);

        assert.equal(await f.backup.createBackup(pluginId, f.pluginDir, ['main.js', 'styles.css']), true);
        assert.equal(await f.backup.getBackupContent(pluginId, 'main.js', f.pluginDir), originalMain);
        assert.equal(await f.backup.getBackupContent(pluginId, 'styles.css', f.pluginDir), originalStyles);
        assert.equal(fs.existsSync(legacyPath), false);
        assert.equal(await f.backup.restoreBackup(pluginId, f.pluginDir), true);
        assert.equal(fs.readFileSync(f.mainPath, 'utf8'), originalMain);
        assert.equal(fs.readFileSync(f.stylesPath, 'utf8'), originalStyles);
    });
}

for (const missingFiles of [['main.js'], ['main.js', 'styles.css']]) {
    test(`新快照缺少 ${missingFiles.join('、')} 时拒绝回退到残存旧备份`, async (t) => {
        const f = fixture(t);
        assert.equal(await f.backup.createBackup(pluginId, f.pluginDir, ['main.js', 'styles.css']), true);
        const legacyPath = f.backup.getLegacyBackupPath(pluginId);
        fs.writeFileSync(legacyPath, gzipSync('stale legacy source'));
        for (const file of missingFiles) fs.removeSync(path.join(f.backupDir, `${file}.gz`));
        fs.writeFileSync(f.mainPath, translatedMain);
        fs.writeFileSync(f.stylesPath, translatedStyles);

        await assert.rejects(() => f.backup.getBackupContent(pluginId, 'main.js', f.pluginDir));
        assert.equal(await f.backup.restoreBackup(pluginId, f.pluginDir), false);
        assert.equal(await f.backup.createBackup(pluginId, f.pluginDir, ['main.js', 'styles.css']), false);
        assert.equal(fs.readFileSync(f.mainPath, 'utf8'), translatedMain);
        assert.equal(fs.readFileSync(f.stylesPath, 'utf8'), translatedStyles);
        assert.equal(fs.existsSync(legacyPath), true);
        for (const file of missingFiles) assert.equal(fs.existsSync(path.join(f.backupDir, `${file}.gz`)), false);
        assert.equal(fs.existsSync(path.join(f.backupDir, '.backup-info.json')), true);
    });
}

test('带空文件清单的新快照拒绝使用残存旧备份或当前译文重建', async (t) => {
    const f = fixture(t);
    fs.outputJsonSync(path.join(f.backupDir, '.backup-info.json'), { version, files: [] });
    const legacyPath = f.backup.getLegacyBackupPath(pluginId);
    fs.writeFileSync(legacyPath, gzipSync('stale legacy source'));
    fs.writeFileSync(f.mainPath, translatedMain);

    await assert.rejects(() => f.backup.getBackupContent(pluginId, 'main.js', f.pluginDir));
    assert.equal(await f.backup.restoreBackup(pluginId, f.pluginDir), false);
    assert.equal(await f.backup.createBackup(pluginId, f.pluginDir, ['main.js']), false);
    assert.equal(fs.readFileSync(f.mainPath, 'utf8'), translatedMain);
    assert.equal(fs.existsSync(legacyPath), true);
    assert.equal(fs.existsSync(path.join(f.backupDir, 'main.js.gz')), false);
});

test('新快照置入和旧目录复位均失败时保留可恢复标记并拒绝重新读取译文', async (t) => {
    const f = fixture(t);
    assert.equal(await f.backup.createBackup(pluginId, f.pluginDir, ['main.js']), true);
    fs.writeFileSync(f.mainPath, translatedMain);
    const originalRename = fs.rename;
    let failedRenames = 0;
    const renameMock = t.mock.method(fs, 'rename', async (source, destination, ...args) => {
        if (destination === f.backupDir) {
            failedRenames++;
            throw new Error('injected snapshot installation and rollback failure');
        }
        return originalRename(source, destination, ...args);
    });

    assert.equal(await f.backup.createBackup(pluginId, f.pluginDir, ['main.js']), false);
    assert.equal(failedRenames, 2);
    assert.equal(fs.existsSync(f.backupDir), false);
    const pending = fs.readJsonSync(f.pendingPath);
    assert.equal(path.basename(pending.previousDir), pending.previousDir);
    const previousDir = path.join(f.backupsDir, pending.previousDir);
    assert.equal(gunzipSync(fs.readFileSync(path.join(previousDir, 'main.js.gz'))).toString(), originalMain);

    const originalReadFile = fs.readFile;
    let translatedSourceReads = 0;
    const readMock = t.mock.method(fs, 'readFile', async (filename, ...args) => {
        if (filename === f.mainPath) translatedSourceReads++;
        return originalReadFile(filename, ...args);
    });
    assert.equal(await f.restart().createBackup(pluginId, f.pluginDir, ['main.js']), false);
    assert.equal(translatedSourceReads, 0);
    assert.equal(fs.existsSync(f.pendingPath), true);
    assert.equal(fs.existsSync(previousDir), true);
    readMock.mock.restore();
    renameMock.mock.restore();

    assert.equal(await f.restart().restoreBackup(pluginId, f.pluginDir), true);
    assert.equal(fs.readFileSync(f.mainPath, 'utf8'), originalMain);
    assert.equal(fs.existsSync(f.pendingPath), false);
    assert.equal(fs.existsSync(previousDir), false);
});

test('目录交换期间退出后重建管理器仍可恢复原快照', async (t) => {
    const f = fixture(t);
    assert.equal(await f.backup.createBackup(pluginId, f.pluginDir, ['main.js']), true);
    assert.equal(fs.existsSync(f.pendingPath), false);
    fs.writeFileSync(f.mainPath, translatedMain);

    // 重现已写事务标记、旧目录已移走而新目录尚未置入时的磁盘状态。
    const previousDir = path.join(f.backupsDir, '.snapshot-interrupted.previous');
    fs.outputJsonSync(f.pendingPath, { previousDir: path.basename(previousDir) });
    fs.renameSync(f.backupDir, previousDir);

    assert.equal(await f.restart().restoreBackup(pluginId, f.pluginDir), true);
    assert.equal(fs.readFileSync(f.mainPath, 'utf8'), originalMain);
    assert.equal(fs.existsSync(f.pendingPath), false);
    assert.equal(fs.existsSync(previousDir), false);
    assert.equal(fs.existsSync(f.backupDir), false);
});
