/**
 * Auto-verificação das fórmulas de negócio (sem framework de testes).
 * Execute: npx tsx src/utils/__tests__/calculations.selftest.ts
 */
import {
  calculateFromDaily,
  calculateFromMonthly,
  calculateModulesForPower,
  calculateRoofDirect,
  calculateRoofInverse,
  computeModuleArea,
  suggestInverterRange,
} from '../calculations';
import { explainProviderError } from '../aiErrors';
import { apkFileName, apkReleaseTag } from '../apkRelease';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { datasheetIsComplete, parseModuleDatasheet } from '../moduleDatasheet';
import { mergeBackups, type MergeableBackup } from '../../services/backupMerge';
import { mergeSurveyHistory, normalizeSurveyHistory, removeSurvey, searchSurveys, shouldShowClientLookup } from '../surveyHistory';
import {
  migrationFileName,
  newestBackupRaw,
  ROOT_BACKUP_DISPLAY,
  ROOT_BACKUP_FOLDER,
  safeBackupFileName,
  shouldMigrateExistingData,
  startupRestoreMode,
} from '../../services/rootBackupPolicy';
import { computeRoofLayouts } from '../roofLayout';
import { PRESET_MODULES } from '../../constants/modules';
import {
  buildOffGridReportHtml,
  describeArrangementGuide,
  describeLinePeak,
  describeOutputCurrent,
  describeTopologyComparison,
  FIELD_HELP,
  offGridReportFileName,
  type OffGridReportMeta,
} from '../offGridReport';
import {
  calculateOffGridLoad,
  lineCurrent220A,
  nextCommercialSize,
  recommendedAcBreakerA,
  recommendedConductorMm2,
  validateOffGridInput,
  type OffGridLoadInput,
} from '../offGridLoad';
import { calcularCorrentesLinhaTrifasico } from '../threePhaseCurrents';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function almostEqual(a: number, b: number, eps = 0.011) {
  return Math.abs(a - b) <= eps;
}

const monthly = calculateFromMonthly(450);
assert(almostEqual(monthly.dailyKwh, 15), 'Média diária mensal/30');
assert(almostEqual(monthly.powerKwp, 4.5), 'Potência mensal/100');

const daily = calculateFromDaily(15);
assert(almostEqual(daily.monthlyKwh, 450), 'Mensal = diário*30');
assert(almostEqual(daily.powerKwp, 4.5), 'Potência diário/3.33');

const inverter = suggestInverterRange(4.5);
assert(almostEqual(inverter.inverterMinKw, 4.5 / 1.3), 'Inversor min FDI 1.30');
assert(almostEqual(inverter.inverterMaxKw, 4.5 / 1.15), 'Inversor max FDI 1.15');

const module550 = PRESET_MODULES.find((m) => m.powerWp === 550)!;
const direct = calculateRoofDirect(10, module550, 0.1);
assert(almostEqual(direct.grossAreaM2, 25.6), 'Área bruta');
assert(almostEqual(direct.recommendedAreaM2, 28.16), 'Área recomendada +10%');
assert(almostEqual(direct.totalPowerKwp, 5.5), 'Potência total');

const inverse = calculateRoofInverse(40, module550, 0.1);
assert(almostEqual(inverse.usefulAreaM2, 36), 'Área útil');
assert(inverse.maxModules === 14, `Qtd máx esperada 14, veio ${inverse.maxModules}`);
assert(almostEqual(inverse.maxPowerKwp, 7.7), 'Potência máxima');
assert(almostEqual(inverse.estimatedMonthlyGenerationKwh, 770), 'Geração mensal');

assert(
  almostEqual(computeModuleArea(2.27, 1.13), 2.57) ||
    almostEqual(computeModuleArea(2.27, 1.13), 2.56),
  'Área unitária',
);

const sizing = calculateModulesForPower(4.5, module550);
assert(sizing.quantity === 9, `Qtd placas esperada 9, veio ${sizing.quantity}`);
assert(almostEqual(sizing.installedPowerKwp, 4.95), 'Potência instalada 9x550');
assert(almostEqual(sizing.grossAreaM2, 23.04), 'Área bruta 9x2.56');
assert(sizing.layoutPanelCount >= 9, `Telhado mínimo deve comportar ao menos 9, veio ${sizing.layoutPanelCount}`);
assert(sizing.requiredInstallAreaM2 > sizing.grossAreaM2, 'Área do telhado mínimo inclui folga e grampos');
const sizedLayout = computeRoofLayouts({
  roofWidthM: sizing.roofWidthM,
  roofLengthM: sizing.roofLengthM,
  module: module550,
  edgeMarginM: 0.5,
  endClampM: 0.03,
});
assert(
  sizedLayout.options[0].panelCount === sizing.layoutPanelCount,
  `Cálculo e Telhado divergem: ${sizing.layoutPanelCount} vs ${sizedLayout.options[0].panelCount}`,
);
assert(
  almostEqual(sizedLayout.options[0].totalPowerKwp, sizing.layoutPowerKwp),
  'kWp do telhado mínimo igual nas duas abas',
);
assert(
  almostEqual(sizedLayout.usefulAreaM2, sizing.layoutUsefulAreaM2),
  'Área útil do telhado mínimo igual nas duas abas',
);
assert(almostEqual(sizing.inverterMinKw, 4.95 / 1.3), 'Inversor min pela potência instalada');

