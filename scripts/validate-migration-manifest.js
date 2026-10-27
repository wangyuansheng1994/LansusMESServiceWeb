import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(frontendRoot, 'public', 'migration-manifest.json');
const touchpointsPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(frontendRoot, '..', 'LansusMESService', 'client-touchpoints.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const touchpoints = JSON.parse(fs.readFileSync(touchpointsPath, 'utf8'));
const bridgeAllowlist = Array.isArray(manifest.bridgeAllowlist) ? manifest.bridgeAllowlist : null;
const clientDenyList = Array.isArray(manifest.clientDenyList) ? manifest.clientDenyList : null;
const expectedDenyList = touchpoints.bridgeDenyList?.routes ?? [];
const failures = [];

if (!bridgeAllowlist) failures.push('bridgeAllowlist must be an array');
if (!clientDenyList) failures.push('clientDenyList must be an array');
if (clientDenyList && clientDenyList.join('\n') !== expectedDenyList.join('\n')) {
  failures.push('clientDenyList is stale or does not match client-touchpoints.json');
}

const allowRoutes = new Set((bridgeAllowlist ?? []).map((item) => item.path ?? item));
const deniedRoutes = new Set(expectedDenyList);
const intersection = [...allowRoutes].filter((route) => deniedRoutes.has(route));
if (intersection.length)
  failures.push(`client touchpoints also in bridgeAllowlist: ${intersection.join(', ')}`);

for (const page of manifest.pages ?? []) {
  const clientTouchpoint = page.clientTouchpointType && page.clientTouchpointType !== 'none';
  if (clientTouchpoint && page.bridgeEligible) {
    failures.push(
      `client touchpoint must not be bridgeEligible: ${page.newRoute ?? page.pagePath}`,
    );
  }
}

const demo = (manifest.pages ?? []).find((page) => page.newRoute === '/demo/customer');
if (!demo) failures.push('/demo/customer framework route is missing');
else if (demo.bridgeEligible) failures.push('/demo/customer must have bridgeEligible=false');

if (failures.length) {
  console.error(`FAIL ${failures.length} migration checks`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  `PASS migration manifest: ${(manifest.pages ?? []).length} page(s), bridgeAllowlist/client deny-list intersection=0`,
);
