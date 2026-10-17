import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AiReviewCard } from '../components/AiReviewCard';
import { HelpCard } from '../components/HelpCard';
import { InputField } from '../components/InputField';
import { ModulePicker } from '../components/ModulePicker';
import { PrimaryButton } from '../components/PrimaryButton';
import { ResultCard } from '../components/ResultCard';
import { ScreenContainer } from '../components/ScreenContainer';
import { SizingHighlights } from '../components/SizingHighlights';
import { FACTOR_333_EXPLANATION } from '../constants/modules';
import { useAiConfig } from '../hooks/useAiConfig';
import { useModules } from '../hooks/useModules';
import { useRoofWorkspace } from '../hooks/RoofWorkspaceContext';
import { loadAppBackup, patchAppBackup, subscribeAppBackup } from '../services/appBackup';
import { useTheme } from '../theme/ThemeContext';
import { SolarModule } from '../types';
import {
  calculateFromDaily,
  calculateFromMonthly,
  calculateModulesForPower,
  formatNumber,
  parseLocaleNumber,
} from '../utils/calculations';

type Mode = 'monthly' | 'daily';

export function DimensionamentoScreen() {
  const { colors } = useTheme();
  const { review, hasApiKey } = useAiConfig();
  const { allModules, refresh } = useModules();
  const ws = useRoofWorkspace();
  const [mode, setMode] = useState<Mode>('monthly');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [monthlyResult, setMonthlyResult] = useState<ReturnType<typeof calculateFromMonthly> | null>(
    null,
  );
  const [dailyResult, setDailyResult] = useState<ReturnType<typeof calculateFromDaily> | null>(null);
  const [backupReady, setBackupReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadAppBackup().then((backup) => {
      if (cancelled) return;
      if (backup.calculation?.mode === 'monthly' || backup.calculation?.mode === 'daily') {
        setMode(backup.calculation.mode);
        setInput(backup.calculation.input ?? '');
      }
      setBackupReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!backupReady) return undefined;
    const timer = setTimeout(() => {
      void patchAppBackup({ calculation: { mode, input } });
    }, 500);
    return () => clearTimeout(timer);
  }, [backupReady, mode, input]);

  useEffect(() => {
    return subscribeAppBackup(() => {
      void loadAppBackup().then((backup) => {
        if (backup.calculation?.mode === 'monthly' || backup.calculation?.mode === 'daily') {
          setMode(backup.calculation.mode);
          setInput(backup.calculation.input ?? '');
        }
      });
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const onCalculate = () => {
    Keyboard.dismiss();
    const value = parseLocaleNumber(input);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Informe um valor numérico maior que zero.');
      return;
    }
    setError(undefined);
    if (mode === 'monthly') {
      setMonthlyResult(calculateFromMonthly(value));
      setDailyResult(null);
    } else {
      setDailyResult(calculateFromDaily(value));
      setMonthlyResult(null);
    }
    if (!ws.selectedId && allModules[0]) {
      ws.setSelectedId(allModules[0].id);
    }
  };

  const activeResult = mode === 'monthly' ? monthlyResult : dailyResult;
  const requiredPowerKwp = activeResult?.powerKwp ?? 0;

  const selectedModule = ws.selectedModule ?? allModules[0];

  const moduleSizing = useMemo(() => {
    if (!activeResult || !selectedModule || requiredPowerKwp <= 0) return null;
    return calculateModulesForPower(requiredPowerKwp, selectedModule, {
      edgeMarginM: ws.appliedEdgeMarginM,
      endClampM: ws.appliedEndClampM,
      corridor: ws.maintenanceCorridor,
    });
  }, [
    activeResult,
    selectedModule,
    requiredPowerKwp,
    ws.appliedEdgeMarginM,
    ws.appliedEndClampM,
    ws.maintenanceCorridor,
  ]);

  const onSelectModule = (module: SolarModule) => {
    ws.setSelectedId(module.id);
  };

  const roofLayout = ws.activeLayout ?? ws.bestLayout;
  const corridorNote = ws.maintenanceCorridor.enabled
    ? `corredor de ${formatNumber(ws.maintenanceCorridor.widthM)} m a cada ${ws.maintenanceCorridor.everyRows} fileiras`
    : 'corredor desligado';

  const consumptionRows = useMemo(() => {
    if (mode === 'monthly' && monthlyResult) {
      return [
        { label: 'Consumo mensal', value: `${formatNumber(monthlyResult.monthlyKwh)} kWh/mês` },
        { label: 'Média diária', value: `${formatNumber(monthlyResult.dailyKwh)} kWh/dia` },
        {
          label: 'Potência necessária',
          value: `${formatNumber(monthlyResult.powerKwp)} kWp`,
          emphasize: true,
        },
      ];
    }
    if (mode === 'daily' && dailyResult) {
      return [
        { label: 'Consumo diário', value: `${formatNumber(dailyResult.dailyKwh)} kWh/dia` },
        {
          label: 'Consumo mensal convertido',
          value: `${formatNumber(dailyResult.monthlyKwh)} kWh/mês`,
        },
        {
          label: 'Potência necessária (÷ 3,33)',
          value: `${formatNumber(dailyResult.powerKwp)} kWp`,
          emphasize: true,
        },
      ];
    }
    return [];
  }, [mode, monthlyResult, dailyResult]);

  const highlightItems = useMemo(() => {
    if (!moduleSizing) return [];
    return [
      {
        label: '1 · Quantidade de placas',
        value: `${moduleSizing.quantity} placas`,
        hint: `${moduleSizing.module.powerWp} Wp · potência instalada ${formatNumber(moduleSizing.installedPowerKwp)} kWp`,
      },
      {
        label: '2 · Área necessária para instalar',
        value: `${formatNumber(moduleSizing.requiredInstallAreaM2)} m²`,
        hint: `Telhado mínimo ${formatNumber(moduleSizing.roofWidthM)} × ${formatNumber(moduleSizing.roofLengthM)} m · o Layout 2D comporta ${moduleSizing.layoutPanelCount} placas`,
        accent: true,
      },
      {
        label: '3 · Inversor necessário',
        value: `${formatNumber(moduleSizing.inverterMinKw)} – ${formatNumber(moduleSizing.inverterMaxKw)} kW`,
        hint: 'Faixa com FDI 1,15 a 1,30 sobre a potência instalada',
      },
    ];
  }, [moduleSizing]);

  const detailRows = useMemo(() => {
    if (!moduleSizing) return [];
    return [
      {
        label: 'Placa selecionada',
        value: `${moduleSizing.module.powerWp} Wp · ${formatNumber(moduleSizing.module.areaM2)} m²/un`,
      },
      {
        label: 'Potência instalada',
        value: `${formatNumber(moduleSizing.installedPowerKwp)} kWp`,
      },
      {
        label: 'Área bruta das placas',
        value: `${formatNumber(moduleSizing.grossAreaM2)} m²`,
      },
      {
        label: 'Telhado mínimo (L × C)',
        value: `${formatNumber(moduleSizing.roofWidthM)} × ${formatNumber(moduleSizing.roofLengthM)} m`,
      },
      {
        label: 'Área Total do Telhado (m²)',
        value: formatNumber(moduleSizing.requiredInstallAreaM2),
        emphasize: true,
      },
      {
        label: 'Área Útil de Instalação (m²)',
        value: formatNumber(moduleSizing.layoutUsefulAreaM2),
      },
      {
        label: 'Total de Placas Suportadas',
        value: String(moduleSizing.layoutPanelCount),
        emphasize: true,
      },
      {
        label: 'Potência Total Instalada (kWp)',
        value: formatNumber(moduleSizing.layoutPowerKwp),
        emphasize: true,
      },
      {
        label: 'Inversor (FDI 1,15–1,30)',
        value: `${formatNumber(moduleSizing.inverterMinKw)} – ${formatNumber(moduleSizing.inverterMaxKw)} kW`,
        emphasize: true,
      },
    ];
  }, [moduleSizing]);

  return (
    <ScreenContainer
      title="Dimensionamento"
      subtitle="Consumo → escolha a placa → quantidade, área de instalação e inversor."
    >
      <View style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {(
          [
            { key: 'monthly', label: 'Mensal' },
            { key: 'daily', label: 'Diário' },
          ] as const
        ).map((item) => {
          const selected = mode === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => {
                setMode(item.key);
                setError(undefined);
              }}
              style={[
                styles.segmentItem,
                {
                  backgroundColor: selected ? colors.primary : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  fontFamily: 'Outfit_600SemiBold',
                  color: selected
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

      <InputField
        label={mode === 'monthly' ? 'Consumo mensal (kWh/mês)' : 'Consumo diário (kWh/dia)'}
        value={input}
        onChangeText={setInput}
        keyboardType="decimal-pad"
        placeholder={mode === 'monthly' ? 'Ex: 450' : 'Ex: 15'}
        error={error}
        hint={
          mode === 'monthly'
            ? 'Potência (kWp) = Consumo Mensal ÷ 100'
            : 'Potência (kWp) = Consumo Diário ÷ 3,33'
        }
      />

      <PrimaryButton label="Calcular dimensionamento" onPress={onCalculate} style={styles.cta} />

      <HelpCard title="Por que o fator 3,33?" body={FACTOR_333_EXPLANATION} />

      {activeResult && consumptionRows.length > 0 ? (
        <>
          <ResultCard title="1. Resultado do consumo" rows={consumptionRows} />

          <Text style={[styles.section, { color: colors.text }]}>2. Escolha a placa comercial</Text>
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
            Inclui placas cadastradas na aba Módulos. Ao trocar a placa, recalcula quantidade, área
            necessária e inversor.
          </Text>

          <ModulePicker
            modules={allModules}
            selectedId={selectedModule?.id}
            onSelect={onSelectModule}
          />

          <InputField
            label="Folga do Perímetro (Borda do Telhado)"
            value={ws.edgeMarginText}
            onChangeText={ws.setEdgeMarginText}
            keyboardType="decimal-pad"
            placeholder="0,5"
            hint={`A mesma folga da aba Telhado. Mid clamp 2 cm, end clamp ${formatNumber(ws.appliedEndClampM)} m, ${corridorNote}.`}
          />

          {moduleSizing ? (
            <>
              <SizingHighlights
                title="3. Dimensionamento da placa escolhida"
                items={highlightItems}
              />
              <ResultCard title="Detalhes do arranjo" rows={detailRows} />
              {roofLayout ? (
                <ResultCard
                  title="Telhado informado na aba Telhado"
                  rows={[
                    {
                      label: 'Área Total do Telhado (m²)',
                      value: formatNumber(ws.totalRoofAreaM2),
                    },
                    {
                      label: 'Área Útil de Instalação (m²)',
                      value: formatNumber(roofLayout.usefulAreaM2 ?? ws.usefulAreaM2),
                    },
                    {
                      label: 'Total de Placas Suportadas',
                      value: String(roofLayout.panelCount),
                      emphasize: true,
                    },
                    {
                      label: 'Potência Total Instalada (kWp)',
                      value: formatNumber(roofLayout.totalPowerKwp),
                      emphasize: true,
                    },
                  ]}
                />
              ) : null}
            </>
          ) : null}

          <AiReviewCard
            payload={
              mode === 'monthly' && monthlyResult
                ? { kind: 'monthly', result: monthlyResult }
                : dailyResult
                  ? { kind: 'daily', result: dailyResult }
                  : null
            }
            onReview={review}
            disabledReason={
              hasApiKey ? undefined : 'Configure a API Key na aba Config. IA para habilitar a revisão.'
            }
          />
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    minHeight: 42,
  },
  cta: { marginBottom: 16 },
  section: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    marginBottom: 6,
  },
  sectionHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
});