const layouts = computeRoofLayouts({
  roofWidthM: 8,
  roofLengthM: 12,
  module: module550,
  edgeMarginM: 0.5,
  panelGapM: 0.02,
  endClampM: 0.03,
});
assert(layouts.options.length === 2, 'Duas opções de layout');
assert(layouts.options[0].panelCount > 0, 'Opção A deve caber placas');
assert(
  layouts.options[0].panelCount >= layouts.options[1].panelCount,
  'Opção A (máximo) >= Opção B (padronizado)',
);
assert(
  layouts.options[0].placements.length === layouts.options[0].panelCount,
  'Placements sync',
);
assert(
  layouts.options[0].orientationSummary.includes('Vertical') ||
    layouts.options[0].orientationSummary.includes('Horizontal'),
  'Resumo de orientação Vertical/Horizontal',
);
assert(layouts.totalRoofAreaM2 > 0, 'Área total do telhado');

// Polígono L-shape + obstáculo: deve caber menos que o retângulo pleno
const polyLayouts = computeRoofLayouts({
  polygon: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 6 },
    { x: 4, y: 6 },
    { x: 4, y: 10 },
    { x: 0, y: 10 },
  ],
  obstacles: [
    {
      id: 'chimney-1',
      kind: 'chimney',
      label: 'Chaminé',
      shape: 'rect',
      x: 1,
      y: 1,
      widthM: 1.2,
      heightM: 1.2,
      clearanceM: 0.4,
    },
  ],
  module: module550,
  edgeMarginM: 0.3,
  panelGapM: 0.02,
  endClampM: 0.03,
});
assert(polyLayouts.options[0].panelCount > 0, 'Polígono irregular deve caber placas');
assert(
  polyLayouts.options[0].placements.every(
    (p) =>
      !(p.x < 2.6 && p.y < 2.6 && p.x + p.width > 0.6 && p.y + p.height > 0.6),
  ),
  'Nenhuma placa sobre obstáculo+clearance',
);

// Obstáculo rotacionado deve continuar bloqueando a área (AABB expandido)
const rotated = computeRoofLayouts({
  roofWidthM: 8,
  roofLengthM: 8,
  module: module550,
  edgeMarginM: 0.3,
  obstacles: [
    {
      id: 'rot-1',
      kind: 'custom',
      label: 'Bloco',
      shape: 'rect',
      x: 3,
      y: 3,
      widthM: 2,
      heightM: 1,
      clearanceM: 0.3,
      rotationDeg: 45,
    },
  ],
});
const plain = computeRoofLayouts({
  roofWidthM: 8,
  roofLengthM: 8,
  module: module550,
  edgeMarginM: 0.3,
  obstacles: [],
});
assert(
  rotated.options[0].panelCount < plain.options[0].panelCount,
  'Obstáculo rotacionado reduz placas vs telhado livre',
);

// 5×8 m / folga 0,1 m: a folga do perímetro é rígida (não empresta a borda).
// End clamp 3 cm + mid clamp 2 cm → 12 placas dentro da área útil.
const fillStrip = computeRoofLayouts({
  roofWidthM: 5,
  roofLengthM: 8,
  module: module550,
  edgeMarginM: 0.1,
  panelGapM: 0.1,
  endClampM: 0.01,
});
assert(
  fillStrip.options[0].panelCount === 12,
  `5×8 com folga rígida deve caber 12 placas, veio ${fillStrip.options[0].panelCount}`,
);
assert(fillStrip.options[0].panelGapM === 0.02, 'Mid clamp permanece 2 cm');
assert(fillStrip.options[0].endClampM === 0.03, 'End clamp abaixo de 3 cm sobe para 3 cm');
const margin = 0.1;
const endClamp = 0.03;
for (const panel of fillStrip.options[0].placements) {
  assert(panel.y >= margin - 1e-6, `Placa invade a folga superior y=${panel.y}`);
  assert(
    panel.y + panel.height <= 8 - margin + 1e-6,
    `Placa invade a folga inferior y=${panel.y + panel.height}`,
  );
  assert(panel.x >= margin + endClamp - 1e-6, `Placa invade o end clamp esquerdo x=${panel.x}`);
  assert(
    panel.x + panel.width <= 5 - margin - endClamp + 1e-6,
    `Placa invade o end clamp direito x=${panel.x + panel.width}`,
  );
}
const stripMaxY = Math.max(
  ...fillStrip.options[0].placements.map((p) => p.y + p.height),
);

const corridorOff = computeRoofLayouts({
  roofWidthM: 8,
  roofLengthM: 12,
  module: module550,
  edgeMarginM: 0.5,
  endClampM: 0.03,
  corridor: { enabled: false, widthM: 0.6, everyRows: 2 },
});
const corridorOn = computeRoofLayouts({
  roofWidthM: 8,
  roofLengthM: 12,
  module: module550,
  edgeMarginM: 0.5,
  endClampM: 0.03,
  corridor: { enabled: true, widthM: 0.6, everyRows: 2 },
});
assert(
  corridorOff.options[0].panelCount === layouts.options[0].panelCount,
  'Corredor desligado não altera a contagem',
);
assert(
  corridorOn.options[0].panelCount < corridorOff.options[0].panelCount,
  `Corredor deve reduzir placas (${corridorOn.options[0].panelCount} vs ${corridorOff.options[0].panelCount})`,
);
assert(
  (corridorOn.options[0].corridors?.length ?? 0) > 0,
  'Corredor ligado desenha faixas de exclusão',
);
assert(
  corridorOn.usefulAreaM2 < corridorOff.usefulAreaM2,
  'Área útil de instalação desconta o corredor',
);
const bands = corridorOn.options[0].corridors ?? [];
const overlapsCorridor = corridorOn.options[0].placements.some((panel) =>
  bands.some(
    (band) =>
      panel.x < band.x + band.width - 1e-4 &&
      panel.x + panel.width > band.x + 1e-4 &&
      panel.y < band.y + band.height - 1e-4 &&
      panel.y + panel.height > band.y + 1e-4,
  ),
);
assert(!overlapsCorridor, 'Nenhuma placa pode invadir o corredor de manutenção');

