const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export function appVersionOf(value: string): string {
  const trimmed = value.trim().replace(/^v/i, '');
  if (!VERSION_PATTERN.test(trimmed)) {
    throw new Error(`Versão inválida: ${value}`);
  }
  return trimmed;
}

export function apkFileName(version: string): string {
  return `SolarCalculator-v${appVersionOf(version)}.apk`;
}

export function apkReleaseTag(version: string): string {
  return `solar-calculator-v${appVersionOf(version)}`;
}
