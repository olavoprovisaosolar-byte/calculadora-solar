import { SolarModule } from '../types';

/** Catálogo pré-cadastrado de módulos comerciais. */
export const PRESET_MODULES: SolarModule[] = [
  {
    id: 'preset-450',
    manufacturer: 'Comercial',
    model: '450 Wp',
    powerWp: 450,
    widthM: 1.04,
    lengthM: 2.09,
    areaM2: 2.18,
    isCustom: false,
  },
  {
    id: 'preset-550',
    manufacturer: 'Comercial',
    model: '550 Wp',
    powerWp: 550,
    widthM: 1.13,
    lengthM: 2.27,
    areaM2: 2.56,
    isCustom: false,
  },
  {
    id: 'preset-575',
    manufacturer: 'Comercial',
    model: '575 Wp',
    powerWp: 575,
    widthM: 1.13,
    lengthM: 2.27,
    areaM2: 2.56,
    isCustom: false,
  },
  {
    id: 'preset-585',
    manufacturer: 'Comercial',
    model: '585 Wp',
    powerWp: 585,
    widthM: 1.13,
    lengthM: 2.27,
    areaM2: 2.56,
    isCustom: false,
  },
  {
    id: 'preset-600',
    manufacturer: 'Comercial',
    model: '600 Wp',
    powerWp: 600,
    widthM: 1.3,
    lengthM: 2.17,
    areaM2: 2.82,
    isCustom: false,
  },
  {
    id: 'preset-610',
    manufacturer: 'Comercial',
    model: '610 Wp',
    powerWp: 610,
    widthM: 1.3,
    lengthM: 2.17,
    areaM2: 2.82,
    isCustom: false,
  },
  {
    id: 'preset-620',
    manufacturer: 'Comercial',
    model: '620 Wp',
    powerWp: 620,
    widthM: 1.3,
    lengthM: 2.17,
    areaM2: 2.82,
    isCustom: false,
  },
  {
    id: 'preset-700',
    manufacturer: 'Comercial',
    model: '700 Wp',
    powerWp: 700,
    widthM: 1.3,
    lengthM: 2.38,
    areaM2: 3.1,
    isCustom: false,
  },
  {
    id: 'preset-710',
    manufacturer: 'Comercial',
    model: '710 Wp',
    powerWp: 710,
    widthM: 1.3,
    lengthM: 2.38,
    areaM2: 3.1,
    isCustom: false,
  },
];

/** Fator diário → kWp: (consumo_diario * 30) / 100 = consumo_diario / 3.33 */
export const DAILY_TO_KWP_FACTOR = 3.33;

/** Potência estimada a partir do consumo mensal. */
export const MONTHLY_TO_KWP_DIVISOR = 100;

/** Dias médios do mês para conversões. */
export const DAYS_PER_MONTH = 30;

/** Faixa de FDI (Fator de Dimensionamento do Inversor / Overboarding). */
export const INVERTER_FDI_MIN = 1.15;
export const INVERTER_FDI_MAX = 1.3;

/** Margem padrão de segurança / desconto de área (10%). */
export const DEFAULT_AREA_MARGIN = 0.1;

/** Folga de borda do telhado para manutenção/arranjo (metros). */
export const DEFAULT_EDGE_MARGIN_M = 0.5;

/** Espaçamento entre placas — grampos intermediários / mid clamps (metros). */
export const DEFAULT_PANEL_GAP_M = 0.02;

/** Folga nas pontas da fileira — grampos finais / end clamps (metros). */
export const DEFAULT_END_CLAMP_M = 0.03;
export const END_CLAMP_MIN_M = 0.03;
export const END_CLAMP_MAX_M = 0.05;

/** Corredor de manutenção entre grupos de fileiras. */
export const DEFAULT_CORRIDOR_WIDTH_M = 0.6;
export const DEFAULT_CORRIDOR_EVERY_ROWS = 2;

/** Afastamento de segurança ao redor de obstáculos (metros). */
export const DEFAULT_OBSTACLE_CLEARANCE_M = 0.4;

/** Geração estimada: 100 kWh/mês por kWp. */
export const KWH_PER_KWP_MONTH = 100;

export const AI_MODELS = {
  openai: 'gpt-4o-mini',
  gemini: 'gemini-3.8-flash',
} as const;

export const FACTOR_333_EXPLANATION =
  'O fator 3,33 resulta da relação entre o consumo diário e a divisão mensal por 100: (Consumo Diário × 30) / 100 = Consumo Diário / 3,333. Esse fator permite converter a média diária direto para a potência em kWp necessária.';