const creditError = explainProviderError(
  'openai',
  'You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.',
  429,
);
assert(creditError.includes('sem créditos'), 'Erro de crédito da OpenAI em português');
assert(!creditError.includes('You have no credits'), 'Não repetir o texto cru da OpenAI');
assert(
  explainProviderError('openai', 'Incorrect API key provided', 401).includes('recusou a chave'),
  'Chave inválida em português',
);
const retiredGemini = explainProviderError(
  'gemini',
  'This model models/gemini-2.0-flash is no longer available. Please update your code to use models/gemini-3.8-flash for the latest features and improvements.',
  404,
);
assert(retiredGemini.includes('foi desativado'), retiredGemini);
assert(!retiredGemini.includes('no longer available'), 'Não repetir o texto cru do Gemini');

const leaptonText = `As dimensões e características físicas do módulo fotovoltaico Leapton 630W (LP182210-M-66-NB) são:
Dimensões Físicas do Módulo
Comprimento: 2.382\\text{ mm} (ou 2{,}38\\text{ metros})
Largura: 1.134\\text{ mm} (ou 1{,}13\\text{ metro})
Espessura da Moldura (Perfil): 30\\text{ mm} (ou 3\\text{ cm})
Área Individual da Placa: \\approx 2{,}70\\text{ m}^2 por módulo.
Outros Dados Físicos Relevantes
Peso: 33{,}5\\text{ kg} por módulo.
Estrutura/Moldura: Liga de Alumínio Anodizado.
Vidro: Vidro Duplo Bifacial (Dual Glass) temperado de 2{,}0\\text{ mm}.`;
const leapton = parseModuleDatasheet(leaptonText);
assert(datasheetIsComplete(leapton), 'Ficha Leapton tem potência e medidas');
assert(leapton.manufacturer === 'Leapton', `Fabricante Leapton, veio ${leapton.manufacturer}`);
assert(leapton.model === 'LP182210-M-66-NB', `Modelo LP182210-M-66-NB, veio ${leapton.model}`);
assert(leapton.powerWp === 630, `Potência 630 Wp, veio ${leapton.powerWp}`);
assert(leapton.lengthM === 2.38, `Comprimento 2,38 m, veio ${leapton.lengthM}`);
assert(leapton.widthM === 1.13, `Largura 1,13 m, veio ${leapton.widthM}`);
assert(leapton.thicknessMm === 30, `Espessura 30 mm, veio ${leapton.thicknessMm}`);
assert(almostEqual(leapton.areaM2 ?? 0, 2.7, 0.001), `Área 2,70 m², veio ${leapton.areaM2}`);
assert(almostEqual(leapton.weightKg ?? 0, 33.5, 0.001), `Peso 33,5 kg, veio ${leapton.weightKg}`);
assert(
  (leapton.frame ?? '').includes('Alumínio'),
  `Moldura de alumínio, veio ${leapton.frame}`,
);
assert((leapton.glass ?? '').includes('Bifacial'), `Vidro bifacial, veio ${leapton.glass}`);

const emptyDevice: MergeableBackup = {
  savedAt: '2026-10-10T00:00:00.000Z',
  modules: [],
  roof: null,
  offGrid: null,
  calculation: null,
};
const savedDevice: MergeableBackup = {
  savedAt: '2026-01-01T00:00:00.000Z',
  modules: [
    {
      id: 'custom-leapton',
      manufacturer: 'Leapton',
      model: 'LP182210-M-66-NB',
      powerWp: 630,
      widthM: 1.13,
      lengthM: 2.38,
      areaM2: 2.69,
      isCustom: true,
    },
  ],
  roof: { roofWidthText: '8', roofLengthText: '12', obstacles: [] },
  offGrid: { clientName: 'Casa', currentAText: '20', currentBText: '', currentCText: '' },
  calculation: { input: '450' },
};
const pulled = mergeBackups(emptyDevice, savedDevice);
assert(pulled.modules[0]?.model === 'LP182210-M-66-NB', 'Atualização puxa a placa salva');
assert(pulled.calculation?.input === '450', 'Atualização puxa o consumo');
assert(pulled.roof?.roofWidthText === '8', 'Atualização puxa o telhado');
assert(pulled.offGrid?.clientName === 'Casa', 'Atualização puxa o cliente da carga');
const kept = mergeBackups(savedDevice, {
  ...emptyDevice,
  savedAt: '2026-12-01T00:00:00.000Z',
});
assert(kept.modules.length === 1, 'Cópia vazia mais nova não apaga a placa');

