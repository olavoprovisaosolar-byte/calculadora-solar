import {
  DEFAULT_CORRIDOR_EVERY_ROWS,
  DEFAULT_CORRIDOR_WIDTH_M,
  DEFAULT_EDGE_MARGIN_M,
  DEFAULT_END_CLAMP_M,
  DEFAULT_PANEL_GAP_M,
  END_CLAMP_MAX_M,
  END_CLAMP_MIN_M,
  KWH_PER_KWP_MONTH,
} from '../constants/modules';
import {
  LayoutCorridorBand,
  MaintenanceCorridorConfig,
  PanelOrientation,
  PanelPlacement,
  Point2D,
  RoofLayoutComputation,
  RoofLayoutOption,
  RoofObstacle,
  SolarModule,
} from '../types';
import {
  anyObstacleHits,
  boundingBox,
  normalizePolygonOrigin,
  obstaclesArea,
  polygonArea,
  rectInsidePolygon,
  rectanglePolygon,
  round2,
} from './roofGeometry';

function panelSize(
  module: SolarModule,
  orientation: PanelOrientation,
): { w: number; h: number } {
  if (orientation === 'portrait') {
    return { w: module.widthM, h: module.lengthM };
  }
  return { w: module.lengthM, h: module.widthM };
}

function summarizeOrientations(placements: PanelPlacement[]): string {
  const portrait = placements.filter((p) => p.orientation === 'portrait').length;
  const landscape = placements.filter((p) => p.orientation === 'landscape').length;
  if (portrait > 0 && landscape > 0) {
    return `${portrait} na Vertical + ${landscape} na Horizontal`;
  }
  if (landscape > 0) {
    return landscape === 1
      ? '1 placa na Horizontal'
      : `Todas as ${landscape} placas na Horizontal`;
  }
  if (portrait > 0) {
    return portrait === 1
      ? '1 placa na Vertical'
      : `Todas as ${portrait} placas na Vertical`;
  }
  return 'Sem placas';
}

/** Texto de destaque do arranjo otimizado. */
export function formatOptimizedArrangement(option: RoofLayoutOption | null): string {
  if (!option || option.panelCount <= 0) {
    return 'Arranjo Otimizado: nenhuma placa encaixou com as dimensões atuais';
  }
  return `Arranjo Otimizado: ${option.panelCount} placas · ${option.orientationSummary}`;
}

function toOption(params: {
  id: string;
  label: string;
  strategy: RoofLayoutOption['strategy'];
  placements: PanelPlacement[];
  usableW: number;
  usableL: number;
  edgeMarginM: number;
  panelGapM: number;
  endClampM: number;
  roofWidthM: number;
  roofLengthM: number;
  totalRoofAreaM2: number;
  usefulAreaM2: number;
  module: SolarModule;
  polygon: Point2D[];
  obstacles: RoofObstacle[];
  corridors?: LayoutCorridorBand[];
}): RoofLayoutOption {
  const panelCount = params.placements.length;
  const totalPowerKwp = round2((panelCount * params.module.powerWp) / 1000);
  return {
    id: params.id,
    label: params.label,
    strategy: params.strategy,
    panelCount,
    orientationSummary: summarizeOrientations(params.placements),
    usableWidthM: round2(params.usableW),
    usableLengthM: round2(params.usableL),
    edgeMarginM: params.edgeMarginM,
    panelGapM: params.panelGapM,
    endClampM: params.endClampM,
    roofWidthM: params.roofWidthM,
    roofLengthM: params.roofLengthM,
    totalRoofAreaM2: round2(params.totalRoofAreaM2),
    usefulAreaM2: round2(params.usefulAreaM2),
    placements: params.placements,
    corridors: params.corridors ?? [],
    totalPowerKwp,
    estimatedMonthlyGenerationKwh: round2(totalPowerKwp * KWH_PER_KWP_MONTH),
    polygon: params.polygon,
    obstacles: params.obstacles,
  };
}

