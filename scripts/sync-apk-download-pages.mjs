import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = String(pkg.version ?? '').trim().replace(/^v/i, '');
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Versão inválida em package.json: ${pkg.version}`);
  process.exit(1);
}

const apkName = `SolarCalculator-v${version}.apk`;
const tag = `v${version}`;
const REPO = 'olavoprovisaosolar-byte/calculadora-solar';
const downloadUrl = `https://github.com/${REPO}/releases/download/${tag}/${apkName}`;
const releaseUrl = `https://github.com/${REPO}/releases/tag/${tag}`;

function replaceDownloadLinks(source) {
  return source
    .replace(
      /https:\/\/github\.com\/olavoprovisaosolar-byte\/calculadora-solar\/releases\/download\/(?:solar-calculator-v|v)[\d.]+\/SolarCalculator(?:-v[\d.]+)?\.apk/g,
      downloadUrl,
    )
    .replace(
      /https:\/\/github\.com\/olavoprovisaosolar-byte\/calculadora-solar\/releases\/tag\/(?:solar-calculator-v|v)[\d.]+/g,
      releaseUrl,
    )
    .replace(/Baixar SolarCalculator(?:-v[\d.]+)?\.apk/g, `Baixar ${apkName}`);
}

const files = ['README.md', 'download.html'].map((name) => join(root, name));
for (const file of files) {
  const next = replaceDownloadLinks(readFileSync(file, 'utf8'));
  writeFileSync(file, next);
}

process.stdout.write(`${apkName}\n${downloadUrl}\n`);
