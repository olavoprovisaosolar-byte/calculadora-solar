export type ParsedModuleDatasheet = {
  manufacturer: string;
  model: string;
  powerWp: number | null;
  lengthM: number | null;
  widthM: number | null;
  areaM2: number | null;
  thicknessMm: number | null;
  weightKg: number | null;
  frame: string;
  glass: string;
  notes: string;
};

function cleanDatasheet(text: string): string {
  return text
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\approx|\\,/g, '')
    .replace(/[{}]/g, '')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/\^2/g, '²')
    .replace(/\u00a0/g, ' ');
}

function parseFlexibleNumber(raw: string): number {
  const text = raw.trim().replace(/\s/g, '');
  if (!text) return NaN;
  if (text.includes(',') && text.includes('.')) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      return Number(text.replace(/\./g, '').replace(',', '.'));
    }
    return Number(text.replace(/,/g, ''));
  }
  if (text.includes(',')) return Number(text.replace(',', '.'));
  return Number(text);
}

function toMeters(value: number, unit: string): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const normalized = unit.toLowerCase();
  if (normalized === 'mm') {
    if (value >= 10) return Math.round((value / 1000) * 1000) / 1000;
    return value;
  }
  if (normalized === 'cm') return Math.round((value / 100) * 1000) / 1000;
  if (value > 20) return Math.round((value / 1000) * 1000) / 1000;
  return value;
}

function labeledMeters(text: string, label: string): number | null {
  const match = text.match(
    new RegExp(`${label}\\s*:?\\s*([\\d.,]+)\\s*(mm|cm|metros|metro|m)?`, 'i'),
  );
  if (!match || match.index == null) return null;
  const tail = text.slice(match.index, match.index + 140);
  const parenthesis = tail.match(/ou\s+([\d.,]+)\s*(metros|metro|m)\b/i);
  if (parenthesis) {
    const meters = parseFlexibleNumber(parenthesis[1]);
    return Number.isFinite(meters) && meters > 0 ? meters : null;
  }
  return toMeters(parseFlexibleNumber(match[1]), match[2] ?? 'm');
}

function labeledNumber(text: string, label: string): { value: number; unit: string } | null {
  const match = text.match(
    new RegExp(`${label}\\s*:?\\s*([\\d.,]+)\\s*(mm|cm|kg|m²|m2)?`, 'i'),
  );
  if (!match) return null;
  const value = parseFlexibleNumber(match[1]);
  if (!Number.isFinite(value)) return null;
  return { value, unit: (match[2] ?? '').toLowerCase() };
}

export function parseModuleDatasheet(raw: string): ParsedModuleDatasheet {
  const text = cleanDatasheet(raw);
  const powerMatch = text.match(/(\d+(?:[.,]\d+)?)\s*W(?:p)?\b/i);
  const powerWp = powerMatch ? Math.round(parseFlexibleNumber(powerMatch[1])) : null;

  const modelMatch =
    text.match(/\(([A-Z][A-Z0-9-]{4,})\)/) ??
    text.match(/\b((?:LP|CS|JKM|TSM|LR)[A-Z0-9-]{4,})\b/);
  const model = modelMatch?.[1] ?? (powerWp ? `${powerWp} Wp` : '');

  const brandMatch = text.match(
    /m[oó]dulo fotovoltaico\s+([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9-]*)/i,
  );
  const manufacturer = brandMatch?.[1] ?? '';

  const lengthM = labeledMeters(text, 'comprimento');
  const widthM = labeledMeters(text, 'largura');

  const thickness = labeledNumber(text, 'espessura(?: da moldura(?: \\(perfil\\))?)?');
  let thicknessMm: number | null = null;
  if (thickness) {
    if (thickness.unit === 'cm') thicknessMm = thickness.value * 10;
    else if (thickness.unit === 'm') thicknessMm = thickness.value * 1000;
    else thicknessMm = thickness.value < 1 ? thickness.value * 1000 : thickness.value;
  }

  const areaMatch = text.match(/([0-9]+(?:[.,][0-9]+)?)\s*m(?:²|2)/i);
  const areaM2 = areaMatch ? parseFlexibleNumber(areaMatch[1]) : null;

  const weight = labeledNumber(text, 'peso');
  const weightKg = weight ? weight.value : null;

  const frameMatch = text.match(/estrutura\s*\/\s*moldura\s*:\s*([^\n.]+)/i);
  const glassMatch = text.match(/vidro\s*:\s*([^\n.]+)/i);

  const notes = [frameMatch?.[1], glassMatch?.[1]].filter(Boolean).join(' · ');

  return {
    manufacturer,
    model,
    powerWp: powerWp && powerWp > 0 ? powerWp : null,
    lengthM,
    widthM,
    areaM2: areaM2 && areaM2 > 0 ? areaM2 : null,
    thicknessMm: thicknessMm && thicknessMm > 0 ? thicknessMm : null,
    weightKg: weightKg && weightKg > 0 ? weightKg : null,
    frame: frameMatch?.[1]?.trim() ?? '',
    glass: glassMatch?.[1]?.trim() ?? '',
    notes,
  };
}

export function datasheetIsComplete(parsed: ParsedModuleDatasheet): boolean {
  return Boolean(
    parsed.powerWp &&
      parsed.lengthM &&
      parsed.widthM &&
      parsed.powerWp > 0 &&
      parsed.lengthM > 0 &&
      parsed.widthM > 0,
  );
}