export function normalizeMaintenanceCorridor(
  corridor?: MaintenanceCorridorConfig | null,
): MaintenanceCorridorConfig {
  if (!corridor?.enabled) {
    return { enabled: false, widthM: DEFAULT_CORRIDOR_WIDTH_M, everyRows: DEFAULT_CORRIDOR_EVERY_ROWS };
  }
  const every = Math.min(20, Math.max(1, Math.round(corridor.everyRows || DEFAULT_CORRIDOR_EVERY_ROWS)));
  const width =
    Number.isFinite(corridor.widthM) && corridor.widthM > 0
      ? corridor.widthM
      : DEFAULT_CORRIDOR_WIDTH_M;
  return { enabled: true, widthM: width, everyRows: every };
}

/** Mid clamp é obrigatório: 2 cm entre placas vizinhas. */
export function rigidPanelGapM(): number {
  return DEFAULT_PANEL_GAP_M;
}

/** End clamp fica entre 3 cm e 5 cm. */
export function rigidEndClampM(value?: number): number {
  if (!Number.isFinite(value)) return DEFAULT_END_CLAMP_M;
  return Math.min(END_CLAMP_MAX_M, Math.max(END_CLAMP_MIN_M, value as number));
}

/** Espaço depois da fileira `rowIndex0`: corredor a cada N, senão mid clamp. */
function gapFollowingRow(
  rowIndex0: number,
  midGap: number,
  corridor: MaintenanceCorridorConfig,
): { gap: number; isCorridor: boolean } {
  const completed = rowIndex0 + 1;
  if (corridor.enabled && completed % corridor.everyRows === 0) {
    return { gap: corridor.widthM, isCorridor: true };
  }
  return { gap: midGap, isCorridor: false };
}

function overlapsAny(
  x: number,
  y: number,
  w: number,
  h: number,
  rects: Array<{ x: number; y: number; w: number; h: number }>,
): boolean {
  return rects.some(
    (o) => x < o.x + o.w && x + w > o.x && y < o.y + o.h && y + h > o.y,
  );
}

/** Mid clamp: placas vizinhas precisam de pelo menos `gap` entre os corpos. */
function closerThanGap(
  x: number,
  y: number,
  w: number,
  h: number,
  rects: Array<{ x: number; y: number; w: number; h: number; kind?: 'panel' | 'corridor' }>,
  gap: number,
): boolean {
  if (gap <= 0) return false;
  return rects.some(
    (o) =>
      x < o.x + o.w + gap - 1e-9 &&
      x + w + gap - 1e-9 > o.x &&
      y < o.y + o.h + gap - 1e-9 &&
      y + h + gap - 1e-9 > o.y,
  );
}

/** Empacota uma fileira (shelf) de placas na orientação dada, em y fixo. */
function packShelfRow(params: {
  y: number;
  panelW: number;
  panelH: number;
  orientation: PanelOrientation;
  startX: number;
  endX: number;
  gap: number;
  polygon: Point2D[];
  obstacles: RoofObstacle[];
  blocked: Array<{ x: number; y: number; w: number; h: number }>;
  idPrefix: string;
  indexStart: number;
}): PanelPlacement[] {
  const stepX = params.panelW + params.gap;
  const placements: PanelPlacement[] = [];
  let index = params.indexStart;
  for (let x = params.startX; x + params.panelW <= params.endX + 1e-9; x += stepX) {
    if (!rectInsidePolygon(x, params.y, params.panelW, params.panelH, params.polygon)) {
      continue;
    }
    if (anyObstacleHits(params.obstacles, x, params.y, params.panelW, params.panelH)) {
      continue;
    }
    if (overlapsAny(x, params.y, params.panelW, params.panelH, params.blocked)) {
      continue;
    }
    placements.push({
      id: `${params.idPrefix}-${index}`,
      x: round2(x),
      y: round2(params.y),
      width: params.panelW,
      height: params.panelH,
      orientation: params.orientation,
      rotationDeg: params.orientation === 'landscape' ? 90 : 0,
      selectable: true,
    });
    index += 1;
  }
  return placements;
}

/**
 * Empacota placas em malha regular, aceitando só células 100% dentro do polígono
 * e fora dos obstáculos (com clearance).
 */
