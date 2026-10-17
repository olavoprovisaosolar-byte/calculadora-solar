import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AiReviewCard } from '../components/AiReviewCard';
import { HelpCard } from '../components/HelpCard';
import { InputField } from '../components/InputField';
import { ModulePicker } from '../components/ModulePicker';
import { PrimaryButton } from '../components/PrimaryButton';
import { ResultCard } from '../components/ResultCard';
import { RoofLayoutCanvas, RoofPolygonSketch } from '../components/RoofLayoutCanvas';
import { ScreenContainer } from '../components/ScreenContainer';
import { SelectedModuleDims } from '../components/SelectedModuleDims';
import { useAiConfig } from '../hooks/useAiConfig';
import {
  RoofCalcMode,
  RoofSubTab,
  useRoofWorkspace,
} from '../hooks/RoofWorkspaceContext';
import { useTheme } from '../theme/ThemeContext';
import { ObstacleKind } from '../types';
import { formatNumber, parseLocaleNumber } from '../utils/calculations';
import { OBSTACLE_KIND_LABELS } from '../utils/roofGeometry';
import { formatOptimizedArrangement, minimumRoofForQuantity } from '../utils/roofLayout';

function SubTabBar() {
  const { colors } = useTheme();
  const { subTab, setSubTab, hasRoofGeometry, bestLayout } = useRoofWorkspace();

  const tabs: Array<{ key: RoofSubTab; label: string; badge?: string }> = [
    { key: 'calc', label: 'Cálculo' },
    {
      key: 'layout',
      label: 'Layout 2D',
      badge:
        hasRoofGeometry && bestLayout && bestLayout.panelCount > 0
          ? String(bestLayout.panelCount)
          : undefined,
    },
  ];

  return (
    <View style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {tabs.map((item) => {
        const active = subTab === item.key;
        return (
          <Pressable
            key={item.key}
            onPress={() => setSubTab(item.key)}
            style={[
              styles.segmentItem,
              { backgroundColor: active ? colors.primary : 'transparent' },
            ]}
          >
            <View style={styles.subTabInner}>
              <Text
                style={{
                  fontFamily: 'Outfit_600SemiBold',
                  fontSize: 14,
                  textAlign: 'center',
                  color: active
                    ? colors.mode === 'light'
                      ? '#fff'
                      : colors.background
                    : colors.textSecondary,
                }}
              >
                {item.label}
              </Text>
              {item.badge ? (
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: active
                        ? colors.mode === 'light'
                          ? 'rgba(255,255,255,0.25)'
                          : 'rgba(0,0,0,0.2)'
                        : colors.primarySoft,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontFamily: 'Outfit_700Bold',
                      fontSize: 11,
                      color: active
                        ? colors.mode === 'light'
                          ? '#fff'
                          : colors.background
                        : colors.primary,
                    }}
                  >
                    {item.badge}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function CalcModeBar({
  mode,
  onChange,
}: {
  mode: RoofCalcMode;
  onChange: (mode: RoofCalcMode) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {(
        [
          { key: 'inverse' as const, label: 'Telhado → Placas' },
          { key: 'direct' as const, label: 'Sistema → Telhado' },
        ] as const
      ).map((item) => {
        const selectedMode = mode === item.key;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={[
              styles.segmentItem,
              { backgroundColor: selectedMode ? colors.primary : 'transparent' },
            ]}
          >
            <Text
              style={{
                fontFamily: 'Outfit_600SemiBold',
                fontSize: 13,
                textAlign: 'center',
                color: selectedMode
                  ? colors.mode === 'light'
                    ? '#fff'
                    : colors.background
                  : colors.textSecondary,
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CalcPanel() {
  const { colors } = useTheme();
  const { review, hasApiKey } = useAiConfig();
  const ws = useRoofWorkspace();
  const layout = ws.activeLayout ?? ws.bestLayout;

  const directFit = useMemo(() => {
    if (ws.calcMode !== 'direct' || !ws.selectedModule) return null;
    const qty = Math.floor(parseLocaleNumber(ws.quantityText));
    if (!Number.isFinite(qty) || qty <= 0) return null;
    return minimumRoofForQuantity({
      module: ws.selectedModule,
      quantity: qty,
      edgeMarginM: ws.appliedEdgeMarginM,
      endClampM: ws.appliedEndClampM,
      corridor: ws.maintenanceCorridor,
    });
  }, [
    ws.calcMode,
    ws.selectedModule,
    ws.quantityText,
    ws.appliedEdgeMarginM,
    ws.appliedEndClampM,
    ws.maintenanceCorridor,
  ]);

  return (
    <>
      <CalcModeBar
        mode={ws.calcMode}
        onChange={ws.setCalcMode}
      />

      <ModulePicker
        modules={ws.allModules}
        selectedId={ws.selectedModule?.id}
        onSelect={(module) => ws.setSelectedId(module.id)}
        showDimensions
      />
      <SelectedModuleDims module={ws.selectedModule} />

      {ws.calcMode === 'direct' ? (
        <InputField
          label="Quantidade de placas"
          value={ws.quantityText}
          onChangeText={ws.setQuantityText}
          keyboardType="number-pad"
          placeholder="Ex: 12"
        />
      ) : (
        <>
          <Text style={[styles.section, { color: colors.text }]}>Dimensões do telhado</Text>
          <View style={styles.dimRow}>
            <View style={styles.dimCol}>
              <InputField
                label="Largura do Espaço (m)"
                value={ws.roofWidthText}
                onChangeText={ws.onChangeWidth}
                keyboardType="decimal-pad"
                placeholder="Ex: 8"
              />
            </View>
            <View style={styles.dimCol}>
              <InputField
                label="Comprimento do Espaço (m)"
                value={ws.roofLengthText}
                onChangeText={ws.onChangeLength}
                keyboardType="decimal-pad"
                placeholder="Ex: 12"
              />
            </View>
          </View>

          <InputField
            label="Área Disponível (m²)"
            value={ws.roofAreaText}
            onChangeText={ws.onChangeArea}
            keyboardType="decimal-pad"
            placeholder="Ex: 96"
            hint={
              ws.hasRoofDimensions && !ws.areaManual
                ? `Calculada automaticamente: ${formatNumber(ws.roofWidth)} × ${formatNumber(ws.roofLength)} = ${formatNumber(ws.roofWidth * ws.roofLength)} m²`
                : 'Pode digitar a área manualmente, sem preencher largura/comprimento.'
            }
          />

          <InputField
            label="Folga do Perímetro (Borda do Telhado)"
            value={ws.edgeMarginText}
            onChangeText={ws.setEdgeMarginText}
            keyboardType="decimal-pad"
            placeholder="0,5"
            hint="Distância fixa obrigatória das bordas no Layout 2D (ex.: 0,5 m do beiral e da cumeeira)."
          />

          {layout ? (
            <Pressable
              onPress={() => ws.setSubTab('layout')}
              style={[
                styles.layoutHint,
                { backgroundColor: colors.primarySoft, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.layoutHintTitle, { color: colors.text }]}>
                {formatOptimizedArrangement(layout)}
              </Text>
              <Text style={[styles.layoutHintCta, { color: colors.primary }]}>
                Abrir Editor de Layout 2D →
              </Text>
            </Pressable>
          ) : null}
        </>
      )}

      <HelpCard
        title="Mesmo arranjo do Layout 2D"
        body={
          ws.calcMode === 'direct'
            ? 'O telhado mínimo usa a folga do perímetro, o mid clamp de 2 cm, o end clamp de 3 a 5 cm e o corredor, se estiver ligado. A quantidade que cabe é a mesma que o Layout 2D desenha nesse retângulo.'
            : 'A quantidade de placas, a área útil e o kWp saem do Layout 2D. A folga do perímetro, os obstáculos e o corredor entram no mesmo cálculo.'
        }
      />

      {ws.calcMode === 'direct' && directFit && ws.selectedModule ? (
        <>
          <ResultCard
            title="Do sistema para o telhado"
            rows={[
              {
                label: 'Módulo',
                value: `${ws.selectedModule.powerWp} Wp · ${formatNumber(ws.selectedModule.lengthM)} × ${formatNumber(ws.selectedModule.widthM)} m`,
              },
              { label: 'Quantidade solicitada', value: String(Math.floor(parseLocaleNumber(ws.quantityText))) },
              {
                label: 'Telhado mínimo (L × C)',
                value: `${formatNumber(directFit.roofWidthM)} × ${formatNumber(directFit.roofLengthM)} m`,
              },
              {
                label: 'Área Total do Telhado (m²)',
                value: formatNumber(directFit.totalRoofAreaM2),
              },
              {
                label: 'Área Útil de Instalação (m²)',
                value: formatNumber(directFit.usefulAreaM2),
              },
              {
                label: 'Total de Placas Suportadas',
                value: String(directFit.panelCount),
                emphasize: true,
              },
              {
                label: 'Potência Total Instalada (kWp)',
                value: formatNumber(directFit.totalPowerKwp),
                emphasize: true,
              },
              {
                label: 'Orientação',
                value: directFit.orientationSummary,
              },
            ]}
          />
          <AiReviewCard
            payload={{
              kind: 'roof_direct',
              result: {
                quantity: directFit.panelCount,
                module: ws.selectedModule,
                grossAreaM2: directFit.totalRoofAreaM2,
                safetyMargin: 0,
                recommendedAreaM2: directFit.usefulAreaM2,
                totalPowerKwp: directFit.totalPowerKwp,
              },
            }}
            onReview={review}
            disabledReason={
              hasApiKey ? undefined : 'Configure a API Key na aba Config. IA para habilitar a revisão.'
            }
          />
        </>
      ) : null}

      {ws.calcMode === 'inverse' && layout ? (
        <>
          <ResultCard
            title="Telhado para placas"
            rows={[
              {
                label: 'Área Total do Telhado (m²)',
                value: formatNumber(ws.totalRoofAreaM2),
              },
              {
                label: 'Área Útil de Instalação (m²)',
                value: formatNumber(layout.usefulAreaM2 ?? ws.usefulAreaM2),
              },
              {
                label: 'Total de Placas Suportadas',
                value: String(layout.panelCount),
                emphasize: true,
              },
              {
                label: 'Potência Total Instalada (kWp)',
                value: formatNumber(layout.totalPowerKwp),
                emphasize: true,
              },
              {
                label: 'Geração mensal estimada',
                value: `${formatNumber(layout.estimatedMonthlyGenerationKwh)} kWh/mês`,
              },
              {
                label: 'Orientação',
                value: layout.orientationSummary,
              },
            ]}
          />
          <AiReviewCard
            payload={{
              kind: 'roof_inverse',
              result: {
                roofAreaM2: ws.totalRoofAreaM2,
                module: ws.selectedModule!,
                discountMargin: 0,
                usefulAreaM2: layout.usefulAreaM2 ?? ws.usefulAreaM2,
                maxModules: layout.panelCount,
                maxPowerKwp: layout.totalPowerKwp,
                estimatedMonthlyGenerationKwh: layout.estimatedMonthlyGenerationKwh,
              },
            }}
            onReview={review}
            disabledReason={
              hasApiKey ? undefined : 'Configure a API Key na aba Config. IA para habilitar a revisão.'
            }
          />
        </>
      ) : null}
    </>
  );
}

function LayoutPanel() {
  const { colors } = useTheme();
  const ws = useRoofWorkspace();
  const [obsKind, setObsKind] = useState<ObstacleKind>('chimney');
  const [obsShape, setObsShape] = useState<'rect' | 'circle'>('rect');
  const [obsW, setObsW] = useState('1,0');
  const [obsH, setObsH] = useState('1,0');

  const onAddObstacle = () => {
    const widthM = parseLocaleNumber(obsW);
    const heightM = parseLocaleNumber(obsH);
    if (!Number.isFinite(widthM) || widthM <= 0 || !Number.isFinite(heightM) || heightM <= 0) {
      return;
    }
    ws.addObstacle({
      kind: obsKind,
      shape: obsShape,
      widthM,
      heightM,
      radiusM: Math.min(widthM, heightM) / 2,
    });
  };

  return (
    <>
      <Text style={[styles.section, { color: colors.text }]}>Editor de Layout 2D</Text>
      <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
        Telhado retangular ou irregular, obstáculos (zonas de exclusão) e arranjo Vertical /
        Horizontal / Misto com grampos intermediários (2 cm) e finais.
      </Text>

      <ModulePicker
        modules={ws.allModules}
        selectedId={ws.selectedModule?.id}
        onSelect={(module) => ws.setSelectedId(module.id)}
        showDimensions
      />
      <SelectedModuleDims module={ws.selectedModule} />

      <Text style={[styles.section, { color: colors.text }]}>Forma do telhado</Text>
      <View style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {(
          [
            { key: 'rectangle' as const, label: 'Retangular' },
            { key: 'polygon' as const, label: 'Irregular' },
          ] as const
        ).map((item) => {
          const active = ws.shapeMode === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => ws.setShapeMode(item.key)}
              style={[
                styles.segmentItem,
                { backgroundColor: active ? colors.primary : 'transparent' },
              ]}
            >
              <Text
                style={{
                  fontFamily: 'Outfit_600SemiBold',
                  fontSize: 13,
                  color: active
                    ? colors.mode === 'light'
                      ? '#fff'
                      : colors.background
                    : colors.textSecondary,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {ws.shapeMode === 'rectangle' ? (
        <View style={styles.dimRow}>
          <View style={styles.dimCol}>
            <InputField
              label="Largura do Espaço (m)"
              value={ws.roofWidthText}
              onChangeText={ws.onChangeWidth}
              keyboardType="decimal-pad"
              placeholder="Ex: 8"
            />
          </View>
          <View style={styles.dimCol}>
            <InputField
              label="Comprimento do Espaço (m)"
              value={ws.roofLengthText}
              onChangeText={ws.onChangeLength}
              keyboardType="decimal-pad"
              placeholder="Ex: 12"
            />
          </View>
        </View>
      ) : (
        <>
          <RoofPolygonSketch
            draftVertices={ws.draftVertices}
            closed={ws.polygonClosed}
            onAddVertex={ws.addDraftVertex}
            onUndo={ws.undoDraftVertex}
            onClear={ws.clearDraftPolygon}
            onClosePolygon={ws.closePolygon}
          />
          {ws.polygonClosed && ws.draftVertices.length >= 3 ? (
            <>
              <Text style={[styles.section, { color: colors.text }]}>
                Comprimento real dos lados (m)
              </Text>
              <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
                Informe ao menos um lado para calibrar a escala. Os demais ajustam a proporção.
              </Text>
              {ws.draftVertices.map((_, i) => (
                <Pressable
                  key={`edge-${i}`}
                  onPress={() => ws.setCalibrateEdgeIndex(i)}
                >
                  <InputField
                    label={`Lado ${i + 1} → ${((i + 1) % ws.draftVertices.length) + 1}${
                      ws.calibrateEdgeIndex === i ? ' ★ calibração' : ''
                    }`}
                    value={ws.edgeLengthTexts[i] ?? ''}
                    onChangeText={(t) => ws.setEdgeLengthAt(i, t)}
                    keyboardType="decimal-pad"
                    placeholder="Ex: 6,5"
                  />
                </Pressable>
              ))}
            </>
          ) : null}
        </>
      )}

      <Text style={[styles.section, { color: colors.text }]}>Espaçamentos mecânicos</Text>
      <InputField
        label="Folga do Perímetro (Borda do Telhado)"
        value={ws.edgeMarginText}
        onChangeText={ws.setEdgeMarginText}
        keyboardType="decimal-pad"
        placeholder="0,5"
        hint="Distância fixa obrigatória das bordas (ex.: 0,5 m do beiral e da cumeeira)."
      />
      <View
        style={[
          styles.fixedRule,
          { backgroundColor: colors.primarySoft, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.fixedRuleTitle, { color: colors.text }]}>
          Grampos intermediários (mid clamps)
        </Text>
        <Text style={[styles.sectionHint, { color: colors.textSecondary, marginBottom: 0 }]}>
          2 cm obrigatórios entre placas vizinhas.
        </Text>
      </View>
      <InputField
        label="Grampos finais — end clamp (m)"
        value={ws.endClampText}
        onChangeText={ws.setEndClampText}
        keyboardType="decimal-pad"
        placeholder="0,03"
        hint="3 a 5 cm no fim de cada fileira."
        error={(() => {
          const end = parseLocaleNumber(ws.endClampText);
          if (!Number.isFinite(end)) return undefined;
          if (end < 0.03 || end > 0.05) {
            return 'O cálculo usa entre 3 cm e 5 cm.';
          }
          return undefined;
        })()}
      />

      <Text style={[styles.section, { color: colors.text }]}>Corredor de manutenção</Text>
      <Pressable
        testID="corridor-toggle"
        onPress={() => ws.setCorridorEnabled(!ws.corridorEnabled)}
        style={[
          styles.obsRow,
          {
            backgroundColor: ws.corridorEnabled ? colors.primarySoft : colors.surface,
            borderColor: ws.corridorEnabled ? colors.primary : colors.border,
            marginBottom: 12,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontFamily: 'Outfit_600SemiBold', fontSize: 14 }}>
            Incluir Corredor de Manutenção
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: 'DMSans_400Regular',
              fontSize: 12,
              marginTop: 2,
            }}
          >
            {ws.corridorEnabled
              ? 'Ativado — faixas livres entre grupos de fileiras'
              : 'Desativado (padrão)'}
          </Text>
        </View>
        <Text style={{ color: colors.primary, fontFamily: 'Outfit_700Bold', fontSize: 14 }}>
          {ws.corridorEnabled ? 'SIM' : 'NÃO'}
        </Text>
      </Pressable>
      {ws.corridorEnabled ? (
        <View style={styles.dimRow}>
          <View style={styles.dimCol}>
            <InputField
              label="Largura do Corredor (m)"
              value={ws.corridorWidthText}
              onChangeText={ws.setCorridorWidthText}
              keyboardType="decimal-pad"
              placeholder="0,60"
              hint="Padrão 0,60 m."
            />
          </View>
          <View style={styles.dimCol}>
            <InputField
              label="Frequência de Fileiras"
              value={ws.corridorEveryText}
              onChangeText={ws.setCorridorEveryText}
              keyboardType="number-pad"
              placeholder="2"
              hint="A cada N fileiras."
            />
          </View>
        </View>
      ) : null}

      <Text style={[styles.section, { color: colors.text }]}>Obstáculos / exclusão</Text>
      <InputField
        label="Afastamento de segurança (m)"
        value={ws.obstacleClearanceText}
        onChangeText={ws.setObstacleClearanceText}
        keyboardType="decimal-pad"
        placeholder="0,4"
        hint="Raio de afastamento ao redor de cada obstáculo (0,3–0,5 m)."
      />
      <View style={styles.obsKinds}>
        {(Object.keys(OBSTACLE_KIND_LABELS) as ObstacleKind[]).map((kind) => {
          const active = obsKind === kind;
          return (
            <Pressable
              key={kind}
              onPress={() => setObsKind(kind)}
              style={[
                styles.obsChip,
                {
                  backgroundColor: active ? colors.primarySoft : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={{ color: colors.text, fontFamily: 'DMSans_500Medium', fontSize: 12 }}>
                {OBSTACLE_KIND_LABELS[kind]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {(
          [
            { key: 'rect' as const, label: 'Retângulo' },
            { key: 'circle' as const, label: 'Círculo' },
          ] as const
        ).map((item) => {
          const active = obsShape === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setObsShape(item.key)}
              style={[
                styles.segmentItem,
                { backgroundColor: active ? colors.primary : 'transparent' },
              ]}
            >
              <Text
                style={{
                  fontFamily: 'Outfit_600SemiBold',
                  fontSize: 13,
                  color: active
                    ? colors.mode === 'light'
                      ? '#fff'
                      : colors.background
                    : colors.textSecondary,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.dimRow}>
        <View style={styles.dimCol}>
          <InputField
            label={obsShape === 'circle' ? 'Diâmetro X (m)' : 'Largura (m)'}
            value={obsW}
            onChangeText={setObsW}
            keyboardType="decimal-pad"
            placeholder="1,0"
          />
        </View>
        <View style={styles.dimCol}>
          <InputField
            label={obsShape === 'circle' ? 'Diâmetro Y (m)' : 'Comprimento (m)'}
            value={obsH}
            onChangeText={setObsH}
            keyboardType="decimal-pad"
            placeholder="1,0"
          />
        </View>
      </View>
      <PrimaryButton label="Adicionar obstáculo" onPress={onAddObstacle} style={styles.cta} />
      {ws.obstacles.length > 0 ? (
        <View style={{ marginBottom: 12, gap: 8 }}>
          {ws.obstacles.map((o) => {
            const active = o.id === ws.selectedObstacleId;
            return (
              <Pressable
                key={o.id}
                onPress={() => ws.setSelectedObstacleId(o.id)}
                style={[
                  styles.obsRow,
                  {
                    backgroundColor: active ? colors.primarySoft : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    flex: 1,
                    color: colors.text,
                    fontFamily: 'DMSans_400Regular',
                    fontSize: 13,
                  }}
                >
                  {o.label} · {o.shape === 'circle' ? '⌀' : ''}
                  {formatNumber(o.widthM)}×{formatNumber(o.heightM)} m · X{' '}
                  {formatNumber(o.x)} Y {formatNumber(o.y)}
                  {(o.rotationDeg ?? 0) !== 0 ? ` · ${formatNumber(o.rotationDeg ?? 0, 0)}°` : ''}
                </Text>
                <Pressable onPress={() => ws.removeObstacle(o.id)}>
                  <Text
                    style={{ color: colors.primary, fontFamily: 'Outfit_600SemiBold', fontSize: 13 }}
                  >
                    Remover
                  </Text>
                </Pressable>
              </Pressable>
            );
          })}
          <Pressable onPress={ws.clearObstacles}>
            <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_500Medium', fontSize: 13 }}>
              Limpar todos os obstáculos
            </Text>
          </Pressable>
        </View>
      ) : null}

      {ws.selectedObstacle ? (
        <View
          style={[
            styles.toolbar,
            { backgroundColor: colors.surface, borderColor: colors.primary },
          ]}
        >
          <Text style={[styles.section, { color: colors.text, marginBottom: 4 }]}>
            Obstáculo selecionado · {ws.selectedObstacle.label}
          </Text>
          <Text style={[styles.sectionHint, { color: colors.textSecondary, marginBottom: 10 }]}>
            Arraste no canvas ou ajuste finamente abaixo. O arranjo de placas atualiza em tempo real.
          </Text>
          <View style={styles.dimRow}>
            <View style={styles.dimCol}>
              <InputField
                label="Posição X (m)"
                value={String(ws.selectedObstacle.x).replace('.', ',')}
                onChangeText={(t) => {
                  const v = parseLocaleNumber(t);
                  if (Number.isFinite(v)) ws.moveObstacle(ws.selectedObstacle!.id, v, ws.selectedObstacle!.y);
                }}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            </View>
            <View style={styles.dimCol}>
              <InputField
                label="Posição Y (m)"
                value={String(ws.selectedObstacle.y).replace('.', ',')}
                onChangeText={(t) => {
                  const v = parseLocaleNumber(t);
                  if (Number.isFinite(v)) ws.moveObstacle(ws.selectedObstacle!.id, ws.selectedObstacle!.x, v);
                }}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            </View>
          </View>
          <View style={styles.dimRow}>
            <View style={styles.dimCol}>
              <InputField
                label="Largura (m)"
                value={String(ws.selectedObstacle.widthM).replace('.', ',')}
                onChangeText={(t) => {
                  const v = parseLocaleNumber(t);
                  if (Number.isFinite(v) && v > 0) {
                    ws.updateObstacle(ws.selectedObstacle!.id, {
                      widthM: v,
                      radiusM:
                        ws.selectedObstacle!.shape === 'circle'
                          ? v / 2
                          : ws.selectedObstacle!.radiusM,
                    });
                  }
                }}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.dimCol}>
              <InputField
                label="Comprimento (m)"
                value={String(ws.selectedObstacle.heightM).replace('.', ',')}
                onChangeText={(t) => {
                  const v = parseLocaleNumber(t);
                  if (Number.isFinite(v) && v > 0) {
                    ws.updateObstacle(ws.selectedObstacle!.id, { heightM: v });
                  }
                }}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          <View style={styles.rotateRow}>
            <Pressable
              onPress={() => ws.rotateObstacle(ws.selectedObstacle!.id, -15)}
              style={[styles.rotateBtn, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.text, fontFamily: 'Outfit_600SemiBold' }}>↺ −15°</Text>
            </Pressable>
            <Text style={{ color: colors.textSecondary, fontFamily: 'DMSans_500Medium', fontSize: 13 }}>
              Rotação {formatNumber(ws.selectedObstacle.rotationDeg ?? 0, 0)}°
            </Text>
            <Pressable
              onPress={() => ws.rotateObstacle(ws.selectedObstacle!.id, 15)}
              style={[styles.rotateBtn, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.text, fontFamily: 'Outfit_600SemiBold' }}>↻ +15°</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {!ws.hasRoofGeometry ? (
        <HelpCard
          title="Defina o telhado"
          body="No modo Retangular, informe largura e comprimento. No modo Irregular, toque os cantos, feche o polígono e calibre pelo menos um lado em metros."
        />
      ) : null}

      {ws.layoutOptions.length > 0 || ws.hasRoofGeometry ? (
        <>
          <View
            style={[
              styles.optimizedBanner,
              { backgroundColor: colors.primarySoft, borderColor: colors.primary },
            ]}
          >
            <Text style={[styles.optimizedLabel, { color: colors.primary }]}>
              Resultado do layout (ao vivo)
            </Text>
            <Text style={[styles.optimizedTitle, { color: colors.text }]}>
              {formatOptimizedArrangement(ws.activeLayout ?? ws.bestLayout)}
            </Text>
            <Text style={[styles.optimizedMeta, { color: colors.textSecondary }]}>
              Área Total do Telhado {formatNumber(ws.totalRoofAreaM2)} m² · Área Útil de
              Instalação{' '}
              {formatNumber(
                (ws.activeLayout ?? ws.bestLayout)?.usefulAreaM2 ?? ws.usefulAreaM2,
              )}{' '}
              m² · Total de Placas Suportadas{' '}
              {(ws.activeLayout ?? ws.bestLayout)?.panelCount ?? 0} · Potência Total Instalada{' '}
              {formatNumber((ws.activeLayout ?? ws.bestLayout)?.totalPowerKwp ?? 0)} kWp
            </Text>
          </View>

          {ws.layoutOptions.length > 0 ? (
            <>
              <Text style={[styles.section, { color: colors.text }]}>Layouts sugeridos</Text>
              <View style={styles.layoutTabs}>
                {ws.layoutOptions.map((option) => {
                  const active = option.id === ws.activeLayout?.id;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => ws.setSelectedLayoutId(option.id)}
                      style={[
                        styles.layoutTab,
                        {
                          backgroundColor: active ? colors.primarySoft : colors.surface,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.layoutTabTitle, { color: colors.text }]}>
                        {option.label}
                      </Text>
                      <Text style={[styles.layoutTabMeta, { color: colors.textSecondary }]}>
                        {option.panelCount} placas · {option.orientationSummary}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <RoofLayoutCanvas
            option={ws.activeLayout}
            polygon={ws.polygonMeters ?? undefined}
            obstacles={ws.obstacles}
            selectedObstacleId={ws.selectedObstacleId}
            onSelectObstacle={ws.setSelectedObstacleId}
            onMoveObstacle={ws.moveObstacle}
            onResizeObstacle={(id, w, h) =>
              ws.updateObstacle(id, {
                widthM: w,
                heightM: h,
                radiusM: w / 2,
              })
            }
            interactive
          />

          {ws.activeLayout ? (
            <ResultCard
              title="Resumo do arranjo"
              rows={[
                {
                  label: 'Área Total do Telhado (m²)',
                  value: formatNumber(ws.totalRoofAreaM2),
                },
                {
                  label: 'Área Útil de Instalação (m²)',
                  value: formatNumber(ws.activeLayout.usefulAreaM2 ?? ws.usefulAreaM2),
                },
                {
                  label: 'Total de Placas Suportadas',
                  value: String(ws.activeLayout.panelCount),
                  emphasize: true,
                },
                {
                  label: 'Potência Total Instalada (kWp)',
                  value: formatNumber(ws.activeLayout.totalPowerKwp),
                  emphasize: true,
                },
                {
                  label: 'Orientação sugerida',
                  value: ws.activeLayout.orientationSummary,
                },
                {
                  label: 'Placa (C × L)',
                  value: ws.selectedModule
                    ? `${formatNumber(ws.selectedModule.lengthM)} × ${formatNumber(ws.selectedModule.widthM)} m`
                    : '—',
                },
                {
                  label: 'Geração mensal estimada',
                  value: `${formatNumber(ws.activeLayout.estimatedMonthlyGenerationKwh)} kWh/mês`,
                },
                {
                  label: 'Obstáculos',
                  value: String(ws.obstacles.length),
                },
              ]}
            />
          ) : null}
        </>
      ) : null}

      <HelpCard
        title="Como o Layout 2D otimiza?"
        body="A folga do perímetro é fixa. Mid clamps de 2 cm separam placas vizinhas e os end clamps reservam 3 a 5 cm no fim de cada fileira. Com o corredor ligado, uma faixa livre entra a cada N fileiras. Arraste um obstáculo ou mude o corredor: a malha, a contagem e o kWp recalculam na hora."
      />
    </>
  );
}

function AreaTelhadoBody() {
  const { subTab, refreshModules } = useRoofWorkspace();

  useFocusEffect(
    useCallback(() => {
      refreshModules();
    }, [refreshModules]),
  );

  return (
    <ScreenContainer
      title="Área de Telhado"
      subtitle={
        subTab === 'calc'
          ? 'Cálculo elétrico e por área — o desenho das placas fica em Layout 2D.'
          : 'Editor de Layout 2D: polígono, obstáculos e arranjo otimizado.'
      }
    >
      <SubTabBar />
      {subTab === 'calc' ? <CalcPanel /> : <LayoutPanel />}
    </ScreenContainer>
  );
}

export function AreaTelhadoScreen() {
  return <AreaTelhadoBody />;
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    minHeight: 46,
    paddingHorizontal: 6,
  },
  subTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignItems: 'center',
  },
  section: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 17,
    marginBottom: 8,
  },
  sectionHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  fixedRule: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  fixedRuleTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    marginBottom: 4,
  },
  dimRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dimCol: { flex: 1 },
  cta: { marginBottom: 16 },
  layoutHint: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  layoutHintTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
  },
  layoutHintCta: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    marginTop: 6,
  },
  optimizedBanner: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  optimizedLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  optimizedTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    lineHeight: 22,
  },
  optimizedMeta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    marginTop: 6,
  },
  layoutTabs: { gap: 10, marginBottom: 12 },
  layoutTab: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  layoutTabTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
  },
  layoutTabMeta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    marginTop: 4,
  },
  obsKinds: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  obsChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  obsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  toolbar: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  rotateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  rotateBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
