import { spawnSync } from "node:child_process";
import path from "node:path";

const repoRoot = process.cwd();
const sketchDir = path.join(repoRoot, "firmware", "esp32_transport_harness");

const result = spawnSync(
  "arduino-cli",
  [
    "compile",
    "--fqbn",
    "esp32:esp32:esp32",
    "--board-options",
    "PartitionScheme=no_ota",
    sketchDir,
  ],
  {
    cwd: repoRoot,
    shell: process.platform === "win32",
    stdio: "inherit",
  },
);

if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}