function packUniformInPolygon(params: {
  polygon: Point2D[];
  obstacles: RoofObstacle[];
  module: SolarModule;
  orientation: PanelOrientation;
  gap: number;
  endClampM: number;
  edgeMarginM: number;
  corridor: MaintenanceCorridorConfig;
  idPrefix: string;
}): { count: number; placements: PanelPlacement[]; corridors: LayoutCorridorBand[] } {
  const { w: panelW, h: panelH } = panelSize(params.module, params.orientation);
  if (panelW <= 0 || panelH <= 0) return { count: 0, placements: [], corridors: [] };

  const box = boundingBox(params.polygon);
  const startX = box.minX + params.edgeMarginM + params.endClampM;
  const startY = box.minY + params.edgeMarginM;
  const endX = box.maxX - params.edgeMarginM - params.endClampM;
  const endY = box.maxY - params.edgeMarginM;
  const stepX = panelW + params.gap;

  if (endX - startX < panelW || endY - startY < panelH) {
    return { count: 0, placements: [], corridors: [] };
  }

  const placements: PanelPlacement[] = [];
  const corridors: LayoutCorridorBand[] = [];
  let index = 0;
  let y = startY;
  let row = 0;
  while (y + panelH <= endY + 1e-9) {
    for (let x = startX; x + panelW <= endX + 1e-9; x += stepX) {
      if (!rectInsidePolygon(x, y, panelW, panelH, params.polygon)) continue;
      if (anyObstacleHits(params.obstacles, x, y, panelW, panelH)) continue;
      placements.push({
        id: `${params.idPrefix}-${index}`,
        x: round2(x),
        y: round2(y),
        width: panelW,
        height: panelH,
        orientation: params.orientation,
        rotationDeg: params.orientation === 'landscape' ? 90 : 0,
        selectable: true,
      });
      index += 1;
    }
    const following = gapFollowingRow(row, params.gap, params.corridor);
    if (following.isCorridor) {
      const bandTop = y + panelH;
      const bandH = Math.min(following.gap, Math.max(0, endY - bandTop));
      if (bandH > 1e-6) {
        corridors.push({
          x: round2(startX),
          y: round2(bandTop),
          width: round2(Math.max(0, endX - startX)),
          height: round2(bandH),
        });
      }
    }
    y += panelH + following.gap;
    row += 1;
  }
  return { count: placements.length, placements, corridors };
}

type ShelfOrient = PanelOrientation;

/**
 * Packing por prateleiras (shelves): escolhe a sequência de fileiras
 * Vertical/Horizontal que maximiza a quantidade de placas.
 * Também tenta preencher a faixa residual inferior com a outra orientação.
 */