const clients = normalizeSurveyHistory([
  {
    id: 'casa-1',
    savedAt: '2026-01-01T00:00:00.000Z',
    clientName: 'Francisco',
    surveyDate: '01/01/2026',
  },
  { id: '', savedAt: '2026-01-01T00:00:00.000Z', clientName: 'Sem id' },
]);
assert(clients.length === 1 && clients[0]?.clientName === 'Francisco', 'Histórico ignora cadastro sem id');
assert(searchSurveys(clients, 'fran').length === 1, 'Busca encontra Francisco');
assert(searchSurveys(clients, 'ana').length === 0, 'Busca sem o nome não traz cliente');
const renamed = mergeSurveyHistory(clients, [
  { ...clients[0], savedAt: '2026-02-01T00:00:00.000Z', clientName: 'Francisco Souza' },
]);
assert(renamed.length === 1 && renamed[0]?.clientName === 'Francisco Souza', 'Salvar de novo atualiza o mesmo cliente');
assert(mergeSurveyHistory(clients, []).length === 1, 'Lista vazia não apaga os clientes salvos');
assert(searchSurveys(clients, '').length === 1, 'Busca vazia lista todos os clientes');
const joao = normalizeSurveyHistory([
  {
    id: 'joao-1',
    nomeCliente: 'João',
    dataCadastro: '2026-10-15T03:34:03.000Z',
    fases: { A: '20', B: '15', C: '', neutro: '8' },
    cargas: { supply: 'biphasic', utilization: 0.8 },
  },
]);
assert(joao.length === 1 && joao[0]?.clientName === 'João', 'Cadastro estruturado guarda o nome');
assert(joao[0]?.fases.A === '20' && joao[0]?.fases.neutro === '8', 'Cadastro estruturado guarda as fases');
assert(joao[0]?.cargas.supply === 'biphasic', 'Cadastro estruturado guarda a carga');
assert(searchSurveys(joao, 'joao').length === 1, 'Busca por joao encontra João');
assert(searchSurveys(joao, 'JOÃO').length === 1, 'Busca ignora maiúsculas e acento');
assert(searchSurveys([...clients, ...joao], 'maria').length === 0, 'Nome ausente não entra na lista');
assert(removeSurvey([...clients, ...joao], 'joao-1').length === 1, 'Excluir tira só o cliente escolhido');

assert(apkFileName('1.0.42') === 'SolarCalculator-v1.0.42.apk', 'Nome do APK inclui a versão');
assert(apkFileName('1.0.43') === 'SolarCalculator-v1.0.43.apk', 'Nome do APK acompanha a versão nova');
assert(apkFileName('v1.0.43') === 'SolarCalculator-v1.0.43.apk', 'Nome do APK ignora o prefixo v');
assert(apkFileName('1.0.44') === 'SolarCalculator-v1.0.44.apk', 'APK 1.0.44 leva a versão no nome');
assert(apkReleaseTag('1.0.44') === 'v1.0.44', 'Tag de release é v1.0.44');
{
  const pkg = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../package.json'), 'utf8'),
  ) as { version: string };
  assert(
    apkFileName(pkg.version) === `SolarCalculator-v${pkg.version}.apk`,
    'Nome do APK lê a versão do package.json',
  );
}

assert(ROOT_BACKUP_FOLDER === 'Calculadora Solar/Backups', 'Pasta dos backups em Documentos');
assert(
  ROOT_BACKUP_DISPLAY === 'Meus Documentos/Calculadora Solar/Backups',
  'Caminho mostrado ao usuário',
);
assert(!shouldShowClientLookup(false, ''), 'Lista de clientes fechada antes do toque');
assert(shouldShowClientLookup(true, ''), 'Toque na busca abre a lista');
assert(shouldShowClientLookup(false, 'Lu'), 'Digitar o nome abre a lista');
assert(!shouldShowClientLookup(false, '   '), 'Espaço vazio não abre a lista');
assert(
  startupRestoreMode({ activeHasData: true, folderBackupFound: false }) === 'silent',
  'Banco ativo abre direto',
);
assert(
  startupRestoreMode({ activeHasData: false, folderBackupFound: true }) === 'silent',
  'Arquivo na pasta raiz abre direto',
);
assert(
  startupRestoreMode({ activeHasData: false, folderBackupFound: false }) === 'reception',
  'Instalação limpa mostra a recepção',
);
assert(shouldMigrateExistingData(false, true), 'Dados antigos geram cópia na pasta nova');
assert(!shouldMigrateExistingData(true, true), 'Migração já feita não repete a cópia de origem');
assert(!shouldMigrateExistingData(false, false), 'Instalação vazia não cria arquivo de migração');
assert(
  migrationFileName(new Date(2026, 9, 15, 14, 3, 7)) ===
    'solar-calculator-backup-migracao-2026-10-15-140307.json',
  'Nome da cópia de migração',
);
assert(safeBackupFileName('../solar-calculator-backup.json') === 'solar-calculator-backup.json', 'Nome de arquivo sem pasta');
const older = '{"savedAt":"2026-01-01T00:00:00.000Z","modules":[{"id":"a"}]}';
const newer = '{"savedAt":"2026-06-01T00:00:00.000Z","modules":[{"id":"b"}]}';
const picked = newestBackupRaw([older, '{"savedAt":"2026-08-01T00:00:00.000Z","modules":[]}', newer], (raw) => {
  const parsed = JSON.parse(raw) as { savedAt: string; modules: unknown[] };
  return { savedAt: parsed.savedAt, hasData: parsed.modules.length > 0 };
});
assert(picked === newer, 'Autodiscovery escolhe o backup mais recente com dados');

