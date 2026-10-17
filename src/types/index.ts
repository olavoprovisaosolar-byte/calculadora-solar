export type ThemeMode = 'light' | 'dark' | 'system';

export type AiProvider = 'openai' | 'gemini';

export interface SolarModule {
  id: string;
  manufacturer: string;
  model: string;
  powerWp: number;
  widthM: number;
  lengthM: number;
  areaM2: number;
  isCustom: boolean;
  /** Espessura da moldura, em milímetros. */
  thicknessMm?: number;
  /** Peso do módulo, em quilogramas. */
  weightKg?: number;
  /** Material da estrutura / moldura. */
  frame?: string;
  /** Tipo de vidro. */
  glass?: string;
  /** Texto livre capturado da ficha (moldura, vidro e observações). */
  datasheetNotes?: string;
}

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

export interface ConsumptionMonthlyResult {
  monthlyKwh: number;
  dailyKwh: number;
  powerKwp: number;
  inverterMinKw: number;
  inverterMaxKw: number;
}

export interface ConsumptionDailyResult {
  dailyKwh: number;
  monthlyKwh: number;
  powerKwp: number;
  inverterMinKw: number;
  inverterMaxKw: number;
}

export interface RoofDirectResult {
  quantity: number;
  module: SolarModule;
  grossAreaM2: number;
  safetyMargin: number;
  recommendedAreaM2: number;
  totalPowerKwp: number;
}

export interface RoofInverseResult {
  roofAreaM2: number;
  module: SolarModule;
  discountMargin: number;
  usefulAreaM2: number;
  maxModules: number;
  maxPowerKwp: number;
  estimatedMonthlyGenerationKwh: number;
}

/** Orientação física da placa no telhado. */
export type PanelOrientation = 'portrait' | 'landscape';

/**
 * Posição de uma placa no plano do telhado (metros, origem = canto útil).
 * Preparado para interação futura (drag / rotate).
 */
export interface PanelPlacement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: PanelOrientation;
  /** Ângulo em graus (0 ou 90). Base para rotação horária/anti-horária futura. */
  rotationDeg: number;
  selectable?: boolean;
}

export type RoofLayoutStrategy = 'uniform_portrait' | 'uniform_landscape' | 'mixed' | 'max';

/** Ponto 2D em metros (sistema do telhado). */
export interface Point2D {
  x: number;
  y: number;
}

/** Forma do telhado: retângulo clássico ou polígono irregular. */
export type RoofShapeMode = 'rectangle' | 'polygon';

export type ObstacleKind =
  | 'chimney'
  | 'water_tank'
  | 'vent'
  | 'skylight'
  | 'shade'
  | 'custom';

export type ObstacleShape = 'rect' | 'circle';

/** Zona de exclusão (obstáculo) sobre o telhado. */
export interface RoofObstacle {
  id: string;
  kind: ObstacleKind;
  label: string;
  shape: ObstacleShape;
  /** Canto superior-esquerdo (retângulo) ou centro (círculo), em metros. */
  x: number;
  y: number;
  widthM: number;
  heightM: number;
  /** Usado quando shape === 'circle'. */
  radiusM?: number;
  /** Afastamento de segurança ao redor do obstáculo (m). */
  clearanceM: number;
  /** Rotação em graus (horário positivo). Círculos ignoram. */
  rotationDeg?: number;
}

export interface RoofPolygon {
  /** Vértices em ordem (horário ou anti-horário), em metros. */
  vertices: Point2D[];
  /** Comprimentos reais digitados por aresta (m); índice i = aresta vertices[i]→vertices[i+1]. */
  edgeLengthsM: Array<number | null>;
}

/** Faixa de exclusão do corredor de manutenção, em metros. */
export interface LayoutCorridorBand {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Corredor opcional inserido a cada N fileiras. */
export interface MaintenanceCorridorConfig {
  enabled: boolean;
  widthM: number;
  everyRows: number;
}

export interface RoofLayoutOption {
  id: string;
  label: string;
  strategy: RoofLayoutStrategy;
  panelCount: number;
  orientationSummary: string;
  usableWidthM: number;
  usableLengthM: number;
  edgeMarginM: number;
  panelGapM: number;
  endClampM?: number;
  roofWidthM: number;
  roofLengthM: number;
  /** Área total do perímetro do telhado (m²). */
  totalRoofAreaM2?: number;
  /** Área útil de instalação após perímetro, obstáculos e corredores (m²). */
  usefulAreaM2?: number;
  placements: PanelPlacement[];
  /** Faixas de corredor de manutenção desenhadas entre grupos de fileiras. */
  corridors?: LayoutCorridorBand[];
  totalPowerKwp: number;
  estimatedMonthlyGenerationKwh: number;
  polygon?: Point2D[];
  obstacles?: RoofObstacle[];
}

export interface RoofLayoutComputation {
  options: RoofLayoutOption[];
  bestOptionId: string;
  totalRoofAreaM2: number;
  usefulAreaM2: number;
}

export interface AiReviewResult {
  coherent: boolean;
  summary: string;
  observations: string[];
  suggestions: string[];
  rawText: string;
}

export type AiReviewPayload =
  | { kind: 'monthly'; result: ConsumptionMonthlyResult }
  | { kind: 'daily'; result: ConsumptionDailyResult }
  | { kind: 'roof_direct'; result: RoofDirectResult }
  | { kind: 'roof_inverse'; result: RoofInverseResult };
