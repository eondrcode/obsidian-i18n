import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";

// 1. 从 package.json 读取版本号
const pkgPath = "package.json";
if (!existsSync(pkgPath)) {
    console.error("Error: package.json not found!");
    process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const version = pkg.version;

if (!version) {
    console.error("Error: 'version' field not found in package.json!");
    process.exit(1);
}

console.log(`Current version: ${version}`);

try {
    // 2. 检查 Git 仓库是否干净 (可选，但建议)
    // const status = execSync("git status --porcelain", { encoding: "utf8" });
    // if (status.trim()) {
    //     console.warn("Warning: Git working directory is not clean. tagging anyway...");
    // }

    // 3. 打标签
    console.log(`\n> git tag ${version}`);
    execSync(`git tag ${version}`, { stdio: "inherit" });

    // 4. 推送到 origin
    console.log(`\n> git push origin ${version}`);
    execSync(`git push origin ${version}`, { stdio: "inherit" });

    console.log(`\nSuccessfully tagged and pushed version ${version} to origin.`);
} catch (error) {
    console.error(`\nFailed to tag or push version ${version}:`, error.message);
    process.exit(1);
}
