import { Point2D, RoofObstacle } from '../types';

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function dist(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function polygonArea(vertices: Point2D[]): number {
  if (vertices.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const j = (i + 1) % vertices.length;
    sum += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
  }
  return Math.abs(sum) / 2;
}

export function boundingBox(vertices: Point2D[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (vertices.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  let minX = vertices[0].x;
  let minY = vertices[0].y;
  let maxX = vertices[0].x;
  let maxY = vertices[0].y;
  for (const p of vertices) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/** Ponto sobre aresta (inclusive), com tolerância numérica. */
function pointOnSegment(point: Point2D, a: Point2D, b: Point2D, eps = 1e-9): boolean {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const cross = apx * aby - apy * abx;
  const len = Math.hypot(abx, aby);
  if (len <= eps) {
    return Math.hypot(apx, apy) <= eps;
  }
  if (Math.abs(cross) > eps * Math.max(1, len)) return false;
  const dot = apx * abx + apy * aby;
  if (dot < -eps) return false;
  if (dot > len * len + eps) return false;
  return true;
}

/**
 * Ray-casting point-in-polygon.
 * Pontos exatamente sobre a borda contam como dentro, para a placa
 * encostar na folga útil sem ser rejeitada.
 */
export function pointInPolygon(point: Point2D, vertices: Point2D[]): boolean {
  if (vertices.length < 3) return false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i, i += 1) {
    if (pointOnSegment(point, vertices[j], vertices[i])) return true;
  }
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i, i += 1) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Retângulo axis-aligned totalmente dentro do polígono (cantos + centro + mid-edges). */
export function rectInsidePolygon(
  x: number,
  y: number,
  w: number,
  h: number,
  vertices: Point2D[],
): boolean {
  const samples: Point2D[] = [
    { x, y },
    { x: x + w, y },
    { x, y: y + h },
    { x: x + w, y: y + h },
    { x: x + w / 2, y: y + h / 2 },
    { x: x + w / 2, y },
    { x: x + w / 2, y: y + h },
    { x, y: y + h / 2 },
    { x: x + w, y: y + h / 2 },
  ];
  return samples.every((p) => pointInPolygon(p, vertices));
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function circleOverlapsRect(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  const nearestX = Math.max(rx, Math.min(cx, rx + rw));
  const nearestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < r * r;
}

/** AABB de um retângulo rotacionado em torno do centro (graus). */
export function rotatedRectAabb(
  x: number,
  y: number,
  w: number,
  h: number,
  rotationDeg = 0,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ].map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  });
  let minX = corners[0].x;
  let minY = corners[0].y;
  let maxX = corners[0].x;
  let maxY = corners[0].y;
  for (const c of corners) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x);
    maxY = Math.max(maxY, c.y);
  }
  return { minX, minY, maxX, maxY };
}

/** Obstáculo expandido pela folga de segurança (respeita rotação). */
export function obstacleHitsRect(
  obstacle: RoofObstacle,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  const clear = Math.max(0, obstacle.clearanceM || 0);
  if (obstacle.shape === 'circle') {
    const r = (obstacle.radiusM ?? Math.min(obstacle.widthM, obstacle.heightM) / 2) + clear;
    return circleOverlapsRect(obstacle.x, obstacle.y, r, x, y, w, h);
  }
  const rot = obstacle.rotationDeg ?? 0;
  const aabb = rotatedRectAabb(
    obstacle.x - clear,
    obstacle.y - clear,
    obstacle.widthM + 2 * clear,
    obstacle.heightM + 2 * clear,
    rot,
  );
  return rectsOverlap(
    aabb.minX,
    aabb.minY,
    aabb.maxX - aabb.minX,
    aabb.maxY - aabb.minY,
    x,
    y,
    w,
    h,
  );
}

/** Limita posição/tamanho do obstáculo ao bounding box do telhado. */
export function clampObstacleToRoof(
  obstacle: Pick<RoofObstacle, 'shape' | 'x' | 'y' | 'widthM' | 'heightM' | 'radiusM'>,
  roofW: number,
  roofH: number,
): { x: number; y: number; widthM: number; heightM: number; radiusM?: number } {
  if (obstacle.shape === 'circle') {
    const r = obstacle.radiusM ?? Math.min(obstacle.widthM, obstacle.heightM) / 2;
    const cx = Math.min(Math.max(obstacle.x, r), Math.max(r, roofW - r));
    const cy = Math.min(Math.max(obstacle.y, r), Math.max(r, roofH - r));
    return { x: cx, y: cy, widthM: r * 2, heightM: r * 2, radiusM: r };
  }
  const widthM = Math.min(Math.max(0.2, obstacle.widthM), roofW);
  const heightM = Math.min(Math.max(0.2, obstacle.heightM), roofH);
  const x = Math.min(Math.max(0, obstacle.x), Math.max(0, roofW - widthM));
  const y = Math.min(Math.max(0, obstacle.y), Math.max(0, roofH - heightM));
  return { x, y, widthM, heightM };
}

export function anyObstacleHits(
  obstacles: RoofObstacle[],
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  return obstacles.some((o) => obstacleHitsRect(o, x, y, w, h));
}

/** Área aproximada dos obstáculos (sem double-count; soma bruta). */
export function obstaclesArea(obstacles: RoofObstacle[]): number {
  return obstacles.reduce((sum, o) => {
    if (o.shape === 'circle') {
      const r = o.radiusM ?? Math.min(o.widthM, o.heightM) / 2;
      return sum + Math.PI * r * r;
    }
    return sum + o.widthM * o.heightM;
  }, 0);
}

export function rectanglePolygon(widthM: number, lengthM: number): Point2D[] {
  return [
    { x: 0, y: 0 },
    { x: widthM, y: 0 },
    { x: widthM, y: lengthM },
    { x: 0, y: lengthM },
  ];
}

/**
 * Escala o polígono para que a aresta `edgeIndex` tenha `targetLengthM`,
 * preservando proporções (calibração por comprimento real).
 */
export function scalePolygonToEdge(
  vertices: Point2D[],
  edgeIndex: number,
  targetLengthM: number,
): Point2D[] {
  if (vertices.length < 2 || targetLengthM <= 0) return vertices;
  const a = vertices[edgeIndex % vertices.length];
  const b = vertices[(edgeIndex + 1) % vertices.length];
  const current = dist(a, b);
  if (current <= 0) return vertices;
  const factor = targetLengthM / current;
  const cx = vertices.reduce((s, p) => s + p.x, 0) / vertices.length;
  const cy = vertices.reduce((s, p) => s + p.y, 0) / vertices.length;
  return vertices.map((p) => ({
    x: cx + (p.x - cx) * factor,
    y: cy + (p.y - cy) * factor,
  }));
}

/** Normaliza polígono para origem (0,0) no canto mínimo. */
export function normalizePolygonOrigin(vertices: Point2D[]): Point2D[] {
  const box = boundingBox(vertices);
  return vertices.map((p) => ({ x: p.x - box.minX, y: p.y - box.minY }));
}

export const OBSTACLE_KIND_LABELS: Record<string, string> = {
  chimney: 'Chaminé',
  water_tank: "Caixa d'água",
  vent: 'Respiro',
  skylight: 'Claraboia',
  shade: 'Área de sombra',
  custom: 'Customizado',
};
