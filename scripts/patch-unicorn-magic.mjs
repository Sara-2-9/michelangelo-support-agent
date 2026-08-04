/**
 * postinstall patch — unicorn-magic conditional exports fix.
 *
 * Why: @mastra/core depends on execa → npm-run-path → imports
 * { toPath, traversePathUp } from 'unicorn-magic'. That package uses
 * conditional exports: the "node" condition has those exports, the
 * "default" one (which wrangler's esbuild resolves for workerd) does not,
 * so the Worker bundle fails with "No matching export".
 *
 * This patch rewrites node_modules/unicorn-magic/package.json so the
 * "default" condition also resolves to ./node.js. Safe for us: we run on
 * workerd with nodejs_compat (Node built-ins exist), never in a browser.
 * Re-applied automatically after every npm install.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const target = "node_modules/unicorn-magic/package.json";
if (!existsSync(target)) {
  console.log("patch-unicorn-magic: package not found, skipping");
  process.exit(0);
}

const pkg = JSON.parse(readFileSync(target, "utf-8"));
if (pkg.exports?.["."]?.default?.import === "./node.js") {
  console.log("patch-unicorn-magic: already patched");
  process.exit(0);
}

// exports map shorthand shape: { node: {...}, default: {...} }
// (or nested under "." for the full form)
const dot = pkg.exports?.["."] ?? pkg.exports;
if (dot?.node && dot?.default) {
  dot.default = { ...dot.default, import: dot.node.import };
  writeFileSync(target, JSON.stringify(pkg, null, 2));
  console.log("patch-unicorn-magic: default condition now resolves to node.js");
} else {
  console.warn("patch-unicorn-magic: unexpected exports shape, review manually");
}
