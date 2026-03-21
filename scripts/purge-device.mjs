/**
 * purge-device.mjs
 *
 * Hard-deletes a ColdGuard device and all related Convex records.
 * Use this when re-flashing firmware leaves the app stuck with a
 * stale enrollment that cannot be removed through the normal UI flow.
 *
 * Usage:
 *   node scripts/purge-device.mjs <DEVICE_ID>
 *
 * Example:
 *   node scripts/purge-device.mjs CG-ESP32-5C7BCC
 *
 * Prerequisites:
 *   - CONVEX_URL env var (or set in .env.local)
 *   - CONVEX_DEPLOY_KEY env var (get from Convex dashboard → Settings → Deploy keys)
 *
 * Run from the repo root.
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

// ── Load .env.local ────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(repoRoot, ".env.local");
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

// ── Validate args ──────────────────────────────────────────────────────────
const deviceId = process.argv[2];
if (!deviceId) {
  console.error("Usage: node scripts/purge-device.mjs <DEVICE_ID>");
  console.error("Example: node scripts/purge-device.mjs CG-ESP32-5C7BCC");
  process.exit(1);
}

const convexUrl = process.env.CONVEX_URL || process.env.EXPO_PUBLIC_CONVEX_URL;
const deployKey = process.env.CONVEX_DEPLOY_KEY;

if (!convexUrl) {
  console.error("Missing CONVEX_URL or EXPO_PUBLIC_CONVEX_URL env var.");
  process.exit(1);
}

console.log(`\n🔍 Target device: ${deviceId}`);
console.log(`📡 Convex URL: ${convexUrl}`);
console.log("─".repeat(60));

// ── Convex HTTP API helper ─────────────────────────────────────────────────
async function convexQuery(functionPath, args = {}) {
  const url = `${convexUrl.replace(/\/$/, "")}/api/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(deployKey ? { Authorization: `Convex ${deployKey}` } : {}),
    },
    body: JSON.stringify({ path: functionPath, args, format: "json" }),
  });
  const json = await res.json();
  if (!res.ok || json.status === "error") {
    throw new Error(`Query ${functionPath} failed: ${json.errorMessage ?? JSON.stringify(json)}`);
  }
  return json.value;
}

async function convexMutation(functionPath, args = {}) {
  const url = `${convexUrl.replace(/\/$/, "")}/api/mutation`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(deployKey ? { Authorization: `Convex ${deployKey}` } : {}),
    },
    body: JSON.stringify({ path: functionPath, args, format: "json" }),
  });
  const json = await res.json();
  if (!res.ok || json.status === "error") {
    throw new Error(`Mutation ${functionPath} failed: ${json.errorMessage ?? JSON.stringify(json)}`);
  }
  return json.value;
}

// ── Check if the maintenance mutation exists, otherwise use npx convex run ──
// The cleanest approach is to call the convex run CLI since it uses your
// existing auth, no deploy key needed.

function convexRun(fnPath, argsJson) {
  const deployKeyFlag = deployKey ? `--prod` : "";
  const cmd = `npx convex run ${fnPath} '${argsJson}' ${deployKeyFlag} --url "${convexUrl}"`;
  console.log(`  $ ${cmd}`);
  try {
    const out = execSync(cmd, { cwd: repoRoot, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    return out.trim();
  } catch (err) {
    const msg = err.stderr || err.stdout || err.message;
    throw new Error(msg);
  }
}

// ── Main purge logic ───────────────────────────────────────────────────────
async function main() {
  try {
    console.log(`\n▶  Purging device ${deviceId} from Convex via maintenance:purgeDevice ...\n`);

    const result = convexRun(
      "maintenance:purgeDevice",
      JSON.stringify({ deviceId }),
    );
    console.log(`\n✅ Done:\n${result}`);
  } catch (err) {
    // If the maintenance function doesn't exist yet, print instructions.
    if (String(err.message).includes("Could not find public function")) {
      console.error("\n❌ maintenance:purgeDevice not found.");
      console.error("   You need to deploy the maintenance function first.");
      console.error("   Run:  npx convex deploy\n");
    } else {
      console.error(`\n❌ Error:\n${err.message}`);
    }
    process.exit(1);
  }
}

main();