function packShelfMixed(params: {
  polygon: Point2D[];
  obstacles: RoofObstacle[];
  module: SolarModule;
  gap: number;
  endClampM: number;
  edgeMarginM: number;
  corridor: MaintenanceCorridorConfig;
}): { count: number; placements: PanelPlacement[]; corridors: LayoutCorridorBand[]; edgeUsedM: number } {
  const box = boundingBox(params.polygon);
  const gap = params.gap;

  const tryWithEdges = (edgeTop: number, edgeBottom: number, edgeX: number) => {
    const startX = box.minX + edgeX + params.endClampM;
    const endX = box.maxX - edgeX - params.endClampM;
    const startY = box.minY + edgeTop;
    const endY = box.maxY - edgeBottom;
    const usableL = endY - startY;
    const usableW = endX - startX;
    if (usableL <= 0 || usableW <= 0) {
      return { count: 0, placements: [] as PanelPlacement[], corridors: [], edgeUsedM: edgeX };
    }

    const sizes: Record<ShelfOrient, { w: number; h: number }> = {
      portrait: panelSize(params.module, 'portrait'),
      landscape: panelSize(params.module, 'landscape'),
    };

    // DP: melhor contagem para altura exata usada (discretizada em mm)
    const scale = 1000;
    const H = Math.max(0, Math.floor(usableL * scale + 1e-6));
    const shelfHeights: Array<{ orient: ShelfOrient; h: number; cols: number }> = [];
    (['portrait', 'landscape'] as ShelfOrient[]).forEach((orient) => {
      const { w, h } = sizes[orient];
      const cols = Math.floor((usableW + gap) / (w + gap));
      if (cols > 0 && h > 0) {
        shelfHeights.push({ orient, h, cols });
      }
    });

    const modCount = params.corridor.enabled ? params.corridor.everyRows : 1;
    const bestCount: number[][] = Array.from({ length: H + 1 }, () => Array(modCount).fill(-1));
    type ShelfParent = {
      prevH: number;
      prevMod: number;
      orient: ShelfOrient;
      h: number;
      gapBefore: number;
      corridorBefore: boolean;
    };
    const parent: Array<Array<ShelfParent | null>> = Array.from({ length: H + 1 }, () =>
      Array(modCount).fill(null),
    );
    bestCount[0][0] = 0;

    for (let h = 0; h <= H; h += 1) {
      for (let mod = 0; mod < modCount; mod += 1) {
        if (bestCount[h][mod] < 0) continue;
        for (const shelf of shelfHeights) {
          const shelfMm = Math.ceil(shelf.h * scale - 1e-6);
          const corridorBefore = h > 0 && params.corridor.enabled && mod === 0;
          const gapBefore = h === 0 ? 0 : corridorBefore ? params.corridor.widthM : gap;
          const gapMm = Math.ceil(gapBefore * scale - 1e-6);
          const next = h + gapMm + shelfMm;
          if (next > H) continue;
          const nextMod = (mod + 1) % modCount;
          const cand = bestCount[h][mod] + shelf.cols;
          if (cand >= bestCount[next][nextMod]) {
            bestCount[next][nextMod] = cand;
            parent[next][nextMod] = {
              prevH: h,
              prevMod: mod,
              orient: shelf.orient,
              h: shelf.h,
              gapBefore,
              corridorBefore,
            };
          }
        }
      }
    }

    let bestH = 0;
    let bestMod = 0;
    for (let h = 0; h <= H; h += 1) {
      for (let mod = 0; mod < modCount; mod += 1) {
        const count = bestCount[h][mod];
        const best = bestCount[bestH][bestMod];
        if (count > best || (count === best && h > bestH)) {
          bestH = h;
          bestMod = mod;
        }
      }
    }

    const sequence: ShelfParent[] = [];
    let curH = bestH;
    let curMod = bestMod;
    while (curH > 0 && parent[curH][curMod]) {
      const step = parent[curH][curMod]!;
      sequence.push(step);
      curH = step.prevH;
      curMod = step.prevMod;
    }
    sequence.reverse();

    const placements: PanelPlacement[] = [];
    const corridors: LayoutCorridorBand[] = [];
    const blocked: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      kind?: 'panel' | 'corridor';
    }> = [];
    let y = startY;
    let index = 0;
    for (let i = 0; i < sequence.length; i += 1) {
      const step = sequence[i];
      if (step.corridorBefore && step.gapBefore > 1e-6) {
        corridors.push({
          x: round2(startX),
          y: round2(y),
          width: round2(Math.max(0, endX - startX)),
          height: round2(step.gapBefore),
        });
        blocked.push({
          x: startX,
          y,
          w: endX - startX,
          h: step.gapBefore,
          kind: 'corridor',
        });
      }
      y += step.gapBefore;
      const { orient, h: shelfH } = step;
      const { w: panelW, h: panelH } = sizes[orient];
      const row = packShelfRow({
        y,
        panelW,
        panelH,
        orientation: orient,
        startX,
        endX,
        gap,
        polygon: params.polygon,
        obstacles: params.obstacles,
        blocked,
        idPrefix: `shelf-${orient}`,
        indexStart: index,
      });
      for (const p of row) {
        placements.push(p);
        blocked.push({ x: p.x, y: p.y, w: p.width, h: p.height, kind: 'panel' });
      }
      index += row.length;
      y += shelfH;
    }

    // Preenche faixa residual inferior (e laterais via scan fino) com ambas orientações
    const fillRemainder = (orient: ShelfOrient) => {
      const { w: panelW, h: panelH } = sizes[orient];
      // Alinha a fileira residual na base útil quando possível
      const bottomY = endY - panelH;
      const candidateYs = [bottomY, y + (sequence.length > 0 ? gap : 0)];
      for (const cy of candidateYs) {
        if (cy < startY - 1e-9 || cy + panelH > endY + 1e-9) continue;
        const row = packShelfRow({
          y: cy,
          panelW,
          panelH,
          orientation: orient,
          startX,
          endX,
          gap,
          polygon: params.polygon,
          obstacles: params.obstacles,
          blocked,
          idPrefix: `rem-${orient}`,
          indexStart: index,
        });
        if (row.length === 0) continue;
        for (const p of row) {
          placements.push(p);
          blocked.push({ x: p.x, y: p.y, w: p.width, h: p.height, kind: 'panel' });
        }
        index += row.length;
      }
      // Scan fino no retângulo residual para nichos (obstáculos / polígono)
      const scanStart = Math.min(y, bottomY);
      const step = Math.min(panelW, panelH, 0.2);
      for (let sy = Math.max(startY, scanStart); sy + panelH <= endY + 1e-9; sy += step) {
        for (let sx = startX; sx + panelW <= endX + 1e-9; sx += step) {
          if (!rectInsidePolygon(sx, sy, panelW, panelH, params.polygon)) continue;
          if (anyObstacleHits(params.obstacles, sx, sy, panelW, panelH)) continue;
          if (overlapsAny(sx, sy, panelW, panelH, blocked)) continue;
          if (
            closerThanGap(
              sx,
              sy,
              panelW,
              panelH,
              blocked.filter((b) => b.kind !== 'corridor'),
              gap,
            )
          ) {
            continue;
          }
          const p: PanelPlacement = {
            id: `scan-${orient}-${index}`,
            x: round2(sx),
            y: round2(sy),
            width: panelW,
            height: panelH,
            orientation: orient,
            rotationDeg: orient === 'landscape' ? 90 : 0,
            selectable: true,
          };
          placements.push(p);
          blocked.push({ x: p.x, y: p.y, w: p.width, h: p.height, kind: 'panel' });
          index += 1;
        }
      }
    };

    fillRemainder('landscape');
    fillRemainder('portrait');

    return {
      count: placements.length,
      placements,
      corridors,
      edgeUsedM: edgeX,
    };
  };

  return tryWithEdges(params.edgeMarginM, params.edgeMarginM, params.edgeMarginM);
}