console.log('✅ Self-test de cálculos OK');
console.log(
  `   Layout 8×12 m / 550 Wp: máx ${layouts.options[0].panelCount} placas (${layouts.options[0].orientationSummary})`,
);
console.log(
  `   Polígono L + chaminé: máx ${polyLayouts.options[0].panelCount} placas · área ${polyLayouts.totalRoofAreaM2} m²`,
);
console.log(
  `   Layout 5×8 m / folga 0,1: máx ${fillStrip.options[0].panelCount} placas (${fillStrip.options[0].orientationSummary}) · base y=${stripMaxY}`,
);
console.log(
  `   Corredor 8×12 a cada 2 fileiras: ${corridorOn.options[0].panelCount} placas (livre ${corridorOff.options[0].panelCount}) · útil ${corridorOn.usefulAreaM2} m²`,
);

const offGridBase: OffGridLoadInput = {
  supply: 'biphasic',
  monoVoltage: 127,
  triPair: '127_220',
  currentA: 20,
  currentB: 15,
  currentC: 40,
  currentNeutral: 8,
  utilizationFactor: 0.8,
  acOutput: 'mono220',
  busVoltageV: 48,
  autonomyHours: 12,
  useDod: true,
  dod: 0.8,
  batteryModelId: 'li-48-100',
  inverterEfficiency: 0.92,
};
assert(validateOffGridInput(offGridBase) === null, 'Entrada off-grid de referência é válida');
const offGrid = calculateOffGridLoad(offGridBase);
assert(almostEqual(offGrid.power127W, 8 * 127), 'P127 = Ineutro × Vfn');
assert(almostEqual(offGrid.powerTotalW, (20 + 15) * 127), 'Ptotal bifásico ignora fase C');
assert(almostEqual(offGrid.power220W, offGrid.powerTotalW - offGrid.power127W), 'P220 = Ptotal − P127');
assert(offGrid.voltageFn === 127 && offGrid.voltageFf === 220, 'Bifásico trava 127/220 V');
assert(almostEqual(offGrid.currentInverterA, lineCurrent220A(offGrid.powerTotalW)), 'Saída 220 V: I = Ptotal / (220 × FP)');
assert(offGrid.powerFactor === 1, 'FP unitário na saída 220 V');
assert(offGrid.outputBreakerA === 32 && offGrid.conductorMm2 === 4 && offGrid.conductorCount === 2, 'Monofásico 220 V: disjuntor 32 A e cabo 4 mm²');
assert(
  describeOutputCurrent(offGridBase, offGrid) === 'Inversor Monofásico 220V: 20,2 A (Ptotal / (220 × FP))',
  describeOutputCurrent(offGridBase, offGrid),
);
assert(offGrid.transformerStatus === 'required', 'Bifásico com saída 220 V monofásica exige autotransformador');
assert(almostEqual(offGrid.inverterMinW, offGrid.powerTotalW / 0.8), 'Pinv = Ptotal / FU');
assert(offGrid.inverterSuggestedKw === 8, `Inversor comercial esperado 8 kW, veio ${offGrid.inverterSuggestedKw}`);
assert(almostEqual(offGrid.transformerW, offGrid.power127W / 0.7), 'Trafo com 30% de folga');
assert(offGrid.transformerSuggestedKva === 1.5, `Trafo comercial esperado 1,5 kVA, veio ${offGrid.transformerSuggestedKva}`);
const energyWh = (offGrid.powerTotalW * 12) / 0.92;
assert(almostEqual(offGrid.energyWh, energyWh, 0.02), 'Energia Wh com eficiência');
assert(almostEqual(offGrid.batteryGrossWh, energyWh / 0.8, 0.05), 'Banco corrige DoD');
assert(almostEqual(offGrid.capacityAh, energyWh / 0.8 / 48, 0.05), 'Ah no barramento 48 V');
assert(offGrid.bank.model.energyWh === 4800, 'Módulo lítio 48 V 100 Ah = 4,8 kWh');
assert(offGrid.bank.series === 1, 'Lítio 48 V no barramento 48 V fica em paralelo');
assert(offGrid.bank.parallel === 16, `Módulos lítio esperados 16, veio ${offGrid.bank.parallel}`);
assert(offGrid.bank.total === 16, 'Total de módulos = ramos em paralelo');
assert(offGrid.bank.branchWh === 4800, 'Ramo de um módulo 48 V = 4800 Wh');
assert(
  almostEqual(offGrid.bank.installedGrossWh, 16 * 4800, 0.1),
  'Capacidade bruta instalada',
);
assert(
  almostEqual(offGrid.bank.installedUsefulWh, 16 * 4800 * 0.8, 0.1),
  'Capacidade útil entregue com DoD 80%',
);
assert(offGrid.dodApplied === 0.8, 'DoD aplicado 80%');
assert(offGrid.bank.headline.startsWith('16x Módulos de Lítio 48V 100Ah'), offGrid.bank.headline);

const noDod = calculateOffGridLoad({ ...offGridBase, useDod: false });
assert(almostEqual(noDod.batteryGrossWh, energyWh, 0.02), 'Sem DoD a capacidade bruta é a energia útil');
assert(noDod.dodApplied === null, 'DoD ignorado');

