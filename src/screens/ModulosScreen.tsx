import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { HelpCard } from '../components/HelpCard';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import { ResultCard } from '../components/ResultCard';
import { ScreenContainer } from '../components/ScreenContainer';
import { INVERTER_FDI_MAX, INVERTER_FDI_MIN } from '../constants/modules';
import { useModules } from '../hooks/useModules';
import { extractModuleFromText, type ExtractedModuleFields } from '../services/aiService';
import { loadAiConfig } from '../services/secureStorage';
import { useTheme } from '../theme/ThemeContext';
import {
  formatNumber,
  parseLocaleNumber,
  suggestInverterRange,
} from '../utils/calculations';
import {
  datasheetIsComplete,
  parseModuleDatasheet,
  type ParsedModuleDatasheet,
} from '../utils/moduleDatasheet';

function fieldNumber(value: number): string {
  return String(Math.round(value * 1000) / 1000).replace('.', ',');
}

function positiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function mergeDatasheet(
  local: ParsedModuleDatasheet,
  ai?: ExtractedModuleFields,
): ParsedModuleDatasheet {
  if (!ai) return local;
  const text = (value: unknown, fallback: string) =>
    typeof value === 'string' && value.trim() ? value.trim() : fallback;
  return {
    manufacturer: text(ai.manufacturer, local.manufacturer),
    model: text(ai.model, local.model),
    powerWp: positiveNumber(ai.powerWp) ?? local.powerWp,
    lengthM: positiveNumber(ai.lengthM) ?? local.lengthM,
    widthM: positiveNumber(ai.widthM) ?? local.widthM,
    areaM2: positiveNumber(ai.areaM2) ?? local.areaM2,
    thicknessMm: positiveNumber(ai.thicknessMm) ?? local.thicknessMm,
    weightKg: positiveNumber(ai.weightKg) ?? local.weightKg,
    frame: text(ai.frame, local.frame),
    glass: text(ai.glass, local.glass),
    notes: [text(ai.frame, local.frame), text(ai.glass, local.glass)].filter(Boolean).join(' · '),
  };
}

