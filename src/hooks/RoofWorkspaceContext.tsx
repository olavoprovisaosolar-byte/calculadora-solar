import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  DEFAULT_AREA_MARGIN,
  DEFAULT_CORRIDOR_EVERY_ROWS,
  DEFAULT_CORRIDOR_WIDTH_M,
  DEFAULT_EDGE_MARGIN_M,
  DEFAULT_END_CLAMP_M,
  DEFAULT_OBSTACLE_CLEARANCE_M,
  DEFAULT_PANEL_GAP_M,
} from '../constants/modules';
import { useModules } from '../hooks/useModules';
import {
  RoofWorkspaceDraft,
  loadAppBackup,
  patchAppBackup,
  subscribeAppBackup,
} from '../services/appBackup';
import {
  MaintenanceCorridorConfig,
  ObstacleKind,
  ObstacleShape,
  Point2D,
  RoofLayoutOption,
  RoofObstacle,
  RoofShapeMode,
  SolarModule,
} from '../types';
import { parseLocaleNumber } from '../utils/calculations';
import {
  OBSTACLE_KIND_LABELS,
  boundingBox,
  clampObstacleToRoof,
  normalizePolygonOrigin,
  polygonArea,
  scalePolygonToEdge,
} from '../utils/roofGeometry';
import { computeRoofLayouts, normalizeMaintenanceCorridor, rigidEndClampM } from '../utils/roofLayout';

export type RoofSubTab = 'calc' | 'layout';
export type RoofCalcMode = 'direct' | 'inverse';

type RoofWorkspaceValue = {
  subTab: RoofSubTab;
  setSubTab: (tab: RoofSubTab) => void;
  calcMode: RoofCalcMode;
  setCalcMode: (mode: RoofCalcMode) => void;
  selectedModule: SolarModule | undefined;
  selectedId: string | undefined;
  setSelectedId: (id: string) => void;
  allModules: SolarModule[];
  quantityText: string;
  setQuantityText: (v: string) => void;
  roofWidthText: string;
  setRoofWidthText: (v: string) => void;
  roofLengthText: string;
  setRoofLengthText: (v: string) => void;
  roofAreaText: string;
  setRoofAreaText: (v: string) => void;
  areaManual: boolean;
  setAreaManual: (v: boolean) => void;
  marginText: string;
  setMarginText: (v: string) => void;
  edgeMarginText: string;
  setEdgeMarginText: (v: string) => void;
  endClampText: string;
  setEndClampText: (v: string) => void;
  panelGapText: string;
  setPanelGapText: (v: string) => void;
  corridorEnabled: boolean;
  setCorridorEnabled: (v: boolean) => void;
  corridorWidthText: string;
  setCorridorWidthText: (v: string) => void;
  corridorEveryText: string;
  setCorridorEveryText: (v: string) => void;
  obstacleClearanceText: string;
  setObstacleClearanceText: (v: string) => void;
  shapeMode: RoofShapeMode;
  setShapeMode: (m: RoofShapeMode) => void;
  draftVertices: Point2D[];
  polygonClosed: boolean;
  polygonMeters: Point2D[] | null;
  edgeLengthTexts: string[];
  setEdgeLengthAt: (index: number, text: string) => void;
  calibrateEdgeIndex: number;
  setCalibrateEdgeIndex: (i: number) => void;
  addDraftVertex: (p: Point2D) => void;
  undoDraftVertex: () => void;
  clearDraftPolygon: () => void;
  closePolygon: () => void;
  obstacles: RoofObstacle[];
  selectedObstacleId: string | null;
  setSelectedObstacleId: (id: string | null) => void;
  selectedObstacle: RoofObstacle | null;
  addObstacle: (input: {
    kind: ObstacleKind;
    shape: ObstacleShape;
    widthM: number;
    heightM: number;
    radiusM?: number;
    x?: number;
    y?: number;
  }) => void;
  updateObstacle: (id: string, patch: Partial<RoofObstacle>) => void;
  moveObstacle: (id: string, x: number, y: number) => void;
  rotateObstacle: (id: string, deltaDeg: number) => void;
  removeObstacle: (id: string) => void;
  clearObstacles: () => void;
  roofBounds: { width: number; height: number };
  hasRoofGeometry: boolean;
  hasRoofDimensions: boolean;
  roofWidth: number;
  roofLength: number;
  totalRoofAreaM2: number;
  usefulAreaM2: number;
  /** Folga de perímetro já validada, a mesma usada no Layout 2D. */
  appliedEdgeMarginM: number;
  /** End clamp já limitado a 3–5 cm, o mesmo usado no Layout 2D. */
  appliedEndClampM: number;
  /** Corredor de manutenção já normalizado, o mesmo usado no Layout 2D. */
  maintenanceCorridor: MaintenanceCorridorConfig;
  layoutOptions: RoofLayoutOption[];
  selectedLayoutId: string | null;
  setSelectedLayoutId: (id: string) => void;
  activeLayout: RoofLayoutOption | null;
  bestLayout: RoofLayoutOption | null;
  onChangeWidth: (text: string) => void;
  onChangeLength: (text: string) => void;
  onChangeArea: (text: string) => void;
  refreshModules: () => Promise<void>;
};