const balancedVector = calcularCorrentesLinhaTrifasico({ I_RS: 10, I_ST: 10, I_TR: 10 });
assert(balancedVector.I_R === 17.32 && balancedVector.I_S === 17.32 && balancedVector.I_T === 17.32, 'Ramos iguais: linha = √3 × ramo');
assert(balancedVector.I_Max === 17.32, 'Imax dos ramos iguais');
const asymmetric = calcularCorrentesLinhaTrifasico({ I_RS: 0, I_ST: 10, I_TR: 4 });
assert(asymmetric.I_R === 4, 'Fase R só enxerga o ramo TR');
assert(asymmetric.I_S === 10, 'Fase S só enxerga o ramo ST');
assert(asymmetric.I_T === 12.49, `Fase T usa I_ST×I_TR, veio ${asymmetric.I_T}`);
assert(asymmetric.I_Max === 12.49, 'Imax é a maior linha');
const singleBranch = calcularCorrentesLinhaTrifasico({ I_RS: 10, I_ST: 0, I_TR: 0 });
assert(singleBranch.I_R === 10 && singleBranch.I_S === 10 && singleBranch.I_T === 0, 'Um ramo entre R e S carrega só essas fases');
assert(calcularCorrentesLinhaTrifasico({ I_RS: -3, I_ST: Number.NaN, I_TR: 0 }).I_Max === 0, 'Corrente inválida não entra na soma');

const tri = calculateOffGridLoad({ ...offGridBase, supply: 'triphasic' });
assert(almostEqual(tri.powerTotalW, (20 + 15 + 40) * 127), 'Ptotal trifásico soma fase C');
assert(tri.measuredLine.I_R === 20 && tri.measuredLine.I_S === 15 && tri.measuredLine.I_T === 40, 'Alicate trifásico guarda R, S e T');
assert(tri.measuredLine.I_Max === 40, 'Imax medido é a fase mais carregada');
const vectorTri = calcularCorrentesLinhaTrifasico({ I_RS: 20, I_ST: 15, I_TR: 40 });
assert(
  tri.phasePhaseVector.I_R === vectorTri.I_R && tri.phasePhaseVector.I_Max === vectorTri.I_Max,
  'Saída trifásica usa a soma vetorial das fases medidas',
);
assert(!tri.sizedByLinePeak, 'Saída monofásica não infla o inversor pelo Imax');
assert(describeTopologyComparison(tri).includes('Monofásico 220 V'), describeTopologyComparison(tri));
assert(describeLinePeak(tri).includes('Imax medido 40'), describeLinePeak(tri));

const triUnbalanced = calculateOffGridLoad({ ...offGridBase, supply: 'triphasic', acOutput: 'triphasic' });
assert(almostEqual(triUnbalanced.currentInverterA, vectorTri.I_Max), 'Saída trifásica usa o Imax vetorial');
assert(triUnbalanced.sizedByLinePeak, 'Desbalanceamento eleva o inversor trifásico');
assert(
  almostEqual(triUnbalanced.inverterMinW, (3 * vectorTri.I_Max * 127) / 0.8),
  'Pinv trifásico cobre 3 × Imax × Vfn',
);
assert(triUnbalanced.inverterSuggestedKw === 30, `Inversor do pico esperado 30 kW, veio ${triUnbalanced.inverterSuggestedKw}`);
assert(triUnbalanced.conductorCount === 3, 'Saída trifásica pede 3 condutores');
assert(
  triUnbalanced.conductorMm2 === recommendedConductorMm2(triUnbalanced.outputBreakerA, 3),
  'Bitola cobre o disjuntor trifásico',
);
assert(
  almostEqual(triUnbalanced.energyWh, triUnbalanced.powerTotalW * 12 / 0.92, 0.05),
  'A energia do banco continua na potência real',
);
const triBalanced = calculateOffGridLoad({
  ...offGridBase,
  supply: 'triphasic',
  acOutput: 'triphasic',
  currentA: 10,
  currentB: 10,
  currentC: 10,
  currentNeutral: 0,
});
assert(triBalanced.sizedByLinePeak, 'Ramos iguais ainda geram linha √3 vezes maior');
assert(
  almostEqual(triBalanced.currentInverterA, calcularCorrentesLinhaTrifasico({ I_RS: 10, I_ST: 10, I_TR: 10 }).I_Max),
  'Trifásico equilibrado: Imax é a linha vetorial',
);
assert(tri.transformerStatus === 'required', 'Trifásico com saída 220 V monofásica exige autotransformador');
const tri380 = calculateOffGridLoad({ ...offGridBase, supply: 'triphasic', triPair: '220_380' });
assert(tri380.voltageFn === 220 && tri380.voltageFf === 380, 'Trifásico 220/380 usa essas tensões');
assert(almostEqual(tri380.powerTotalW, (20 + 15 + 40) * 220), 'Ptotal no padrão 220/380 usa Vfn 220');
assert(almostEqual(tri380.power127W, 8 * 220), 'Parcela do neutro no 220/380 é Ineutro × 220');
const zeroNeutral = calculateOffGridLoad({ ...offGridBase, currentNeutral: 0 });
assert(zeroNeutral.transformerStatus === 'required', 'Card do trafo permanece obrigatório com neutro zerado');
assert(zeroNeutral.transformerSuggestedKva === 0, 'Sem corrente de neutro o trafo calculado é 0 kVA');
const mono127 = calculateOffGridLoad({
  ...offGridBase,
  supply: 'mono',
  monoVoltage: 127,
  currentA: 10,
  currentB: 99,
  currentNeutral: 50,
});
assert(almostEqual(mono127.powerTotalW, 10 * 127), 'Monofásico 127 V usa só a fase A');
assert(mono127.power220W === 0, 'Monofásico 127 V não inventa carga 220 V');
assert(mono127.transformerStatus === 'not_applicable', 'Padrão monofásico dispensa o card do trafo');
const mono220 = calculateOffGridLoad({ ...offGridBase, supply: 'mono', monoVoltage: 220, currentA: 10 });
assert(almostEqual(mono220.powerTotalW, 10 * 220), 'Monofásico 220 V multiplica a fase A por 220');
assert(mono220.power127W === 0, 'Monofásico 220 V não inventa carga 127 V');
assert(mono220.transformerStatus === 'not_applicable', 'Saída monofásica com rede monofásica não pede trafo');

