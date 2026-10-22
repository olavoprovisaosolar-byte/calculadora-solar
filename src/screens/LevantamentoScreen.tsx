import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionDialog } from '../components/ActionDialog';
import { CurrentAmpCard } from '../components/CurrentAmpCard';
import { FieldLabel } from '../components/InfoTip';
import { InputField } from '../components/InputField';
import { LoadShareChart } from '../components/LoadShareChart';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { loadAppBackup, patchAppBackup, subscribeAppBackup } from '../services/appBackup';
import { forgetSurvey, loadSurveyHistory, rememberSurvey, replaceSurveyHistory, subscribeSurveyHistory } from '../services/surveyStore';
import { useTheme } from '../theme/ThemeContext';
import { formatNumber, parseLocaleNumber } from '../utils/calculations';
import { mergeSurveyHistory, normalizeSurveyHistory, searchSurveys, shouldShowClientLookup, SurveyRecord } from '../utils/surveyHistory';
import {
  AcOutputTopology,
  BatteryModelId,
  BatteryTech,
  BusVoltageV,
  calculateOffGridLoad,
  DOD_RANGE,
  modelsForTech,
  MonoVoltage,
  OffGridLoadInput,
  SupplyStandard,
  TriVoltagePair,
  validateOffGridInput,
} from '../utils/offGridLoad';
import {
  acOutputTag,
  buildOffGridReportHtml,
  describeAssembly,
  describeLinePeak,
  describeOutputCurrent,
  describeOutputProtection,
  describeTopologyComparison,
  describeTransformer,
  dodConsideredLabel,
  FIELD_HELP,
  loadSplitLabels,
  offGridReportFileName,
  supplyHelp,
  supplyTitle,
} from '../utils/offGridReport';