export function ModulosScreen() {
  const { colors } = useTheme();
  const {
    allModules,
    customModules,
    createCustom,
    removeCustom,
    exportBackup,
    importBackup,
  } = useModules();
  const [selectedId, setSelectedId] = useState<string>(allModules[0]?.id ?? '');
  const [quantityText, setQuantityText] = useState('10');
  const [backupBusy, setBackupBusy] = useState(false);

  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [powerText, setPowerText] = useState('');
  const [widthText, setWidthText] = useState('');
  const [lengthText, setLengthText] = useState('');
  const [datasheetText, setDatasheetText] = useState('');
  const [thicknessMm, setThicknessMm] = useState<number | undefined>();
  const [weightKg, setWeightKg] = useState<number | undefined>();
  const [frame, setFrame] = useState('');
  const [glass, setGlass] = useState('');
  const [datasheetNotes, setDatasheetNotes] = useState('');
  const [reading, setReading] = useState(false);
  const [formError, setFormError] = useState<string | undefined>();

  const selected = useMemo(
    () => allModules.find((m) => m.id === selectedId) ?? allModules[0],
    [allModules, selectedId],
  );

  const quantity = parseLocaleNumber(quantityText);
  const validQty = Number.isFinite(quantity) && quantity > 0;

  const sizing = useMemo(() => {
    if (!selected || !validQty) return null;
    const totalWp = quantity * selected.powerWp;
    const totalKwp = totalWp / 1000;
    const totalArea = quantity * selected.areaM2;
    const inverter = suggestInverterRange(totalKwp);
    return { totalWp, totalKwp, totalArea, inverter };
  }, [selected, quantity, validQty]);

  const autoArea = useMemo(() => {
    const w = parseLocaleNumber(widthText);
    const l = parseLocaleNumber(lengthText);
    if (!Number.isFinite(w) || !Number.isFinite(l) || w <= 0 || l <= 0) return null;
    return w * l;
  }, [widthText, lengthText]);

  const onSaveCustom = async () => {
    const powerWp = parseLocaleNumber(powerText);
    const widthM = parseLocaleNumber(widthText);
    const lengthM = parseLocaleNumber(lengthText);

    if (!Number.isFinite(powerWp) || powerWp <= 0) {
      setFormError('Informe a potência em Wp.');
      return;
    }
    if (!Number.isFinite(widthM) || widthM <= 0 || !Number.isFinite(lengthM) || lengthM <= 0) {
      setFormError('Informe largura e comprimento válidos (metros).');
      return;
    }

    setFormError(undefined);
    const created = await createCustom({
      manufacturer,
      model,
      powerWp,
      widthM,
      lengthM,
      thicknessMm,
      weightKg,
      frame,
      glass,
      datasheetNotes,
    });
    setSelectedId(created.id);
    setManufacturer('');
    setModel('');
    setPowerText('');
    setWidthText('');
    setLengthText('');
    setThicknessMm(undefined);
    setWeightKg(undefined);
    setFrame('');
    setGlass('');
    setDatasheetNotes('');
    Alert.alert(
      'Placa salva',
      'A placa ficou disponível na aba Cálculo, Telhado e Módulos. O backup automático deste aparelho já guardou o cadastro.',
    );
  };

  const applyParsed = (parsed: ParsedModuleDatasheet) => {
    if (parsed.manufacturer) setManufacturer(parsed.manufacturer);
    if (parsed.model) setModel(parsed.model);
    if (parsed.powerWp) setPowerText(String(parsed.powerWp));
    if (parsed.widthM) setWidthText(fieldNumber(parsed.widthM));
    if (parsed.lengthM) setLengthText(fieldNumber(parsed.lengthM));
    setThicknessMm(parsed.thicknessMm ?? undefined);
    setWeightKg(parsed.weightKg ?? undefined);
    setFrame(parsed.frame);
    setGlass(parsed.glass);
    setDatasheetNotes(parsed.notes);
  };

  const registerParsed = async (parsed: ParsedModuleDatasheet, detail: string) => {
    applyParsed(parsed);
    if (!datasheetIsComplete(parsed) || !parsed.powerWp || !parsed.lengthM || !parsed.widthM) {
      setFormError('Faltou potência, comprimento ou largura. Complete os campos e toque em salvar.');
      return;
    }
    setFormError(undefined);
    const created = await createCustom({
      manufacturer: parsed.manufacturer,
      model: parsed.model,
      powerWp: parsed.powerWp,
      widthM: parsed.widthM,
      lengthM: parsed.lengthM,
      thicknessMm: parsed.thicknessMm ?? undefined,
      weightKg: parsed.weightKg ?? undefined,
      frame: parsed.frame,
      glass: parsed.glass,
      datasheetNotes: parsed.notes,
    });
    setSelectedId(created.id);
    const extras = [
      parsed.weightKg ? `${formatNumber(parsed.weightKg)} kg` : '',
      parsed.thicknessMm ? `moldura ${formatNumber(parsed.thicknessMm, 0)} mm` : '',
      parsed.frame,
      parsed.glass,
    ]
      .filter(Boolean)
      .join(' · ');
    Alert.alert(
      'Placa cadastrada',
      `${created.manufacturer} ${created.model}: ${created.powerWp} Wp, ${formatNumber(created.lengthM)} × ${formatNumber(created.widthM)} m${extras ? `. ${extras}` : ''}. ${detail}`,
    );
  };

  const onReadLocal = async () => {
    if (!datasheetText.trim()) {
      setFormError('Cole as informações da placa na caixa de texto.');
      return;
    }
    await registerParsed(
      parseModuleDatasheet(datasheetText),
      'Leitura feita no aparelho, sem IA. O backup automático já guardou a placa.',
    );
  };

  const onReadWithAi = async () => {
    if (!datasheetText.trim()) {
      setFormError('Cole as informações da placa na caixa de texto.');
      return;
    }
    const local = parseModuleDatasheet(datasheetText);
    setReading(true);
    setFormError(undefined);
    try {
      const config = await loadAiConfig();
      if (!config.apiKey.trim()) {
        await registerParsed(
          local,
          'Não há chave de IA salva. A placa foi cadastrada com a leitura do aparelho e entrou no backup automático.',
        );
        return;
      }
      const extracted = await extractModuleFromText(config, datasheetText);
      await registerParsed(
        mergeDatasheet(local, extracted),
        'A IA ajudou a ler a ficha. A placa entrou no backup automático.',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'A IA não concluiu a leitura.';
      if (datasheetIsComplete(local)) {
        await registerParsed(
          local,
          `${message} A placa foi cadastrada mesmo assim, com a leitura do aparelho, e entrou no backup automático.`,
        );
      } else {
        applyParsed(local);
        setFormError(message);
      }
    } finally {
      setReading(false);
    }
  };

  const onExportBackup = async () => {
    setBackupBusy(true);
    try {
      await exportBackup();
      Alert.alert(
        'Backup pronto',
        'Escolha Pasta Download, Drive ou outro local. O arquivo guarda placas, telhado, carga e o consumo da aba Cálculo.',
      );
    } catch (error) {
      Alert.alert(
        'Falha no backup',
        error instanceof Error ? error.message : 'Não foi possível exportar o backup.',
      );
    } finally {
      setBackupBusy(false);
    }
  };

  const onImportBackup = async () => {
    setBackupBusy(true);
    try {
      const result = await importBackup();
      Alert.alert(
        'Backup restaurado',
        `${result.count} placa(s) customizada(s) disponíveis em Cálculo, Telhado e Módulos. Telhado, carga e consumo voltam quando o arquivo os contém.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível importar.';
      if (message !== 'Importação cancelada.') {
        Alert.alert('Falha na restauração', message);
      }
    } finally {
      setBackupBusy(false);
    }
  };

  return (
    <ScreenContainer
      title="Módulos & Inversor"
      subtitle="Cadastre placas aqui: elas entram no Cálculo e no Telhado automaticamente."
    >
      <Text style={[styles.section, { color: colors.text }]}>Catálogo de módulos</Text>
      <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
        Customizadas aparecem primeiro. Toque para selecionar · segure para remover customizadas.
      </Text>
      <View style={styles.list}>
        {allModules.map((module) => {
          const selectedModule = module.id === selected?.id;
          return (
            <Pressable
              key={module.id}
              onPress={() => setSelectedId(module.id)}
              onLongPress={() => {
                if (!module.isCustom) return;
                Alert.alert('Remover módulo', `Excluir ${module.model}?`, [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Remover',
                    style: 'destructive',
                    onPress: () => removeCustom(module.id),
                  },
                ]);
              }}
              style={[
                styles.moduleCard,
                {
                  backgroundColor: selectedModule ? colors.primarySoft : colors.surface,
                  borderColor: selectedModule ? colors.primary : colors.border,
                },
              ]}
            >
              <View style={styles.moduleTop}>
                <Text style={[styles.moduleTitle, { color: colors.text }]}>
                  {module.powerWp} Wp · {module.model}
                </Text>
                {module.isCustom ? (
                  <Text style={[styles.badge, { color: colors.accent }]}>Custom</Text>
                ) : null}
              </View>
              <Text style={[styles.moduleMeta, { color: colors.textSecondary }]}>
                {module.manufacturer} · {formatNumber(module.lengthM)} ×{' '}
                {formatNumber(module.widthM)} m · {formatNumber(module.areaM2)} m²
                {module.weightKg ? ` · ${formatNumber(module.weightKg)} kg` : ''}
                {module.thicknessMm ? ` · moldura ${formatNumber(module.thicknessMm, 0)} mm` : ''}
              </Text>
              {module.frame || module.glass ? (
                <Text style={[styles.moduleMeta, { color: colors.textSecondary }]}>
                  {[module.frame, module.glass].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <InputField
        label="Quantidade de placas"
        value={quantityText}
        onChangeText={setQuantityText}
        keyboardType="number-pad"
        placeholder="Ex: 12"
      />

      {sizing && selected ? (
        <ResultCard
          title="Resumo do arranjo"
          rows={[
            {
              label: 'Módulo',
              value: `${selected.powerWp} Wp (${formatNumber(selected.areaM2)} m²)`,
            },
            {
              label: 'Potência total',
              value: `${formatNumber(sizing.totalKwp)} kWp`,
              emphasize: true,
            },
            {
              label: 'Área bruta das placas',
              value: `${formatNumber(sizing.totalArea)} m²`,
            },
            {
              label: `Inversor sugerido (FDI ${INVERTER_FDI_MIN}–${INVERTER_FDI_MAX})`,
              value: `${formatNumber(sizing.inverter.inverterMinKw)} – ${formatNumber(sizing.inverter.inverterMaxKw)} kW`,
            },
          ]}
        />
      ) : null}

      <HelpCard
        title="Fator de Dimensionamento do Inversor (FDI)"
        body="O overboarding considera FDI entre 1,15 e 1,30. A faixa sugerida do inversor é Potência do Sistema (kWp) ÷ 1,30 até Potência do Sistema (kWp) ÷ 1,15."
      />

      <Text style={[styles.section, { color: colors.text }]}>Cadastrar placa customizada</Text>
      <InputField
        label="Informações da placa"
        value={datasheetText}
        onChangeText={setDatasheetText}
        placeholder="Cole aqui a ficha: potência, comprimento, largura, peso, moldura e vidro."
        multiline
        textAlignVertical="top"
        style={styles.datasheet}
        hint="O app lê o texto neste aparelho. Se houver chave de IA, o botão com IA tenta completar os mesmos campos. Sem créditos ou sem chave, a placa ainda é cadastrada."
      />
      <PrimaryButton
        label="Cadastrar com o texto"
        onPress={onReadLocal}
        disabled={reading}
        style={styles.cta}
      />
      <PrimaryButton
        label="Cadastrar com ajuda da IA"
        onPress={onReadWithAi}
        loading={reading}
        variant="secondary"
        style={styles.cta}
      />
      {weightKg || thicknessMm || frame || glass ? (
        <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
          Lido da ficha:
          {weightKg ? ` ${formatNumber(weightKg)} kg` : ''}
          {thicknessMm ? ` · moldura ${formatNumber(thicknessMm, 0)} mm` : ''}
          {frame ? ` · ${frame}` : ''}
          {glass ? ` · ${glass}` : ''}
        </Text>
      ) : null}
      <InputField
        label="Fabricante"
        value={manufacturer}
        onChangeText={setManufacturer}
        placeholder="Ex: Canadian Solar"
      />
      <InputField
        label="Modelo / Potência (Wp)"
        value={model}
        onChangeText={setModel}
        placeholder="Ex: HiKu6 550"
      />
      <InputField
        label="Potência (Wp)"
        value={powerText}
        onChangeText={setPowerText}
        keyboardType="decimal-pad"
        placeholder="Ex: 550"
      />
      <InputField
        label="Largura da Placa (m)"
        value={widthText}
        onChangeText={setWidthText}
        keyboardType="decimal-pad"
        placeholder="Ex: 1,13"
        hint="Em metros (ex.: 1130 mm = 1,13 m)."
      />
      <InputField
        label="Comprimento da Placa (m)"
        value={lengthText}
        onChangeText={setLengthText}
        keyboardType="decimal-pad"
        placeholder="Ex: 2,27"
        hint={
          autoArea
            ? `Área unitária automática: ${formatNumber(autoArea)} m² · ${formatNumber(autoArea * 1e6, 0)} mm²`
            : 'Em metros (ex.: 2270 mm = 2,27 m). Área = Comprimento × Largura.'
        }
        error={formError}
      />
      <PrimaryButton label="Salvar módulo localmente" onPress={onSaveCustom} style={styles.cta} />

      <Text style={[styles.section, { color: colors.text }]}>Backup automático</Text>
      <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
        Placas, telhado, carga e o consumo são gravados sozinhos. Atualizar o aplicativo recupera
        esses dados na hora. Ao desinstalar, o Android pergunta se os dados do Solar Calculator
        devem ser mantidos: deixe essa opção marcada para a próxima instalação trazer tudo de volta.
        Cada alteração também grava Meus Documentos/Calculadora Solar/Backups/solar-calculator-backup.json.
        A sincronização envia esse arquivo para a pasta espelho no Google Drive.
      </Text>
      <Text style={[styles.backupCount, { color: colors.text }]}>
        Customizadas salvas: {customModules.length}
      </Text>
      <PrimaryButton
        label="Exportar backup (JSON)"
        onPress={onExportBackup}
        loading={backupBusy}
        style={styles.cta}
      />
      <PrimaryButton
        label="Restaurar backup"
        onPress={onImportBackup}
        loading={backupBusy}
        variant="secondary"
        style={styles.cta}
      />
      {customModules.length > 0 ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Toque e segure um módulo customizado para removê-lo.
        </Text>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    marginBottom: 8,
    marginTop: 4,
  },
  sectionHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  list: { gap: 10, marginBottom: 16 },
  moduleCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  moduleTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'center',
  },
  moduleTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    flex: 1,
  },
  badge: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
  },
  moduleMeta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    marginTop: 6,
  },
  datasheet: {
    minHeight: 140,
    paddingTop: 12,
  },
  cta: { marginBottom: 10 },
  backupCount: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    marginBottom: 10,
  },
  hint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    marginBottom: 20,
  },
});