/**
 * Calcula sugestões de arranjo dinâmico.
 * Suporta retângulo clássico ou polígono irregular + obstáculos.
 */
export function computeRoofLayouts(params: {
  roofWidthM?: number;
  roofLengthM?: number;
  polygon?: Point2D[];
  obstacles?: RoofObstacle[];
  module: SolarModule;
  edgeMarginM?: number;
  panelGapM?: number;
  endClampM?: number;
  corridor?: MaintenanceCorridorConfig | null;
}): RoofLayoutComputation {
  const edgeMarginM = params.edgeMarginM ?? DEFAULT_EDGE_MARGIN_M;
  const panelGapM = rigidPanelGapM();
  const endClampM = rigidEndClampM(params.endClampM ?? DEFAULT_END_CLAMP_M);
  const corridor = normalizeMaintenanceCorridor(params.corridor);
  const obstacles = params.obstacles ?? [];

  let polygon: Point2D[];
  if (params.polygon && params.polygon.length >= 3) {
    polygon = normalizePolygonOrigin(params.polygon);
  } else {
    const w = params.roofWidthM ?? 0;
    const l = params.roofLengthM ?? 0;
    polygon = rectanglePolygon(w, l);
  }

  const box = boundingBox(polygon);
  const roofWidthM = box.width;
  const roofLengthM = box.height;
  const totalRoofAreaM2 = polygonArea(polygon);
  const usefulAreaM2 = Math.max(
    0,
    totalRoofAreaM2 - obstaclesArea(obstacles) - estimateMarginBand(polygon, edgeMarginM),
  );

  const base = {
    polygon,
    obstacles,
    module: params.module,
    gap: panelGapM,
    endClampM,
    edgeMarginM,
    corridor,
  };

  const portrait = packUniformInPolygon({
    ...base,
    orientation: 'portrait',
    idPrefix: 'p',
  });
  const landscape = packUniformInPolygon({
    ...base,
    orientation: 'landscape',
    idPrefix: 'l',
  });

  const mixed = packShelfMixed(base);

  const usableW = Math.max(0, roofWidthM - 2 * edgeMarginM - 2 * endClampM);
  const usableL = Math.max(0, roofLengthM - 2 * edgeMarginM);

  const common = {
    usableW,
    usableL,
    edgeMarginM,
    panelGapM,
    endClampM,
    roofWidthM,
    roofLengthM,
    totalRoofAreaM2,
    usefulAreaM2,
    module: params.module,
    polygon,
    obstacles,
  };

  const corridorArea = (bands: LayoutCorridorBand[]) =>
    bands.reduce((sum, band) => sum + Math.max(0, band.width) * Math.max(0, band.height), 0);

  const withCorridors = (
    partial: Omit<Parameters<typeof toOption>[0], 'usefulAreaM2' | 'corridors'> & {
      corridors: LayoutCorridorBand[];
    },
  ) =>
    toOption({
      ...partial,
      usefulAreaM2: Math.max(0, usefulAreaM2 - corridorArea(partial.corridors)),
      corridors: partial.corridors,
    });

  const portraitOpt = withCorridors({
    id: 'uniform-portrait',
    label: 'Arranjo padronizado (Vertical)',
    strategy: 'uniform_portrait',
    placements: portrait.placements,
    corridors: portrait.corridors,
    ...common,
  });
  const landscapeOpt = withCorridors({
    id: 'uniform-landscape',
    label: 'Arranjo padronizado (Horizontal)',
    strategy: 'uniform_landscape',
    placements: landscape.placements,
    corridors: landscape.corridors,
    ...common,
  });
  const mixedOpt = withCorridors({
    id: 'mixed',
    label: 'Arranjo misto (preenche faixas)',
    strategy: 'mixed',
    placements: mixed.placements,
    corridors: mixed.corridors,
    ...common,
  });

  const uniformBest =
    portraitOpt.panelCount >= landscapeOpt.panelCount ? portraitOpt : landscapeOpt;
  const maxCandidate = [portraitOpt, landscapeOpt, mixedOpt].sort(
    (a, b) => b.panelCount - a.panelCount,
  )[0];

  const optionA: RoofLayoutOption = {
    ...maxCandidate,
    id: 'option-a-max',
    label: 'Opção A: Máximo de placas',
    strategy: 'max',
  };
  const optionB: RoofLayoutOption = {
    ...uniformBest,
    id: 'option-b-uniform',
    label: 'Opção B: Arranjo padronizado',
  };

  return {
    options: [optionA, optionB],
    bestOptionId: optionA.id,
    totalRoofAreaM2: round2(totalRoofAreaM2),
    usefulAreaM2: round2(optionA.usefulAreaM2 ?? usefulAreaM2),
  };
}

