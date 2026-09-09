#!/usr/bin/env node
/**
 * One-time core patch for dsh-steer.
 *
 * The steer button calls `inputActions.submitSteer()`. That action is not part
 * of the stock DeepSeek Harness input shell, so this script adds it to the
 * conversation bundle:
 *
 *   submit: () => { this.submit("queue"); }
 *   + submitSteer: () => { this.submit("steer"); }
 *
 * The patch is idempotent (running it twice is a no-op) and version-tolerant:
 * it locates the SessionInputShell `submit` wrapper regardless of the exact
 * whitespace or neighbouring fields.
 *
 * Usage:
 *   node scripts/patch-submit-steer.mjs                 # auto-discover bundle
 *   node scripts/patch-submit-steer.mjs /path/to/dsh-client-ui-conversation/lib/client.js
 *   DSH_CONVERSATION_BUNDLE=/path node scripts/patch-submit-steer.mjs
 *
 * After patching: no server restart is needed (client bundles are served live);
 * just hard-refresh the web app (Cmd+Shift+R).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const pkgName = "dsh-client-ui-conversation";
const fileTail = join("node_modules", "@deepseek-ai", pkgName, "lib", "client.js");

function bundleCandidates() {
  const out = [];
  // 1. explicit env
  if (process.env.DSH_CONVERSATION_BUNDLE) out.push(process.env.DSH_CONVERSATION_BUNDLE);
  // 2. walk up from cwd
  let dir = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    out.push(join(dir, fileTail));
    dir = dirname(dir);
  }
  // 3. common npx caches (npm) / global installs
  const npxRoot = join(homedir(), ".npm", "_npx");
  return out;
}

function findBundle() {
  // explicit arg beats everything
  const arg = process.argv[2];
  if (arg) {
    const resolved = arg.endsWith("client.js") ? arg : join(arg, fileTail);
    if (existsSync(resolved)) return resolved;
    throw new Error(`no client bundle at "${arg}"`);
  }
  // npx cache: prefer the install that hosts dsh-web-app (the web deployment profile bundle)
  try {
    const npxRoot = join(homedir(), ".npm", "_npx");
    if (existsSync(npxRoot)) {
      const dirs = readdirSync(npxRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => join(npxRoot, d.name))
        .filter((d) => existsSync(join(d, "node_modules", "@deepseek-ai", pkgName, "package.json")));
      const withWeb = dirs.find((d) => existsSync(join(d, "node_modules", "@deepseek-ai", "dsh-web-app", "package.json")));
      const chosen = withWeb ?? dirs[0];
      if (chosen) return join(chosen, fileTail);
    }
  } catch {}
  for (const candidate of bundleCandidates()) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    "Could not locate dsh-client-ui-conversation. Pass the path:\n" +
    "  node scripts/patch-submit-steer.mjs /abs/path/to/dsh-client-ui-conversation/lib/client.js"
  );
}

/** Find the index just past the `submit` wrapper's closing `}` in the SessionInputShell `actions`. */
function findSubmitEnd(src, queuePhrase) {
  const at = src.indexOf(queuePhrase);
  if (at < 0) return -1;
  // backtrack to the enclosing arrow `{`
  const open = src.lastIndexOf("submit: () => {", at);
  if (open < 0) return -1;
  const bodyOpen = src.indexOf("{", open);
  // brace-walk to the matching close
  let depth = 0;
  let inStr = null;
  let esc = false;
  for (let i = bodyOpen; i < src.length; i += 1) {
    const ch = src[i];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === inStr) inStr = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { inStr = ch; continue; }
    if (ch === "{") depth += 1;
    else if (ch === "}") { depth -= 1; if (depth === 0) return i + 1; }
  }
  return -1;
}

const bundlePath = findBundle();
const source = readFileSync(bundlePath, "utf8");

if (source.includes("submitSteer")) {
  console.log(`✓ submitSteer already present — no change (${bundlePath})`);
  process.exit(0);
}

const end = findSubmitEnd(source, 'this.submit("queue")');
if (end < 0) {
  console.error("✗ Could not locate the SessionInputShell submit action in:\n  " + bundlePath);
  console.error("  The bundle layout may differ in your DSH version. Please open an issue with your DSH version.");
  process.exit(1);
}

const insert = '\n\t\t\t\tsubmitSteer: () => {\n\t\t\t\t\tthis.submit("steer");\n\t\t\t\t}';
const patched = source.slice(0, end) + "," + insert + source.slice(end);

writeFileSync(bundlePath, patched, "utf8");
console.log(`✓ Patched ${bundlePath}`);
console.log("  Added inputActions.submitSteer() (calls submit('steer')).");
console.log("\nNext steps:");
console.log("  1. Hard-refresh the web app (Cmd+Shift+R). No server restart needed.");
console.log("  2. Mount the plugin (see README: cordis.patch.yml insert, or run it as a dynamic plugin).");