const stationary48 = calculateOffGridLoad({
  ...offGridBase,
  batteryModelId: 'st-12-240',
  busVoltageV: 48,
});
assert(stationary48.bank.model.energyWh === 2880, 'Estacionária 12 V 240 Ah = 2,88 kWh');
assert(stationary48.bank.series === 4, '48 V pede 4 baterias de 12 V em série');
assert(stationary48.bank.branchWh === 12 * 4 * 240, 'Ramo 48 V = 12 V × 4 × 240 Ah');
assert(
  stationary48.bank.parallel === Math.ceil((energyWh / 0.8) / stationary48.bank.branchWh - 1e-9),
  'Ramos em paralelo arredondam para cima',
);
assert(
  stationary48.bank.total === stationary48.bank.series * stationary48.bank.parallel,
  'Total = série × paralelo',
);
assert(stationary48.bank.wiring.includes('SÉRIE'), stationary48.bank.wiring);
assert(stationary48.bank.wiring.includes('PARALELO'), stationary48.bank.wiring);

const stationary24 = calculateOffGridLoad({
  ...offGridBase,
  batteryModelId: 'st-12-150',
  busVoltageV: 24,
  useDod: false,
});
assert(stationary24.bank.model.energyWh === 1800, 'Estacionária 12 V 150 Ah = 1,8 kWh');
assert(stationary24.bank.series === 2, '24 V pede 2 baterias de 12 V em série');
assert(stationary24.bank.branchWh === 1800 * 2, 'Ramo 24 V com 150 Ah');
assert(stationary24.bank.wiring.includes('SÉRIE'), stationary24.bank.wiring);
assert(stationary24.dodApplied === null, 'DoD ignorado na estacionária');

const lithium24on48 = calculateOffGridLoad({
  ...offGridBase,
  batteryModelId: 'li-24-100',
  busVoltageV: 48,
});
assert(lithium24on48.bank.series === 2, 'Dois módulos de 24 V em série no barramento de 48 V');
assert(lithium24on48.bank.branchWh === 4800, 'Ramo de dois módulos de 24 V = 4800 Wh');
assert(
  lithium24on48.bank.total === lithium24on48.bank.series * lithium24on48.bank.parallel,
  'Total de módulos 24 V',
);

const incompatible = calculateOffGridLoad({
  ...offGridBase,
  batteryModelId: 'li-48-100',
  busVoltageV: 24,
});
assert(!incompatible.bank.compatible, 'Módulo 48 V não fecha em barramento 24 V');

assert(
  validateOffGridInput({ ...offGridBase, dod: 0.65 }) !== null,
  'DoD de lítio abaixo de 70% é inválido',
);
assert(
  validateOffGridInput({ ...offGridBase, batteryModelId: 'st-12-240', dod: 0.5 }) === null,
  'DoD 50% é válido na estacionária',
);
assert(
  validateOffGridInput({ ...offGridBase, batteryModelId: 'st-12-240', dod: 0.2 }) !== null,
  'DoD de estacionária abaixo de 30% é inválido',
);

const inconsistent = calculateOffGridLoad({ ...offGridBase, currentNeutral: 80, currentA: 5, currentB: 5 });
assert(inconsistent.neutralInconsistent, 'Neutro acima das fases deve alertar');
assert(inconsistent.power220W === 0, 'Carga 220 V não fica negativa');

assert(nextCommercialSize(12, [3, 5, 8, 10, 12]) === 12, 'Porte exato não sobe de faixa');
assert(validateOffGridInput({ ...offGridBase, currentA: 0, currentB: 0 }) !== null, 'Sem corrente de fase é inválido');

