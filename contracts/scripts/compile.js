#!/usr/bin/env node
// Local compile fallback: uses solcjs + the npm-installed OpenZeppelin contracts.
// Foundry remains the canonical toolchain (forge build/test/script) once installed.
const fs = require("fs");
const path = require("path");
const solc = require("solc");

const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "src");
const outDir = path.join(root, "out");

function collectSolFiles(dir, prefix = "") {
  const result = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(result, collectSolFiles(abs, rel));
    else if (entry.name.endsWith(".sol")) result[rel] = { content: fs.readFileSync(abs, "utf8") };
  }
  return result;
}

const sources = collectSolFiles(srcDir);
const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] } },
  },
};

function findImports(importPath) {
  const candidates = [
    path.join(root, "node_modules", importPath),
    path.join(root, importPath),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return { contents: fs.readFileSync(candidate, "utf8") };
  }
  return { error: `File not found: ${importPath}` };
}

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errors = (output.errors || []).filter((e) => e.severity === "error");
for (const e of output.errors || []) {
  console.error(`[${e.severity}] ${e.formattedMessage}`);
}
if (errors.length) process.exit(1);

fs.mkdirSync(outDir, { recursive: true });
for (const [sourceName, contracts] of Object.entries(output.contracts || {})) {
  for (const [name, artifact] of Object.entries(contracts)) {
    const file = path.join(outDir, `${name}.json`);
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          abi: artifact.abi,
          bytecode: `0x${artifact.evm.bytecode.object}`,
          deployedBytecode: `0x${artifact.evm.deployedBytecode.object}`,
          sourceName,
        },
        null,
        2
      )
    );
    console.log(`Wrote ${path.relative(root, file)}`);
  }
}
