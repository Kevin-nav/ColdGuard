import { spawnSync } from "node:child_process";
import path from "node:path";

const repoRoot = process.cwd();
const androidDir = path.join(repoRoot, "android");
const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const command = process.platform === "win32" ? path.join(androidDir, gradlew) : gradlew;

const result = spawnSync(
  command,
  ["coldguard-wifi-bridge:testDebugUnitTest", "--console=plain"],
  {
    cwd: androidDir,
    shell: process.platform === "win32",
    stdio: "inherit",
  },
);

if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}