const reportMeta: OffGridReportMeta = {
  clientName: 'João da Silva',
  location: 'Manaus/AM',
  surveyDate: '07/10/2026',
};
assert(
  offGridReportFileName('João da Silva', '07/10/2026') === 'Relatorio_OffGrid_Joao_da_Silva_2026-10-07.pdf',
  offGridReportFileName('João da Silva', '07/10/2026'),
);
assert(
  offGridReportFileName('  Casa  nº 12  ', '7/1/2026') === 'Relatorio_OffGrid_Casa_n_12_2026-01-07.pdf',
  offGridReportFileName('  Casa  nº 12  ', '7/1/2026'),
);
assert(recommendedAcBreakerA(20.2) === 32, `Disjuntor de 20,2 A esperado 32 A, veio ${recommendedAcBreakerA(20.2)}`);
assert(
  describeArrangementGuide(offGrid).includes('16 ramos em paralelo com 1 módulo em série'),
  describeArrangementGuide(offGrid),
);
const report = buildOffGridReportHtml(offGridBase, offGrid, reportMeta);
assert(report.includes('INVERSOR OFF-GRID 8 kW'), 'Relatório destaca o inversor');
assert(report.includes('BANCO DE BATERIAS: 16x Módulos de Lítio 48V 100Ah'), 'Relatório destaca o banco');
assert(report.includes('EQUIPAMENTO PRINCIPAL SELECIONADO'), 'Badge do inversor');
assert(report.includes('ARMAZENAMENTO DE ENERGIA (BACKUP)'), 'Badge das baterias');
assert(report.includes('João da Silva'), 'Relatório cita o cliente');
assert(report.includes('Manaus/AM'), 'Relatório cita a localidade');
assert(report.includes('07/10/2026'), 'Relatório cita a data');
assert(report.includes('Bifásico'), 'Relatório cita o padrão da rede');
assert(report.includes('80% de uso (20% de folga técnica)'), 'Relatório explica o fator de utilização');
assert(report.includes('Inversor Monofásico 220V: 20,2 A'), 'Relatório repete a corrente da saída monofásica');
assert(report.includes('4 mm²'), 'Relatório cita a bitola do condutor');
assert(report.includes('Disjuntor CA Recomendado: 32 A'), 'Relatório recomenda o disjuntor');
assert(report.includes('Arranjo:'), 'Relatório traz o guia de arranjo');
assert(report.includes(FIELD_HELP.neutral), 'Relatório inclui a explicação do neutro');
assert(report.includes(FIELD_HELP.mono220), 'Relatório inclui a ajuda da saída 220V');
assert(report.includes(FIELD_HELP.supplyBi), 'Relatório inclui a ajuda do padrão bifásico');
assert(report.includes('AUTOTRANSFORMADOR DE APOIO 127V/220V: 1,5 kVA'), 'Relatório cita o trafo quando a interseção exige');
assert(report.includes('Desenvolvido via Calculadora Solar — Diagnóstico Eletrotécnico'), 'Rodapé da calculadora');
assert(report.includes('Página 1 de 1'), 'Rodapé da página');
assert(report.includes('Documento Técnico para Fins de Dimensionamento'), 'Rodapé do documento');
assert(report.includes('break-inside: avoid'), 'Cards não quebram no meio da página');
assert(report.includes('#1E3A8A'), 'Cabeçalhos em azul navy');
assert(report.includes('#059669'), 'Destaque verde do inversor');
assert(report.includes('#4F46E5'), 'Destaque indigo das baterias');
const split = calculateOffGridLoad({ ...offGridBase, acOutput: 'split_phase' });
assert(split.transformerStatus === 'native_neutral', 'Bifásico nativo dispensa autotransformador');
assert(split.transformerSuggestedKva === 0, 'Sem kVA de trafo na saída bifásica');
assert(
  almostEqual(split.currentInverterA, lineCurrent220A(split.powerTotalW)),
  'Bifásico 220 V: I = Ptotal / (220 × FP)',
);
assert(split.conductorCount === 2 && split.outputBreakerA === offGrid.outputBreakerA, 'Bifásico 220 V usa o mesmo disjuntor da corrente de linha');
assert(
  describeOutputCurrent({ ...offGridBase, acOutput: 'split_phase' }, split) ===
    'Inversor Bifásico 220V: 20,2 A (Ptotal / (220 × FP))',
  describeOutputCurrent({ ...offGridBase, acOutput: 'split_phase' }, split),
);
const splitReport = buildOffGridReportHtml({ ...offGridBase, acOutput: 'split_phase' }, split, reportMeta);
assert(splitReport.includes(FIELD_HELP.nativeNeutral), 'PDF repete o aviso de neutro nativo');
const triOut = calculateOffGridLoad({ ...offGridBase, acOutput: 'triphasic' });
assert(triOut.transformerStatus === 'native_neutral', 'Trifásico nativo dispensa autotransformador');
const vectorBi = calcularCorrentesLinhaTrifasico({ I_RS: 20, I_ST: 15, I_TR: 0 });
assert(almostEqual(triOut.currentInverterA, vectorBi.I_Max), 'Trifásico na medição bifásica usa o Imax vetorial');
assert(triOut.inverterSuggestedKw !== offGrid.inverterSuggestedKw, 'Trocar para trifásico muda o porte do inversor');
assert(
  describeOutputCurrent({ ...offGridBase, acOutput: 'triphasic' }, triOut).includes('Inversor Trifásico'),
  describeOutputCurrent({ ...offGridBase, acOutput: 'triphasic' }, triOut),
);
const tri380Out = calculateOffGridLoad({
  ...offGridBase,
  supply: 'triphasic',
  triPair: '220_380',
  acOutput: 'triphasic',
});
assert(almostEqual(tri380Out.topology.triphasicA, vectorTri.I_Max), '220/380 trifásico publica o Imax vetorial');
assert(almostEqual(tri380Out.currentInverterA, vectorTri.I_Max), 'Trifásico 220/380 entrega o Imax vetorial');
assert(tri380Out.sizedByLinePeak, '220/380 desbalanceado eleva o inversor pelo Imax');
const monoOut = calculateOffGridLoad({ ...offGridBase, supply: 'mono', monoVoltage: 127, currentA: 8, acOutput: 'split_phase' });
assert(monoOut.transformerStatus === 'native_neutral', 'Saída com neutro nativo avisa mesmo no padrão monofásico');
console.log(
  `   Off-grid 20+15 A / neutro 8 A: ${offGrid.inverterSuggestedKw} kW · ${offGrid.bank.headline}`,
);