export type MinimumRoofFit = {
  roofWidthM: number;
  roofLengthM: number;
  totalRoofAreaM2: number;
  usefulAreaM2: number;
  panelCount: number;
  totalPowerKwp: number;
  estimatedMonthlyGenerationKwh: number;
  orientationSummary: string;
  edgeMarginM: number;
  panelGapM: number;
  endClampM: number;
};

function spanForCount(count: number, panel: number, gap: number): number {
  if (count <= 0) return 0;
  return count * panel + Math.max(0, count - 1) * gap;
}

function lengthForRows(
  rows: number,
  panelH: number,
  gap: number,
  corridor: MaintenanceCorridorConfig,
): number {
  if (rows <= 0) return 0;
  let extra = 0;
  for (let row = 0; row < rows - 1; row += 1) {
    extra += gapFollowingRow(row, gap, corridor).gap;
  }
  return rows * panelH + extra;
}

function ceilMm(value: number): number {
  return Math.ceil((value - 1e-9) * 1000) / 1000;
}

/**
 * Menor retângulo que comporta `quantity` placas com a mesma folga,
 * os mesmos grampos e o mesmo corredor do Layout 2D.
 * A contagem devolvida é a do computeRoofLayouts nesse retângulo.
 */
export function minimumRoofForQuantity(params: {
  module: SolarModule;
  quantity: number;
  edgeMarginM?: number;
  endClampM?: number;
  corridor?: MaintenanceCorridorConfig | null;
}): MinimumRoofFit | null {
  const quantity = Math.floor(params.quantity);
  if (!params.module || quantity <= 0) return null;
  const edgeMarginM =
    params.edgeMarginM != null && Number.isFinite(params.edgeMarginM) && params.edgeMarginM >= 0
      ? params.edgeMarginM
      : DEFAULT_EDGE_MARGIN_M;
  const endClampM = rigidEndClampM(params.endClampM ?? DEFAULT_END_CLAMP_M);
  const corridor = normalizeMaintenanceCorridor(params.corridor);
  const gap = rigidPanelGapM();

  const bestBox: { current: (MinimumRoofFit & { areaRaw: number }) | null } = { current: null };

  const consider = (widthM: number, lengthM: number) => {
    let layout = computeRoofLayouts({
      roofWidthM: widthM,
      roofLengthM: lengthM,
      module: params.module,
      edgeMarginM,
      endClampM,
      corridor,
    });
    let option = layout.options[0];
    if (!option || option.panelCount < quantity) {
      widthM = ceilMm(widthM + 0.01);
      lengthM = ceilMm(lengthM + 0.01);
      layout = computeRoofLayouts({
        roofWidthM: widthM,
        roofLengthM: lengthM,
        module: params.module,
        edgeMarginM,
        endClampM,
        corridor,
      });
      option = layout.options[0];
    }
    if (!option || option.panelCount < quantity) return;
    const areaRaw = widthM * lengthM;
    const candidate: MinimumRoofFit & { areaRaw: number } = {
      roofWidthM: widthM,
      roofLengthM: lengthM,
      totalRoofAreaM2: layout.totalRoofAreaM2,
      usefulAreaM2: layout.usefulAreaM2,
      panelCount: option.panelCount,
      totalPowerKwp: option.totalPowerKwp,
      estimatedMonthlyGenerationKwh: option.estimatedMonthlyGenerationKwh,
      orientationSummary: option.orientationSummary,
      edgeMarginM,
      panelGapM: gap,
      endClampM,
      areaRaw,
    };
    const best = bestBox.current;
    if (
      !best ||
      areaRaw < best.areaRaw - 1e-6 ||
      (Math.abs(areaRaw - best.areaRaw) <= 1e-6 && option.panelCount < best.panelCount)
    ) {
      bestBox.current = candidate;
    }
  };

  (['portrait', 'landscape'] as PanelOrientation[]).forEach((orientation) => {
    const { w, h } = panelSize(params.module, orientation);
    for (let cols = 1; cols <= quantity; cols += 1) {
      const rows = Math.ceil(quantity / cols);
      const widthM = ceilMm(spanForCount(cols, w, gap) + 2 * edgeMarginM + 2 * endClampM);
      const lengthM = ceilMm(lengthForRows(rows, h, gap, corridor) + 2 * edgeMarginM);
      consider(widthM, lengthM);
    }
  });

  const best = bestBox.current;
  if (!best) return null;
  return {
    roofWidthM: best.roofWidthM,
    roofLengthM: best.roofLengthM,
    totalRoofAreaM2: best.totalRoofAreaM2,
    usefulAreaM2: best.usefulAreaM2,
    panelCount: best.panelCount,
    totalPowerKwp: best.totalPowerKwp,
    estimatedMonthlyGenerationKwh: best.estimatedMonthlyGenerationKwh,
    orientationSummary: best.orientationSummary,
    edgeMarginM: best.edgeMarginM,
    panelGapM: best.panelGapM,
    endClampM: best.endClampM,
  };
}

/** Estimativa da faixa de margem de borda (área do anel ≈ perímetro × margem). */
function estimateMarginBand(polygon: Point2D[], edgeMarginM: number): number {
  if (polygon.length < 2 || edgeMarginM <= 0) return 0;
  let peri = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    peri += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return peri * edgeMarginM;
}
