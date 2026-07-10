import fs from 'fs';
import path from 'path';

// Run from the dashboard dir (npm prebuild). Regenerates src/abis.generated.ts
// from the repo-root config.json so contract ABIs never drift from config.
const root = path.resolve(process.cwd(), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
const abis = cfg.abis || {};
const out = {};
for (const [k, v] of Object.entries(abis)) {
  const camel = k.replace(/_abi$/, '').replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  out[camel] = v;
}
let s = '// AUTO-GENERATED from config.json (config.abis) — do not edit by hand.\n';
s += 'export const ABIS: Record<string, any> = {\n';
for (const [k, v] of Object.entries(out)) s += `  ${k}: ${JSON.stringify(v)},\n`;
s += '};\n';
fs.writeFileSync(path.join(process.cwd(), 'src', 'abis.generated.ts'), s);
console.log('Generated src/abis.generated.ts for:', Object.keys(out).join(', '));