const RoofWorkspaceContext = createContext<RoofWorkspaceValue | undefined>(undefined);

let obstacleSeq = 1;

function asObstacles(value: unknown): RoofObstacle[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is RoofObstacle => {
    if (!item || typeof item !== 'object') return false;
    const obstacle = item as Partial<RoofObstacle>;
    return (
      typeof obstacle.id === 'string' &&
      typeof obstacle.x === 'number' &&
      typeof obstacle.y === 'number' &&
      typeof obstacle.widthM === 'number' &&
      typeof obstacle.heightM === 'number'
    );
  });
}

export function RoofWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { allModules, refresh, loading: modulesLoading } = useModules();
  const [subTab, setSubTab] = useState<RoofSubTab>('calc');
  const [calcMode, setCalcMode] = useState<RoofCalcMode>('inverse');
  const [selectedId, setSelectedId] = useState<string | undefined>(allModules[0]?.id);
  const [quantityText, setQuantityText] = useState('12');
  const [roofWidthText, setRoofWidthText] = useState('');
  const [roofLengthText, setRoofLengthText] = useState('');
  const [roofAreaText, setRoofAreaText] = useState('40');
  const [areaManual, setAreaManual] = useState(false);
  const [marginText, setMarginText] = useState(String(DEFAULT_AREA_MARGIN * 100));
  const [edgeMarginText, setEdgeMarginText] = useState(String(DEFAULT_EDGE_MARGIN_M));
  const [endClampText, setEndClampText] = useState(String(DEFAULT_END_CLAMP_M));
  const [panelGapText, setPanelGapText] = useState(String(DEFAULT_PANEL_GAP_M));
  const [corridorEnabled, setCorridorEnabled] = useState(false);
  const [corridorWidthText, setCorridorWidthText] = useState('0,60');
  const [corridorEveryText, setCorridorEveryText] = useState(String(DEFAULT_CORRIDOR_EVERY_ROWS));
  const [obstacleClearanceText, setObstacleClearanceText] = useState(
    String(DEFAULT_OBSTACLE_CLEARANCE_M),
  );
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);

  const [shapeMode, setShapeMode] = useState<RoofShapeMode>('rectangle');
  const [draftVertices, setDraftVertices] = useState<Point2D[]>([]);
  const [polygonClosed, setPolygonClosed] = useState(false);
  const [edgeLengthTexts, setEdgeLengthTexts] = useState<string[]>([]);
  const [calibrateEdgeIndex, setCalibrateEdgeIndex] = useState(0);
  const [obstacles, setObstacles] = useState<RoofObstacle[]>([]);
  const [selectedObstacleId, setSelectedObstacleId] = useState<string | null>(null);
  const [backupReady, setBackupReady] = useState(false);

  const applyRoofDraft = useCallback((roof: RoofWorkspaceDraft) => {
    if (roof.selectedId) setSelectedId(roof.selectedId);
    setQuantityText(roof.quantityText ?? '12');
    setRoofWidthText(roof.roofWidthText ?? '');
    setRoofLengthText(roof.roofLengthText ?? '');
    setRoofAreaText(roof.roofAreaText ?? '40');
    setAreaManual(Boolean(roof.areaManual));
    setMarginText(roof.marginText ?? String(DEFAULT_AREA_MARGIN * 100));
    setEdgeMarginText(roof.edgeMarginText ?? String(DEFAULT_EDGE_MARGIN_M));
    setEndClampText(roof.endClampText ?? String(DEFAULT_END_CLAMP_M));
    setPanelGapText(roof.panelGapText ?? String(DEFAULT_PANEL_GAP_M));
    setCorridorEnabled(Boolean(roof.corridorEnabled));
    setCorridorWidthText(roof.corridorWidthText ?? '0,60');
    setCorridorEveryText(roof.corridorEveryText ?? String(DEFAULT_CORRIDOR_EVERY_ROWS));
    setObstacleClearanceText(roof.obstacleClearanceText ?? String(DEFAULT_OBSTACLE_CLEARANCE_M));
    setShapeMode(roof.shapeMode === 'polygon' ? 'polygon' : 'rectangle');
    setDraftVertices(Array.isArray(roof.draftVertices) ? roof.draftVertices : []);
    setPolygonClosed(Boolean(roof.polygonClosed));
    setEdgeLengthTexts(Array.isArray(roof.edgeLengthTexts) ? roof.edgeLengthTexts : []);
    setCalibrateEdgeIndex(
      Number.isFinite(roof.calibrateEdgeIndex) ? roof.calibrateEdgeIndex : 0,
    );
    setObstacles(asObstacles(roof.obstacles));
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadAppBackup().then((backup) => {
      if (cancelled) return;
      if (backup.roof) applyRoofDraft(backup.roof);
      setBackupReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [applyRoofDraft]);

  useEffect(() => {
    return subscribeAppBackup(() => {
      void loadAppBackup().then((backup) => {
        if (backup.roof) applyRoofDraft(backup.roof);
      });
    });
  }, [applyRoofDraft]);

  useEffect(() => {
    if (modulesLoading) return;
    if (!allModules.find((m) => m.id === selectedId) && allModules[0]) {
      setSelectedId(allModules[0].id);
    }
  }, [allModules, selectedId, modulesLoading]);

  useEffect(() => {
    if (!backupReady) return undefined;
    const timer = setTimeout(() => {
      const roof: RoofWorkspaceDraft = {
        selectedId,
        quantityText,
        roofWidthText,
        roofLengthText,
        roofAreaText,
        areaManual,
        marginText,
        edgeMarginText,
        endClampText,
        panelGapText,
        corridorEnabled,
        corridorWidthText,
        corridorEveryText,
        obstacleClearanceText,
        shapeMode,
        draftVertices,
        polygonClosed,
        edgeLengthTexts,
        calibrateEdgeIndex,
        obstacles,
      };
      void patchAppBackup({ roof });
    }, 500);
    return () => clearTimeout(timer);
  }, [
    backupReady,
    selectedId,
    quantityText,
    roofWidthText,
    roofLengthText,
    roofAreaText,
    areaManual,
    marginText,
    edgeMarginText,
    endClampText,
    panelGapText,
    corridorEnabled,
    corridorWidthText,
    corridorEveryText,
    obstacleClearanceText,
    shapeMode,
    draftVertices,
    polygonClosed,
    edgeLengthTexts,
    calibrateEdgeIndex,
    obstacles,
  ]);

  const selectedModule = useMemo(
    () => allModules.find((m) => m.id === selectedId) ?? allModules[0],
    [allModules, selectedId],
  );

  const roofWidth = parseLocaleNumber(roofWidthText);
  const roofLength = parseLocaleNumber(roofLengthText);
  const hasRoofDimensions =
    Number.isFinite(roofWidth) &&
    roofWidth > 0 &&
    Number.isFinite(roofLength) &&
    roofLength > 0;

  const polygonMeters = useMemo(() => {
    if (shapeMode !== 'polygon' || !polygonClosed || draftVertices.length < 3) return null;
    const edgeLen = parseLocaleNumber(edgeLengthTexts[calibrateEdgeIndex] ?? '');
    const fallback =
      Number.isFinite(edgeLen) && edgeLen > 0
        ? edgeLen
        : hasRoofDimensions
          ? roofWidth
          : 5;
    let scaled = scalePolygonToEdge(draftVertices, calibrateEdgeIndex, fallback);
    // Se outras arestas tiverem comprimento, reescala pela média dos fatores
    const factors: number[] = [];
    for (let i = 0; i < scaled.length; i += 1) {
      const entered = parseLocaleNumber(edgeLengthTexts[i] ?? '');
      if (!Number.isFinite(entered) || entered <= 0) continue;
      const a = draftVertices[i];
      const b = draftVertices[(i + 1) % draftVertices.length];
      const sketchLen = Math.hypot(b.x - a.x, b.y - a.y);
      if (sketchLen > 0) factors.push(entered / sketchLen);
    }
    if (factors.length > 0) {
      const avg = factors.reduce((s, f) => s + f, 0) / factors.length;
      const cx = draftVertices.reduce((s, p) => s + p.x, 0) / draftVertices.length;
      const cy = draftVertices.reduce((s, p) => s + p.y, 0) / draftVertices.length;
      scaled = draftVertices.map((p) => ({
        x: cx + (p.x - cx) * avg,
        y: cy + (p.y - cy) * avg,
      }));
      // Reposiciona origem
      scaled = scalePolygonToEdge(scaled, calibrateEdgeIndex, fallback);
    }
    return normalizePolygonOrigin(scaled);
  }, [
    shapeMode,
    polygonClosed,
    draftVertices,
    edgeLengthTexts,
    calibrateEdgeIndex,
    hasRoofDimensions,
    roofWidth,
  ]);

  const hasRoofGeometry =
    shapeMode === 'rectangle'
      ? hasRoofDimensions
      : Boolean(polygonMeters && polygonMeters.length >= 3);

  useEffect(() => {
    if (calcMode !== 'inverse' || areaManual) return;
    if (shapeMode === 'rectangle' && hasRoofDimensions) {
      const autoArea = Math.round(roofWidth * roofLength * 100) / 100;
      setRoofAreaText(String(autoArea).replace('.', ','));
      return;
    }
    if (shapeMode === 'polygon' && polygonMeters) {
      const area = Math.round(polygonArea(polygonMeters) * 100) / 100;
      setRoofAreaText(String(area).replace('.', ','));
    }
  }, [
    calcMode,
    areaManual,
    shapeMode,
    hasRoofDimensions,
    roofWidth,
    roofLength,
    polygonMeters,
  ]);

  const appliedEdgeMarginM = useMemo(() => {
    const edge = parseLocaleNumber(edgeMarginText);
    return Number.isFinite(edge) && edge >= 0 ? edge : DEFAULT_EDGE_MARGIN_M;
  }, [edgeMarginText]);

  const appliedEndClampM = useMemo(
    () => rigidEndClampM(parseLocaleNumber(endClampText)),
    [endClampText],
  );

  const maintenanceCorridor = useMemo(() => {
    const corridorWidth = parseLocaleNumber(corridorWidthText);
    const corridorEvery = parseLocaleNumber(corridorEveryText);
    return normalizeMaintenanceCorridor({
      enabled: corridorEnabled,
      widthM:
        Number.isFinite(corridorWidth) && corridorWidth > 0
          ? corridorWidth
          : DEFAULT_CORRIDOR_WIDTH_M,
      everyRows:
        Number.isFinite(corridorEvery) && corridorEvery >= 1
          ? Math.round(corridorEvery)
          : DEFAULT_CORRIDOR_EVERY_ROWS,
    });
  }, [corridorEnabled, corridorWidthText, corridorEveryText]);

  const liveLayouts = useMemo(() => {
    if (!selectedModule || !hasRoofGeometry) return null;
    const gap = parseLocaleNumber(panelGapText);
    const panelGapM = Number.isFinite(gap) && gap >= 0 ? gap : DEFAULT_PANEL_GAP_M;
    const shared = {
      obstacles,
      module: selectedModule,
      edgeMarginM: appliedEdgeMarginM,
      panelGapM,
      endClampM: appliedEndClampM,
      corridor: maintenanceCorridor,
    };

    if (shapeMode === 'polygon' && polygonMeters) {
      return computeRoofLayouts({
        polygon: polygonMeters,
        ...shared,
      });
    }
    return computeRoofLayouts({
      roofWidthM: roofWidth,
      roofLengthM: roofLength,
      ...shared,
    });
  }, [
    selectedModule,
    hasRoofGeometry,
    shapeMode,
    polygonMeters,
    obstacles,
    roofWidth,
    roofLength,
    panelGapText,
    appliedEdgeMarginM,
    appliedEndClampM,
    maintenanceCorridor,
  ]);

  const layoutOptions = liveLayouts?.options ?? [];
  const totalRoofAreaM2 = liveLayouts?.totalRoofAreaM2 ?? 0;
  const usefulAreaM2 = liveLayouts?.usefulAreaM2 ?? 0;

  useEffect(() => {
    if (!liveLayouts) {
      setSelectedLayoutId(null);
      return;
    }
    setSelectedLayoutId((current) => {
      if (current && liveLayouts.options.some((o) => o.id === current)) return current;
      return liveLayouts.bestOptionId;
    });
  }, [liveLayouts]);

  const activeLayout =
    layoutOptions.find((o) => o.id === selectedLayoutId) ?? layoutOptions[0] ?? null;
  const bestLayout = layoutOptions[0] ?? null;

  const onChangeWidth = useCallback((text: string) => {
    setRoofWidthText(text);
    setAreaManual(false);
  }, []);

  const onChangeLength = useCallback((text: string) => {
    setRoofLengthText(text);
    setAreaManual(false);
  }, []);

  const onChangeArea = useCallback((text: string) => {
    setRoofAreaText(text);
    setAreaManual(true);
  }, []);

  const addDraftVertex = useCallback(
    (p: Point2D) => {
      if (polygonClosed) return;
      setDraftVertices((prev) => [...prev, p]);
    },
    [polygonClosed],
  );

  const undoDraftVertex = useCallback(() => {
    setPolygonClosed(false);
    setDraftVertices((prev) => prev.slice(0, -1));
    setEdgeLengthTexts((prev) => prev.slice(0, -1));
  }, []);

  const clearDraftPolygon = useCallback(() => {
    setDraftVertices([]);
    setPolygonClosed(false);
    setEdgeLengthTexts([]);
    setCalibrateEdgeIndex(0);
  }, []);

  const closePolygon = useCallback(() => {
    setDraftVertices((prev) => {
      if (prev.length < 3) return prev;
      setPolygonClosed(true);
      setEdgeLengthTexts(Array.from({ length: prev.length }, () => ''));
      return prev;
    });
  }, []);

  const setEdgeLengthAt = useCallback((index: number, text: string) => {
    setEdgeLengthTexts((prev) => {
      const next = [...prev];
      next[index] = text;
      return next;
    });
  }, []);

  const roofBounds = useMemo(() => {
    if (shapeMode === 'polygon' && polygonMeters) {
      const box = boundingBox(polygonMeters);
      return { width: box.width, height: box.height };
    }
    if (hasRoofDimensions) return { width: roofWidth, height: roofLength };
    return { width: 8, height: 10 };
  }, [shapeMode, polygonMeters, hasRoofDimensions, roofWidth, roofLength]);

  const selectedObstacle =
    obstacles.find((o) => o.id === selectedObstacleId) ?? null;

  const addObstacle = useCallback(
    (input: {
      kind: ObstacleKind;
      shape: ObstacleShape;
      widthM: number;
      heightM: number;
      radiusM?: number;
      x?: number;
      y?: number;
    }) => {
      const clearance = parseLocaleNumber(obstacleClearanceText);
      const clearanceM =
        Number.isFinite(clearance) && clearance >= 0
          ? clearance
          : DEFAULT_OBSTACLE_CLEARANCE_M;
      const id = `obs-${obstacleSeq++}`;
      const placed = clampObstacleToRoof(
        {
          shape: input.shape,
          x: input.x ?? roofBounds.width * 0.35,
          y: input.y ?? roofBounds.height * 0.35,
          widthM: input.widthM,
          heightM: input.heightM,
          radiusM: input.radiusM ?? Math.min(input.widthM, input.heightM) / 2,
        },
        roofBounds.width,
        roofBounds.height,
      );
      setObstacles((prev) => [
        ...prev,
        {
          id,
          kind: input.kind,
          label: OBSTACLE_KIND_LABELS[input.kind] ?? 'Obstáculo',
          shape: input.shape,
          x: placed.x,
          y: placed.y,
          widthM: placed.widthM,
          heightM: placed.heightM,
          radiusM: placed.radiusM,
          clearanceM,
          rotationDeg: 0,
        },
      ]);
      setSelectedObstacleId(id);
    },
    [obstacleClearanceText, roofBounds],
  );

  const updateObstacle = useCallback(
    (id: string, patch: Partial<RoofObstacle>) => {
      setObstacles((prev) =>
        prev.map((o) => {
          if (o.id !== id) return o;
          const merged = { ...o, ...patch };
          const clamped = clampObstacleToRoof(merged, roofBounds.width, roofBounds.height);
          return {
            ...merged,
            x: clamped.x,
            y: clamped.y,
            widthM: clamped.widthM,
            heightM: clamped.heightM,
            radiusM: clamped.radiusM ?? merged.radiusM,
          };
        }),
      );
    },
    [roofBounds],
  );

  const moveObstacle = useCallback(
    (id: string, x: number, y: number) => {
      updateObstacle(id, { x, y });
    },
    [updateObstacle],
  );

  const rotateObstacle = useCallback(
    (id: string, deltaDeg: number) => {
      setObstacles((prev) =>
        prev.map((o) => {
          if (o.id !== id) return o;
          const next = ((o.rotationDeg ?? 0) + deltaDeg) % 360;
          return { ...o, rotationDeg: next < 0 ? next + 360 : next };
        }),
      );
    },
    [],
  );

  const removeObstacle = useCallback((id: string) => {
    setObstacles((prev) => prev.filter((o) => o.id !== id));
    setSelectedObstacleId((cur) => (cur === id ? null : cur));
  }, []);

  const clearObstacles = useCallback(() => {
    setObstacles([]);
    setSelectedObstacleId(null);
  }, []);

  const value = useMemo<RoofWorkspaceValue>(
    () => ({
      subTab,
      setSubTab,
      calcMode,
      setCalcMode,
      selectedModule,
      selectedId,
      setSelectedId,
      allModules,
      quantityText,
      setQuantityText,
      roofWidthText,
      setRoofWidthText,
      roofLengthText,
      setRoofLengthText,
      roofAreaText,
      setRoofAreaText,
      areaManual,
      setAreaManual,
      marginText,
      setMarginText,
      edgeMarginText,
      setEdgeMarginText,
      endClampText,
      setEndClampText,
      panelGapText,
      setPanelGapText,
      corridorEnabled,
      setCorridorEnabled,
      corridorWidthText,
      setCorridorWidthText,
      corridorEveryText,
      setCorridorEveryText,
      obstacleClearanceText,
      setObstacleClearanceText,
      shapeMode,
      setShapeMode,
      draftVertices,
      polygonClosed,
      polygonMeters,
      edgeLengthTexts,
      setEdgeLengthAt,
      calibrateEdgeIndex,
      setCalibrateEdgeIndex,
      addDraftVertex,
      undoDraftVertex,
      clearDraftPolygon,
      closePolygon,
      obstacles,
      selectedObstacleId,
      setSelectedObstacleId,
      selectedObstacle,
      addObstacle,
      updateObstacle,
      moveObstacle,
      rotateObstacle,
      removeObstacle,
      clearObstacles,
      roofBounds,
      hasRoofGeometry,
      hasRoofDimensions,
      roofWidth,
      roofLength,
      totalRoofAreaM2,
      usefulAreaM2,
      appliedEdgeMarginM,
      appliedEndClampM,
      maintenanceCorridor,
      layoutOptions,
      selectedLayoutId,
      setSelectedLayoutId,
      activeLayout,
      bestLayout,
      onChangeWidth,
      onChangeLength,
      onChangeArea,
      refreshModules: refresh,
    }),
    [
      subTab,
      calcMode,
      selectedModule,
      selectedId,
      allModules,
      quantityText,
      roofWidthText,
      roofLengthText,
      roofAreaText,
      areaManual,
      marginText,
      edgeMarginText,
      endClampText,
      panelGapText,
      corridorEnabled,
      corridorWidthText,
      corridorEveryText,
      obstacleClearanceText,
      shapeMode,
      draftVertices,
      polygonClosed,
      polygonMeters,
      edgeLengthTexts,
      setEdgeLengthAt,
      calibrateEdgeIndex,
      addDraftVertex,
      undoDraftVertex,
      clearDraftPolygon,
      closePolygon,
      obstacles,
      selectedObstacleId,
      selectedObstacle,
      addObstacle,
      updateObstacle,
      moveObstacle,
      rotateObstacle,
      removeObstacle,
      clearObstacles,
      roofBounds,
      hasRoofGeometry,
      hasRoofDimensions,
      roofWidth,
      roofLength,
      totalRoofAreaM2,
      usefulAreaM2,
      appliedEdgeMarginM,
      appliedEndClampM,
      maintenanceCorridor,
      layoutOptions,
      selectedLayoutId,
      activeLayout,
      bestLayout,
      onChangeWidth,
      onChangeLength,
      onChangeArea,
      refresh,
    ],
  );

  return (
    <RoofWorkspaceContext.Provider value={value}>{children}</RoofWorkspaceContext.Provider>
  );
}

export function useRoofWorkspace() {
  const ctx = useContext(RoofWorkspaceContext);
  if (!ctx) {
    throw new Error('useRoofWorkspace must be used within RoofWorkspaceProvider');
  }
  return ctx;
}