function todayPtBr(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${now.getFullYear()}`;
}

function formatSavedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('pt-BR');
}

const FU_STEPS = [0.6, 0.7, 0.8, 0.9] as const;
const SUPPLY_VALUES: SupplyStandard[] = ['mono', 'biphasic', 'triphasic'];
const AC_OUTPUT_VALUES: AcOutputTopology[] = ['mono220', 'split_phase', 'triphasic'];
const BUS_VALUES: BusVoltageV[] = [24, 48];
const BATTERY_IDS: BatteryModelId[] = ['li-48-100', 'li-24-100', 'st-12-240', 'st-12-150'];

type AutonomyUnit = 'hours' | 'days';

function isOneOf<T extends string | number>(value: unknown, options: readonly T[]): value is T {
  return options.includes(value as T);
}

function parseNonNegative(text: string): number {
  if (text.trim() === '') return 0;
  return parseLocaleNumber(text);
}

export function LevantamentoScreen() {
  const { colors } = useTheme();
  const [supply, setSupply] = useState<SupplyStandard>('biphasic');
  const [monoVoltage, setMonoVoltage] = useState<MonoVoltage>(127);
  const [triPair, setTriPair] = useState<TriVoltagePair>('127_220');
  const [currentAText, setCurrentAText] = useState('');
  const [currentBText, setCurrentBText] = useState('');
  const [currentCText, setCurrentCText] = useState('');
  const [currentNeutralText, setCurrentNeutralText] = useState('');
  const [utilization, setUtilization] = useState(0.8);
  const [acOutput, setAcOutput] = useState<AcOutputTopology>('mono220');
  const [inverterBus, setInverterBus] = useState<BusVoltageV>(48);
  const [busVoltage, setBusVoltage] = useState<BusVoltageV>(48);
  const [busTouched, setBusTouched] = useState(false);
  const [autonomyText, setAutonomyText] = useState('12');
  const [autonomyUnit, setAutonomyUnit] = useState<AutonomyUnit>('hours');
  const [useDod, setUseDod] = useState(true);
  const [dodText, setDodText] = useState('80');
  const [batteryModelId, setBatteryModelId] = useState<BatteryModelId>('li-48-100');
  const [showAlternative, setShowAlternative] = useState(false);
  const [efficiencyText, setEfficiencyText] = useState('92');
  const [clientName, setClientName] = useState('');
  const [clientLocation, setClientLocation] = useState('');
  const [surveyDate, setSurveyDate] = useState(todayPtBr);
  const [clientError, setClientError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [backupReady, setBackupReady] = useState(false);
  const [history, setHistory] = useState<SurveyRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [lookupOpen, setLookupOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [pdfChoiceOpen, setPdfChoiceOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SurveyRecord | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const historyReady = useRef(false);
  const draftIdRef = useRef<string | null>(null);
  const lookupBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (lookupBlurTimer.current) clearTimeout(lookupBlurTimer.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const apply = (draft: NonNullable<Awaited<ReturnType<typeof loadAppBackup>>['offGrid']>) => {
      if (isOneOf(draft.supply, SUPPLY_VALUES)) setSupply(draft.supply);
      if (draft.monoVoltage === 127 || draft.monoVoltage === 220) setMonoVoltage(draft.monoVoltage);
      if (draft.triPair === '127_220' || draft.triPair === '220_380') setTriPair(draft.triPair);
      setCurrentAText(draft.currentAText ?? '');
      setCurrentBText(draft.currentBText ?? '');
      setCurrentCText(draft.currentCText ?? '');
      setCurrentNeutralText(draft.currentNeutralText ?? '');
      if (typeof draft.utilization === 'number') setUtilization(draft.utilization);
      if (isOneOf(draft.acOutput, AC_OUTPUT_VALUES)) setAcOutput(draft.acOutput);
      if (isOneOf(draft.inverterBus, BUS_VALUES)) setInverterBus(draft.inverterBus);
      if (isOneOf(draft.busVoltage, BUS_VALUES)) setBusVoltage(draft.busVoltage);
      setBusTouched(Boolean(draft.busTouched));
      setAutonomyText(draft.autonomyText ?? '12');
      setAutonomyUnit(draft.autonomyUnit === 'days' ? 'days' : 'hours');
      setUseDod(draft.useDod !== false);
      setDodText(draft.dodText ?? '80');
      if (isOneOf(draft.batteryModelId, BATTERY_IDS)) setBatteryModelId(draft.batteryModelId);
      setEfficiencyText(draft.efficiencyText ?? '92');
      setClientName(draft.clientName ?? '');
      setClientLocation(draft.clientLocation ?? '');
      setSurveyDate(draft.surveyDate || todayPtBr());
    };
    loadAppBackup().then(async (backup) => {
      if (cancelled) return;
      if (backup.offGrid) apply(backup.offGrid);
      const local = await loadSurveyHistory();
      if (cancelled) return;
      const merged = mergeSurveyHistory(backup.loadHistory ?? [], local);
      if (!historyReady.current) setHistory(merged);
      if (JSON.stringify(merged) !== JSON.stringify(local)) {
        const stored = await replaceSurveyHistory(merged);
        if (!cancelled && !historyReady.current) setHistory(stored);
      }
      if (!cancelled) setBackupReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!backupReady) return undefined;
    const timer = setTimeout(() => {
      void patchAppBackup({
        offGrid: {
          supply,
          monoVoltage,
          triPair,
          currentAText,
          currentBText,
          currentCText,
          currentNeutralText,
          utilization,
          acOutput,
          inverterBus,
          busVoltage,
          busTouched,
          autonomyText,
          autonomyUnit,
          useDod,
          dodText,
          batteryModelId,
          efficiencyText,
          clientName,
          clientLocation,
          surveyDate,
        },
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [
    backupReady,
    supply,
    monoVoltage,
    triPair,
    currentAText,
    currentBText,
    currentCText,
    currentNeutralText,
    utilization,
    acOutput,
    inverterBus,
    busVoltage,
    busTouched,
    autonomyText,
    autonomyUnit,
    useDod,
    dodText,
    batteryModelId,
    efficiencyText,
    clientName,
    clientLocation,
    surveyDate,
  ]);

  useEffect(() => {
    return subscribeAppBackup(() => {
      void Promise.all([loadAppBackup(), loadSurveyHistory()]).then(([backup, local]) => {
        setHistory(mergeSurveyHistory(normalizeSurveyHistory(backup.loadHistory), local));
        if (!backup.offGrid) return;
        const draft = backup.offGrid;
        if (isOneOf(draft.supply, SUPPLY_VALUES)) setSupply(draft.supply);
        if (draft.monoVoltage === 127 || draft.monoVoltage === 220) setMonoVoltage(draft.monoVoltage);
        if (draft.triPair === '127_220' || draft.triPair === '220_380') setTriPair(draft.triPair);
        if (isOneOf(draft.acOutput, AC_OUTPUT_VALUES)) setAcOutput(draft.acOutput);
        if (isOneOf(draft.inverterBus, BUS_VALUES)) setInverterBus(draft.inverterBus);
        if (isOneOf(draft.busVoltage, BUS_VALUES)) setBusVoltage(draft.busVoltage);
        setBusTouched(Boolean(draft.busTouched));
        setUseDod(draft.useDod !== false);
        setAutonomyUnit(draft.autonomyUnit === 'days' ? 'days' : 'hours');
        if (typeof draft.utilization === 'number') setUtilization(draft.utilization);
        setCurrentAText(draft.currentAText ?? '');
        setCurrentBText(draft.currentBText ?? '');
        setCurrentCText(draft.currentCText ?? '');
        setCurrentNeutralText(draft.currentNeutralText ?? '');
        setClientName(draft.clientName ?? '');
        setClientLocation(draft.clientLocation ?? '');
        setSurveyDate(draft.surveyDate || todayPtBr());
        setAutonomyText(draft.autonomyText ?? '12');
        setEfficiencyText(draft.efficiencyText ?? '92');
        setDodText(draft.dodText ?? '80');
        if (isOneOf(draft.batteryModelId, BATTERY_IDS)) setBatteryModelId(draft.batteryModelId);
      });
    });
  }, []);

  useEffect(() => subscribeSurveyHistory(setHistory), []);

  const draft = useMemo(() => {
    const autonomyRaw = parseLocaleNumber(autonomyText);
    const autonomyHours =
      Number.isFinite(autonomyRaw) && autonomyRaw > 0
        ? autonomyUnit === 'days'
          ? autonomyRaw * 24
          : autonomyRaw
        : NaN;
    const efficiencyPct = parseLocaleNumber(efficiencyText);
    const dodPct = parseLocaleNumber(dodText);
    const input: OffGridLoadInput = {
      supply,
      monoVoltage,
      triPair,
      currentA: parseNonNegative(currentAText),
      currentB: parseNonNegative(currentBText),
      currentC: parseNonNegative(currentCText),
      currentNeutral: parseNonNegative(currentNeutralText),
      utilizationFactor: utilization,
      acOutput,
      busVoltageV: busVoltage,
      autonomyHours,
      useDod,
      dod: Number.isFinite(dodPct) ? dodPct / 100 : NaN,
      batteryModelId,
      inverterEfficiency: Number.isFinite(efficiencyPct) ? efficiencyPct / 100 : NaN,
    };
    return input;
  }, [
    autonomyText,
    autonomyUnit,
    batteryModelId,
    busVoltage,
    currentAText,
    currentBText,
    currentCText,
    currentNeutralText,
    dodText,
    efficiencyText,
    acOutput,
    monoVoltage,
    supply,
    triPair,
    useDod,
    utilization,
  ]);

  const validationError = validateOffGridInput(draft);
  const result = validationError ? null : calculateOffGridLoad(draft);

  const batteryTech: BatteryTech = batteryModelId.startsWith('li-') ? 'lithium' : 'stationary';
  const dodRange = DOD_RANGE[batteryTech];

  const onInverterBus = (value: BusVoltageV) => {
    setInverterBus(value);
    if (!busTouched) setBusVoltage(value);
  };

  const onBankBus = (value: BusVoltageV) => {
    setBusTouched(true);
    setBusVoltage(value);
  };

  const onTech = (tech: BatteryTech) => {
    const next = modelsForTech(tech)[0];
    setBatteryModelId(next.id);
    setDodText(String(Math.round(DOD_RANGE[tech].default * 100)));
    setUseDod(true);
  };

  const reportFileName = offGridReportFileName(clientName, surveyDate);

  function nextClientId(): string {
    if (editingId) return editingId;
    if (!draftIdRef.current) {
      draftIdRef.current = `carga-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    return draftIdRef.current;
  }

  async function persistCurrentClient(): Promise<boolean> {
    const name = clientName.trim();
    if (!name) {
      setClientError('Informe o nome do cliente ou do projeto.');
      return false;
    }
    historyReady.current = true;
    const savedAt = new Date().toISOString();
    const [record] = normalizeSurveyHistory([
      {
        id: nextClientId(),
        savedAt,
        dataCadastro: savedAt,
        nomeCliente: name,
        clientName: name,
        clientLocation: clientLocation.trim(),
        surveyDate,
        supply,
        monoVoltage,
        triPair,
        currentAText,
        currentBText,
        currentCText,
        currentNeutralText,
        utilization,
        acOutput,
        inverterBus,
        busVoltage,
        busTouched,
        autonomyText,
        autonomyUnit,
        useDod,
        dodText,
        batteryModelId,
        efficiencyText,
      },
    ]);
    if (!record) return false;
    const next = await rememberSurvey(record);
    setHistory(next);
    setClientError('');
    return true;
  }

  const onExportPdf = async () => {
    if (!result) return;
    if (!clientName.trim()) {
      setClientError('Informe o nome do cliente ou do projeto.');
      return;
    }
    const savedName = clientName.trim();
    setExporting(true);
    let saved = false;
    try {
      saved = await persistCurrentClient();
    } catch {
      Alert.alert('Não foi possível salvar o cadastro', 'O relatório ainda será gerado.');
    }
    try {
      const html = buildOffGridReportHtml(draft, result, {
        clientName,
        location: clientLocation,
        surveyDate,
      });
      const file = await Print.printToFileAsync({ html });
      let uri = file.uri;
      const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (base) {
        const dest = `${base}${reportFileName}`;
        await FileSystem.copyAsync({ from: file.uri, to: dest });
        uri = dest;
      }
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: reportFileName,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF gerado', 'O relatório foi criado, mas o compartilhamento não está disponível neste aparelho.');
      }
      if (saved) {
        setNotice(`Cadastro de ${savedName} salvo. Ele aparece em Consultar / Buscar Clientes.`);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
      setPdfChoiceOpen(true);
    } catch {
      Alert.alert(
        'Não foi possível gerar o PDF',
        saved
          ? `O cadastro de ${savedName} foi salvo na consulta. Tente gerar o PDF novamente.`
          : 'Tente novamente. Se o problema continuar, confira o espaço livre do aparelho.',
      );
    } finally {
      setExporting(false);
    }
  };

  const resetForm = useCallback(() => {
    setSupply('biphasic');
    setMonoVoltage(127);
    setTriPair('127_220');
    setCurrentAText('');
    setCurrentBText('');
    setCurrentCText('');
    setCurrentNeutralText('');
    setUtilization(0.8);
    setAcOutput('mono220');
    setInverterBus(48);
    setBusVoltage(48);
    setBusTouched(false);
    setAutonomyText('12');
    setAutonomyUnit('hours');
    setUseDod(true);
    setDodText('80');
    setBatteryModelId('li-48-100');
    setShowAlternative(false);
    setEfficiencyText('92');
    setClientName('');
    setClientLocation('');
    setSurveyDate(todayPtBr());
    setClientError('');
    setEditingId(null);
    draftIdRef.current = null;
  }, []);

  const openSurvey = useCallback((record: SurveyRecord) => {
    if (isOneOf(record.supply, SUPPLY_VALUES)) setSupply(record.supply);
    setMonoVoltage(record.monoVoltage === 220 ? 220 : 127);
    setTriPair(record.triPair === '220_380' ? '220_380' : '127_220');
    setCurrentAText(record.currentAText);
    setCurrentBText(record.currentBText);
    setCurrentCText(record.currentCText);
    setCurrentNeutralText(record.currentNeutralText);
    setUtilization(record.utilization);
    if (isOneOf(record.acOutput, AC_OUTPUT_VALUES)) setAcOutput(record.acOutput);
    if (isOneOf(record.inverterBus, BUS_VALUES)) setInverterBus(record.inverterBus);
    if (isOneOf(record.busVoltage, BUS_VALUES)) setBusVoltage(record.busVoltage);
    setBusTouched(record.busTouched);
    setAutonomyText(record.autonomyText);
    setAutonomyUnit(record.autonomyUnit);
    setUseDod(record.useDod);
    setDodText(record.dodText);
    if (isOneOf(record.batteryModelId, BATTERY_IDS)) setBatteryModelId(record.batteryModelId);
    setEfficiencyText(record.efficiencyText);
    setClientName(record.clientName);
    setClientLocation(record.clientLocation);
    setSurveyDate(record.surveyDate || todayPtBr());
    setClientError('');
    setEditingId(record.id);
    setNotice(`Cadastro de ${record.clientName} aberto para edição.`);
  }, []);

  const openLookup = useCallback(() => {
    if (lookupBlurTimer.current) clearTimeout(lookupBlurTimer.current);
    setLookupOpen(true);
  }, []);

  const closeLookupSoon = useCallback(() => {
    if (lookupBlurTimer.current) clearTimeout(lookupBlurTimer.current);
    lookupBlurTimer.current = setTimeout(() => setLookupOpen(false), 250);
  }, []);

  const selectClient = useCallback((record: SurveyRecord) => {
    if (lookupBlurTimer.current) clearTimeout(lookupBlurTimer.current);
    openSurvey(record);
    setSearchText('');
    setLookupOpen(false);
  }, [openSurvey]);

  async function onSave() {
    const name = clientName.trim();
    if (!name) {
      setClientError('Informe o nome do cliente ou do projeto.');
      return;
    }
    setSaving(true);
    try {
      const updated = Boolean(editingId);
      const ok = await persistCurrentClient();
      if (!ok) return;
      resetForm();
      const confirmation = updated
        ? 'Cadastro atualizado. O formulário foi limpo para um novo cliente.'
        : 'Cadastro salvo. O formulário foi limpo para um novo cliente.';
      setNotice(confirmation);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      Alert.alert('Cadastro salvo', confirmation);
    } catch {
      Alert.alert('Não foi possível salvar', 'Tente novamente. Os dados digitados continuam na tela.');
    } finally {
      setSaving(false);
    }
  }

  async function onConfirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    historyReady.current = true;
    try {
      const next = await forgetSurvey(target.id);
      setHistory(next);
      if (editingId === target.id) resetForm();
      setNotice(`Cadastro de ${target.clientName} excluído.`);
    } catch {
      Alert.alert('Não foi possível excluir', 'O cadastro continua na lista.');
    }
  }

  const visibleSurveys = searchSurveys(history, searchText);
  const lookupVisible = shouldShowClientLookup(lookupOpen, searchText);
  const openRecord = editingId ? history.find((item) => item.id === editingId) ?? null : null;

  return (
    <ScreenContainer
      title="Levantamento"
      subtitle="Medição com alicate e dimensionamento off-grid / retrofit."
      scrollRef={scrollRef}
    >
      {notice ? <Banner tone="success" text={notice} /> : null}
      <Section
        title="Consultar / Buscar Clientes"
        hint="Toque na busca ou comece a digitar o nome. A lista abre com os clientes encontrados e fecha ao escolher um."
      >
        <InputField
          label="Buscar cliente"
          value={searchText}
          onChangeText={(value) => {
            setSearchText(value);
            openLookup();
          }}
          onFocus={openLookup}
          onBlur={closeLookupSoon}
          placeholder="Ex.: Olavo"
          autoCapitalize="words"
        />
        {openRecord ? (
          <>
            <Text style={[styles.fileName, { color: colors.text }]}>
              Edição aberta: {openRecord.nomeCliente || openRecord.clientName}. Salvar atualiza este cliente.
            </Text>
            <PrimaryButton
              label="Excluir"
              onPress={() => setPendingDelete(openRecord)}
              variant="danger"
              style={styles.deleteBtn}
            />
          </>
        ) : null}
        {lookupVisible ? (
          <View style={[styles.lookupPanel, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            {history.length === 0 ? (
              <Text style={[styles.lookupEmpty, { color: colors.textSecondary }]}>Nenhum cadastro salvo ainda.</Text>
            ) : visibleSurveys.length === 0 ? (
              <Text style={[styles.lookupEmpty, { color: colors.textSecondary }]}>
                Nenhum cliente encontrado com esse nome.
              </Text>
            ) : (
              <ScrollView style={styles.lookupScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {visibleSurveys.map((record) => (
                  <Pressable
                    key={record.id}
                    accessibilityRole="button"
                    onPress={() => selectClient(record)}
                    onPressIn={() => selectClient(record)}
                    style={[styles.lookupRow, { borderBottomColor: colors.border }]}
                  >
                    <Text style={[styles.lookupName, { color: colors.text }]}>
                      {record.nomeCliente || record.clientName}
                    </Text>
                    <Text style={[styles.lookupMeta, { color: colors.textSecondary }]}>
                      Salvo em {formatSavedAt(record.dataCadastro || record.savedAt)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        ) : null}
      </Section>
      <Section
        title="Identificação do cliente"
        hint="Estes dados abrem a proposta técnica e definem o nome do PDF."
      >
        <InputField
          label="Nome do Cliente / Projeto"
          value={clientName}
          onChangeText={(value) => {
            setClientName(value);
            if (value.trim()) setClientError('');
          }}
          placeholder="Ex.: João da Silva"
          error={clientError || undefined}
          autoCapitalize="words"
        />
        <InputField
          label="Endereço/Cidade"
          value={clientLocation}
          onChangeText={setClientLocation}
          placeholder="Ex.: Manaus/AM"
          autoCapitalize="words"
        />
        <InputField
          label="Data do Levantamento"
          value={surveyDate}
          onChangeText={setSurveyDate}
          placeholder={todayPtBr()}
          hint="Preenchida com a data de hoje. Ajuste se o levantamento foi em outro dia."
        />
        <Text style={[styles.fileName, { color: colors.textSecondary }]}>
          {clientName.trim()
            ? `Arquivo: ${reportFileName}`
            : 'Arquivo: Relatorio_OffGrid_[Nome_do_Cliente]_[Data].pdf'}
        </Text>
      </Section>

      <Section
        title="1. Medição do Padrão da Residência (Entrada)"
        hint="Leituras de campo com alicate amperímetro, só nos condutores que o padrão possui."
      >
        <Text style={[styles.fieldCaption, { color: colors.textSecondary }]}>
          Padrão da Rede Residencial/Comercial
        </Text>
        <ChoiceCard
          selected={supply === 'mono'}
          title={supplyTitle('mono')}
          body={supplyHelp('mono')}
          onPress={() => setSupply('mono')}
        />
        <ChoiceCard
          selected={supply === 'biphasic'}
          title={supplyTitle('biphasic')}
          body={supplyHelp('biphasic')}
          onPress={() => setSupply('biphasic')}
        />
        <ChoiceCard
          selected={supply === 'triphasic'}
          title={supplyTitle('triphasic')}
          body={supplyHelp('triphasic')}
          onPress={() => setSupply('triphasic')}
        />
        {supply === 'mono' ? (
          <>
            <Text style={[styles.fieldCaption, { color: colors.textSecondary }]}>
              Tensão Selecionada (127V ou 220V)
            </Text>
            <Segment
              options={[
                { key: '127', label: '127 V' },
                { key: '220', label: '220 V' },
              ]}
              value={String(monoVoltage)}
              onChange={(key) => setMonoVoltage(key === '220' ? 220 : 127)}
            />
            <CurrentAmpCard tone="A" value={currentAText} onChangeText={setCurrentAText} />
          </>
        ) : null}
        {supply === 'biphasic' ? (
          <>
            <Text style={[styles.fixedVoltage, { color: colors.textSecondary }]}>
              Tensões deste padrão: 127 V fase-neutro e 220 V fase-fase.
            </Text>
            <CurrentAmpCard tone="A" value={currentAText} onChangeText={setCurrentAText} />
            <CurrentAmpCard tone="B" value={currentBText} onChangeText={setCurrentBText} />
            <CurrentAmpCard
              tone="N"
              value={currentNeutralText}
              onChangeText={setCurrentNeutralText}
              tip={FIELD_HELP.neutral}
            />
          </>
        ) : null}
        {supply === 'triphasic' ? (
          <>
            <Text style={[styles.fieldCaption, { color: colors.textSecondary }]}>
              Tensão do padrão trifásico
            </Text>
            <Segment
              options={[
                { key: '127_220', label: '127/220 V' },
                { key: '220_380', label: '220/380 V' },
              ]}
              value={triPair}
              onChange={(key) => setTriPair(key === '220_380' ? '220_380' : '127_220')}
            />
            <CurrentAmpCard tone="A" value={currentAText} onChangeText={setCurrentAText} />
            <CurrentAmpCard tone="B" value={currentBText} onChangeText={setCurrentBText} />
            <CurrentAmpCard tone="C" value={currentCText} onChangeText={setCurrentCText} />
            <CurrentAmpCard
              tone="N"
              value={currentNeutralText}
              onChangeText={setCurrentNeutralText}
              tip={FIELD_HELP.neutral}
            />
          </>
        ) : null}
      </Section>

      <Section
        title="2. Especificação da Saída AC do Inversor (Alimentação da Casa)"
        hint={FIELD_HELP.inverterIntro}
      >
        <ChoiceCard
          selected={acOutput === 'mono220'}
          title="Saída 220V Monofásica (Fase + Neutro)"
          body={FIELD_HELP.mono220}
          onPress={() => setAcOutput('mono220')}
        />
        <ChoiceCard
          selected={acOutput === 'split_phase'}
          title="Saída Bifásica Nativa (Split-Phase: Fase A + Fase B + Neutro)"
          body={FIELD_HELP.splitPhase}
          onPress={() => setAcOutput('split_phase')}
        />
        <ChoiceCard
          selected={acOutput === 'triphasic'}
          title="Saída Trifásica Nativa (3 Fases + Neutro)"
          body={FIELD_HELP.triphasic}
          onPress={() => setAcOutput('triphasic')}
        />
        <FieldLabel label="Fator de ocupação" tip={FIELD_HELP.utilization} />
        <Segment
          options={FU_STEPS.map((step) => ({
            key: String(step),
            label: `${Math.round(step * 100)}%`,
          }))}
          value={String(utilization)}
          onChange={(key) => setUtilization(Number(key))}
        />
        <Text style={[styles.fieldCaption, { color: colors.textSecondary }]}>
          Barramento CC do inversor
        </Text>
        <Segment
          options={[
            { key: '24', label: '24 V' },
            { key: '48', label: '48 V' },
          ]}
          value={String(inverterBus)}
          onChange={(key) => onInverterBus(key === '24' ? 24 : 48)}
        />
      </Section>

      <Section
        title="3. Especificação do Banco de Baterias (Estoque)"
        hint="Escolha a tecnologia e o modelo que será instalado no cliente."
      >
        <Text style={[styles.fieldCaption, { color: colors.textSecondary }]}>Tecnologia</Text>
        <ChoiceCard
          selected={batteryTech === 'lithium'}
          title="Lítio (LiFePO4)"
          badge={FIELD_HELP.lithiumBadge}
          badgeTone="green"
          onPress={() => onTech('lithium')}
        />
        <ChoiceCard
          selected={batteryTech === 'stationary'}
          title="Estacionária (Chumbo-Ácido)"
          badge={FIELD_HELP.stationaryBadge}
          badgeTone="slate"
          onPress={() => onTech('stationary')}
        />
        <Text style={[styles.fieldCaption, { color: colors.textSecondary }]}>Modelo base</Text>
        <Segment
          options={modelsForTech(batteryTech).map((model) => ({
            key: model.id,
            label: model.shortLabel,
          }))}
          value={batteryModelId}
          onChange={setBatteryModelId}
        />
        <Text style={[styles.fieldCaption, { color: colors.textSecondary }]}>
          Barramento CC do banco
          {busVoltage === inverterBus ? ' · acompanha o inversor' : ' · ajuste manual'}
        </Text>
        <Segment
          options={[
            { key: '24', label: '24 V' },
            { key: '48', label: '48 V' },
          ]}
          value={String(busVoltage)}
          onChange={(key) => onBankBus(key === '24' ? 24 : 48)}
        />
        <Text style={[styles.fieldCaption, { color: colors.textSecondary }]}>Autonomia desejada</Text>
        <Segment
          options={[
            { key: 'hours', label: 'Horas' },
            { key: 'days', label: 'Dias' },
          ]}
          value={autonomyUnit}
          onChange={setAutonomyUnit}
        />
        <InputField
          label={autonomyUnit === 'days' ? 'Autonomia (dias)' : 'Autonomia (horas)'}
          value={autonomyText}
          onChangeText={setAutonomyText}
          keyboardType="decimal-pad"
          placeholder={autonomyUnit === 'days' ? '1' : '12'}
        />
        <FieldLabel label="Profundidade de descarga" tip={FIELD_HELP.dod} />
        <Text style={[styles.dodLabel, { color: colors.primary, backgroundColor: colors.primarySoft }]}>
          {dodConsideredLabel(
            batteryTech,
            Number.isFinite(parseLocaleNumber(dodText)) ? parseLocaleNumber(dodText) : dodRange.default * 100,
            useDod,
          )}
        </Text>
        <Segment
          options={[
            { key: 'yes', label: 'Considerar DoD' },
            { key: 'no', label: 'Ignorar DoD' },
          ]}
          value={useDod ? 'yes' : 'no'}
          onChange={(key) => setUseDod(key === 'yes')}
        />
        {useDod ? (
          <>
            <Segment
              options={dodSteps(batteryTech).map((step) => ({
                key: String(step),
                label: `${step}%`,
              }))}
              value={dodText}
              onChange={setDodText}
            />
            <InputField
              label="DoD manual (%)"
              value={dodText}
              onChangeText={setDodText}
              keyboardType="decimal-pad"
              placeholder={String(Math.round(dodRange.default * 100))}
              hint={
                batteryTech === 'lithium'
                  ? 'Lítio: ajuste entre 70% e 90%. Padrão 80%.'
                  : 'Estacionária: ajuste entre 30% e 60%. Padrão 50%.'
              }
            />
          </>
        ) : null}
        <InputField
          label="Eficiência do inversor (%)"
          value={efficiencyText}
          onChangeText={setEfficiencyText}
          keyboardType="decimal-pad"
          placeholder="92"
        />
      </Section>

      <View style={styles.actionRow}>
        <View style={styles.actionItem}>
          <PrimaryButton label="Salvar" onPress={() => void onSave()} loading={saving} />
        </View>
        <View style={styles.actionItem}>
          <PrimaryButton
            label="Novo Cadastro"
            onPress={() => {
              resetForm();
              setNotice('Formulário limpo.');
            }}
            variant="ghost"
          />
        </View>
      </View>

      {validationError ? (
        <Text style={[styles.pending, { color: colors.textSecondary }]}>{validationError}</Text>
      ) : null}

      {result ? (
        <>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>Diagnóstico da carga</Text>
            <LoadShareChart
              share127={result.share127}
              share220={result.share220}
              power127Kw={result.power127W / 1000}
              power220Kw={result.power220W / 1000}
              lowLabel={loadSplitLabels(draft).low}
              highLabel={loadSplitLabels(draft).high}
            />
            <Metric label="Potência total medida" value={`${formatNumber(result.powerTotalW / 1000)} kW`} emphasize />
            <Metric
              label={`Carga ${loadSplitLabels(draft).low}`}
              value={`${formatNumber(result.power127W / 1000)} kW · ${formatNumber(result.share127 * 100, 0)}%`}
            />
            <Metric
              label={`Carga ${loadSplitLabels(draft).high}`}
              value={`${formatNumber(result.power220W / 1000)} kW · ${formatNumber(result.share220 * 100, 0)}%`}
            />
            <Text style={[styles.outputCurrent, { color: colors.text, borderTopColor: colors.border }]}>
              {describeOutputCurrent(draft, result)}
            </Text>
            <Text style={[styles.fieldCaption, { color: colors.textSecondary }]}>
              {describeTopologyComparison(result)}
            </Text>
            <Text style={[styles.fieldCaption, { color: colors.textSecondary }]}>
              {describeLinePeak(result)}
            </Text>
            {result.neutralInconsistent ? (
              <Banner
                tone="warning"
                text="A corrente de neutro supera a soma das fases. Revise a medição: a carga 220 V foi limitada a zero neste cálculo."
              />
            ) : null}
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>Inversor recomendado</Text>
            <Text style={[styles.headline, { color: colors.accent }]}>
              {acOutputTag(acOutput)}: {formatNumber(result.inverterSuggestedKw)} kW
            </Text>
            <Metric
              label="Potência mínima calculada"
              value={`${formatNumber(result.inverterMinW / 1000)} kW`}
            />
            <Metric
              label="Fator de ocupação aplicado"
              value={`${formatNumber(result.utilizationFactor * 100, 0)}%`}
            />
            <Text style={[styles.fieldCaption, { color: colors.textSecondary }]}>
              {describeOutputProtection(result)}
            </Text>
          </View>
          {result.sizedByLinePeak ? (
            <Banner
              tone="warning"
              text="Inversor trifásico pela fase mais carregada. I_R, I_S e I_T usam a soma vetorial, e a potência mínima cobre 3 × Imax × tensão fase-neutro."
            />
          ) : null}
          <Banner
            tone={result.surgeMarginTight ? 'warning' : 'info'}
            text={
              result.surgeMarginTight
                ? 'Folga apertada para motores e ar-condicionado. Com ocupação a partir de 85%, confirme se a potência de surto do inversor cobre a partida (em geral 2× por poucos segundos) ou suba um porte comercial.'
                : 'Folga técnica: motores e ar-condicionado pedem surto de partida. O fator de ocupação reserva essa margem no regime contínuo; confira a potência de surto no datasheet (tipicamente 2×).'
            }
          />

          {result.transformerStatus === 'required' ? (
            <View style={[styles.alertCard, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Autotransformador de Apoio Necessário</Text>
              <Text style={[styles.alertDetail, { color: colors.text }]}>{describeTransformer(result)}</Text>
              <Text style={[styles.wiring, { color: colors.textSecondary }]}>{FIELD_HELP.mono220}</Text>
            </View>
          ) : null}
          {result.transformerStatus === 'native_neutral' ? (
            <Banner tone="success" text={FIELD_HELP.nativeNeutral} />
          ) : null}

          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>Banco de baterias</Text>
            <Text style={[styles.headline, { color: colors.accent }]}>{result.bank.headline}</Text>
            <Text style={[styles.assembly, { color: colors.text }]}>{describeAssembly(result)}</Text>
            <Text style={[styles.wiring, { color: colors.textSecondary }]}>{result.bank.wiring}</Text>
            {result.bank.compatible ? (
              <>
                <Metric
                  label="Capacidade útil entregue"
                  value={`${formatNumber(result.bank.installedUsefulWh / 1000)} kWh`}
                  emphasize
                />
                <Metric
                  label="Capacidade bruta do banco"
                  value={`${formatNumber(result.bank.installedGrossWh / 1000)} kWh`}
                />
                <Metric
                  label="DoD"
                  value={dodConsideredLabel(
                    batteryTech,
                    Number.isFinite(parseLocaleNumber(dodText))
                      ? parseLocaleNumber(dodText)
                      : dodRange.default * 100,
                    useDod,
                  )}
                />
                <Metric
                  label="Energia pedida"
                  value={`${formatNumber(result.energyWh / 1000)} kWh úteis · ${formatNumber(result.batteryGrossWh / 1000)} kWh brutos`}
                />
              </>
            ) : (
              <Banner tone="warning" text={result.bank.wiring} />
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowAlternative((value) => !value)}
              style={[styles.altToggle, { borderColor: colors.border }]}
            >
              <Text style={[styles.altToggleText, { color: colors.primary }]}>
                {showAlternative
                  ? 'Ocultar opção alternativa'
                  : 'Ver opção alternativa (lítio vs estacionária)'}
              </Text>
            </Pressable>
            {showAlternative ? (
              <View style={styles.compareRow}>
                <CompareCard
                  title="Opção A · Lítio"
                  headline={result.comparison.lithium.headline}
                  detail={`${formatNumber(result.comparison.lithium.installedGrossWh / 1000)} kWh brutos · ~${result.comparison.lithium.model.cycles} ciclos`}
                  note="Peso menor"
                  selected={batteryTech === 'lithium'}
                />
                <CompareCard
                  title="Opção B · Estacionária"
                  headline={result.comparison.stationary.headline}
                  detail={`${formatNumber(result.comparison.stationary.installedGrossWh / 1000)} kWh brutos · ~${result.comparison.stationary.model.cycles} ciclos`}
                  note="Maior ocupação de espaço"
                  selected={batteryTech === 'stationary'}
                />
              </View>
            ) : null}
          </View>

          <PrimaryButton
            label="Gerar relatório técnico em PDF"
            onPress={onExportPdf}
            loading={exporting}
            style={styles.exportBtn}
          />
          <Text style={[styles.fileName, { color: colors.textSecondary }]}>
            {clientName.trim()
              ? `Download: ${reportFileName}`
              : 'Informe o nome do cliente para liberar o nome do arquivo.'}
          </Text>
        </>
      ) : null}
      <ActionDialog
        visible={pdfChoiceOpen}
        title="Relatório baixado"
        message="O cadastro foi salvo na consulta. Deseja iniciar um novo formulário em branco ou manter os dados atuais para edição?"
        primary={{
          label: 'Novo',
          onPress: () => {
            const name = clientName.trim();
            setPdfChoiceOpen(false);
            resetForm();
            setNotice(
              name
                ? `Formulário limpo. O cadastro de ${name} continua em Consultar / Buscar Clientes.`
                : 'Formulário limpo para um novo cadastro.',
            );
            scrollRef.current?.scrollTo({ y: 0, animated: true });
          },
        }}
        secondary={{
          label: 'Manter',
          onPress: () => {
            setPdfChoiceOpen(false);
            setNotice('Os dados continuam na tela para edição.');
          },
        }}
      />
      <ActionDialog
        visible={pendingDelete != null}
        title="Excluir cadastro"
        message={
          pendingDelete
            ? `Excluir o cadastro de ${pendingDelete.clientName}? O registro sai da lista deste aparelho.`
            : ''
        }
        primary={{ label: 'Excluir', onPress: () => void onConfirmDelete() }}
        secondary={{ label: 'Cancelar', onPress: () => setPendingDelete(null) }}
      />
    </ScreenContainer>
  );
}

function dodSteps(tech: BatteryTech): number[] {
  return tech === 'lithium' ? [70, 75, 80, 85, 90] : [30, 40, 50, 60];
}

function CompareCard({
  title,
  headline,
  detail,
  note,
  selected,
}: {
  title: string;
  headline: string;
  detail: string;
  note: string;
  selected: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.compareCard,
        {
          backgroundColor: selected ? colors.primarySoft : colors.inputBg,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text style={[styles.compareTitle, { color: colors.textSecondary }]}>{title}</Text>
      <Text style={[styles.compareHeadline, { color: colors.text }]}>{headline}</Text>
      <Text style={[styles.compareDetail, { color: colors.textSecondary }]}>{detail}</Text>
      <Text style={[styles.compareDetail, { color: colors.text }]}>{note}</Text>
    </View>
  );
}

function ChoiceCard({
  title,
  body,
  badge,
  badgeTone = 'green',
  selected,
  onPress,
}: {
  title: string;
  body?: string;
  badge?: string;
  badgeTone?: 'green' | 'slate';
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const badgeBg = badgeTone === 'green' ? colors.primarySoft : colors.backgroundAlt;
  const badgeFg = badgeTone === 'green' ? colors.primary : colors.textSecondary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.choice,
        {
          backgroundColor: selected ? colors.primarySoft : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text style={[styles.choiceTitle, { color: colors.text }]}>{title}</Text>
      {badge ? (
        <Text style={[styles.badge, { backgroundColor: badgeBg, color: badgeFg }]}>{badge}</Text>
      ) : null}
      {body ? <Text style={[styles.choiceBody, { color: colors.textSecondary }]}>{body}</Text> : null}
    </Pressable>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.section,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {hint ? <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function Segment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (key: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.key)}
            style={[
              styles.segmentItem,
              {
                backgroundColor: selected ? colors.primary : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: selected ? (colors.mode === 'light' ? '#FFFFFF' : colors.background) : colors.text },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Metric({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.metric, { borderTopColor: colors.border }]}>
      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text
        style={[
          styles.metricValue,
          { color: emphasize ? colors.accent : colors.text },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function Banner({ tone, text }: { tone: 'warning' | 'info' | 'success'; text: string }) {
  const { colors } = useTheme();
  const background = tone === 'warning' ? colors.accentSoft : colors.primarySoft;
  const icon =
    tone === 'warning' ? 'warning-outline' : tone === 'success' ? 'checkmark-circle-outline' : 'information-circle-outline';
  const iconColor = tone === 'warning' ? colors.warning : tone === 'success' ? colors.success : colors.primary;
  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: background,
          borderColor: tone === 'success' ? colors.success : colors.border,
        },
      ]}
    >
      <Ionicons name={icon} size={18} color={iconColor} />
      <Text style={[styles.bannerText, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    lineHeight: 22,
  },
  sectionHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 12,
  },
  fieldCaption: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    marginBottom: 8,
  },
  fixedVoltage: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  pair: {
    flexDirection: 'row',
    gap: 12,
  },
  pairItem: { flex: 1 },
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  segmentLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    textAlign: 'center',
  },
  pending: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 17,
    marginBottom: 4,
  },
  choice: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  choiceTitle: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    lineHeight: 20,
  },
  choiceBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 8,
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
  },
  dodLabel: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
  },
  tag: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 10,
  },
  tagText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
  },
  alertCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  alertDetail: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    lineHeight: 22,
    marginTop: 8,
  },
  assembly: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
  },
  outputCurrent: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metric: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  metricLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    flex: 1,
  },
  metricValue: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    textAlign: 'right',
  },
  banner: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  bannerText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  note: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 18,
    marginTop: -8,
    marginBottom: 16,
  },
  wiring: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  headline: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 22,
    lineHeight: 28,
    marginTop: 8,
  },
  altToggle: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 14,
    alignItems: 'center',
  },
  altToggleText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    textAlign: 'center',
  },
  compareRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  compareCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  compareTitle: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    marginBottom: 6,
  },
  compareHeadline: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    lineHeight: 18,
  },
  compareDetail: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  actionItem: { flex: 1 },
  lookupPanel: {
    borderWidth: 1,
    borderRadius: 14,
    marginTop: -4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  lookupScroll: {
    maxHeight: 220,
  },
  lookupRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lookupName: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    lineHeight: 22,
  },
  lookupMeta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  lookupEmpty: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  deleteBtn: { marginTop: 8 },
  exportBtn: { marginBottom: 8 },
  fileName: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
});
