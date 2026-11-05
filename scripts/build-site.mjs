// Assembles the GitHub Pages site (R70): v2 at the root, v1 at /v1/. Run after both builds.
// Both apps use a relative Vite base, so they work from any sub-path.
import { cpSync, existsSync, rmSync } from 'node:fs';

for (const dir of ['dist', 'v2/dist']) {
  if (!existsSync(`${dir}/index.html`)) throw new Error(`${dir}/index.html missing: build first`);
}
rmSync('site', { recursive: true, force: true });
cpSync('v2/dist', 'site', { recursive: true });
cpSync('dist', 'site/v1', { recursive: true });
console.log('site/ = v2, site/v1/ = v1');
