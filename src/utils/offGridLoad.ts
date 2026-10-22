/**
 * Levantamento de carga (alicate) e dimensionamento off-grid / retrofit.
 * Potências em W, tensões em V, correntes em A, energia em Wh.
 *
 * As leituras A/B/C são correntes de linha já medidas no condutor.
 * A potência usa a soma aritmética dessas leituras (Σ I_linha × V_FN).
 * A soma vetorial entra só na carga fase-fase, quando os ramos RS/ST/TR
 * são conhecidos, e o I_Max medido cobre o desbalanceamento na saída trifásica.
 */
import {
  calcularCorrentesLinhaTrifasico,
  correntesLinhaMedidas,
  type CorrenteLinhaResult,
} from './threePhaseCurrents';

export type BatteryTech = 'lithium' | 'stationary';
export type BatteryModelId = 'li-48-100' | 'li-24-100' | 'st-12-240' | 'st-12-150';
export type BusVoltageV = 24 | 48;
/** Padrão da rede medida no quadro (entrada). Independente da saída do inversor. */
export type SupplyStandard = 'mono' | 'biphasic' | 'triphasic';
export type MonoVoltage = 127 | 220;
/** Par fase-neutro / fase-fase do padrão trifásico. */
export type TriVoltagePair = '127_220' | '220_380';
/** Topologia da saída AC que alimenta o quadro da casa. */
export type AcOutputTopology = 'mono220' | 'split_phase' | 'triphasic';
/**
 * required: rede bi/trifásica e saída 220 V monofásica — trafo de apoio.
 * native_neutral: saída bifásica ou trifásica nativa — dispensa trafo.
 * not_applicable: padrão monofásico — não há carga 127 V separada pelo neutro.
 */
export type TransformerStatus = 'required' | 'native_neutral' | 'not_applicable';

/** Portes comerciais de inversor off-grid (kW), do menor para o maior. */
export const COMMERCIAL_INVERTER_KW = [3, 5, 8, 10, 12, 15, 20, 25, 30, 40, 50] as const;

/** Portes comerciais de autotransformador (kVA). */
export const COMMERCIAL_TRAFO_KVA = [1, 1.5, 2, 3, 5, 7.5, 10, 15, 20, 30, 45, 75] as const;

/** Disjuntores CA comerciais (A), do menor para o maior. */
export const AC_BREAKER_A = [6, 10, 16, 20, 25, 32, 40, 50, 63, 70, 80, 100, 125, 150, 160, 200, 250] as const;

/** Fator de potência da saída em 220 V. Unitário até haver medição de FP. */
export const OUTPUT_POWER_FACTOR = 1;

/**
 * Ampacidade de cobre PVC 70 °C, método B1 (NBR 5410).
 * 2 condutores: monofásico ou bifásico em 220 V. 3 condutores: trifásico.
 */
export const COPPER_PVC_AMPACITY: Record<2 | 3, readonly { mm2: number; amps: number }[]> = {
  2: [
    { mm2: 1.5, amps: 17.5 },
    { mm2: 2.5, amps: 24 },
    { mm2: 4, amps: 32 },
    { mm2: 6, amps: 41 },
    { mm2: 10, amps: 57 },
    { mm2: 16, amps: 76 },
    { mm2: 25, amps: 101 },
    { mm2: 35, amps: 125 },
    { mm2: 50, amps: 151 },
    { mm2: 70, amps: 192 },
    { mm2: 95, amps: 232 },
    { mm2: 120, amps: 269 },
    { mm2: 150, amps: 309 },
    { mm2: 185, amps: 353 },
    { mm2: 240, amps: 415 },
  ],
  3: [
    { mm2: 1.5, amps: 15.5 },
    { mm2: 2.5, amps: 21 },
    { mm2: 4, amps: 28 },
    { mm2: 6, amps: 36 },
    { mm2: 10, amps: 50 },
    { mm2: 16, amps: 68 },
    { mm2: 25, amps: 89 },
    { mm2: 35, amps: 110 },
    { mm2: 50, amps: 134 },
    { mm2: 70, amps: 171 },
    { mm2: 95, amps: 207 },
    { mm2: 120, amps: 239 },
    { mm2: 150, amps: 275 },
    { mm2: 185, amps: 314 },
    { mm2: 240, amps: 370 },
  ],
};

/** Folga de 30% no trafo: P_trafo = P_127 / 0,70. */
export const TRAFO_LOAD_FACTOR = 0.7;

export type BatteryModel = {
  id: BatteryModelId;
  tech: BatteryTech;
  voltageV: number;
  capacityAh: number;
  energyWh: number;
  /** Nome comercial completo. */
  name: string;
  /** Rótulo curto do seletor. */
  shortLabel: string;
  cycles: number;
};

/** Catálogo de estoque: lítio 48 V/24 V e estacionárias 12 V. */
export const BATTERY_MODELS: readonly BatteryModel[] = [
  {
    id: 'li-48-100',
    tech: 'lithium',
    voltageV: 48,
    capacityAh: 100,
    energyWh: 4800,
    name: 'Módulo Lítio 48V 100Ah',
    shortLabel: '48V 100Ah',
    cycles: 6000,
  },
  {
    id: 'li-24-100',
    tech: 'lithium',
    voltageV: 24,
    capacityAh: 100,
    energyWh: 2400,
    name: 'Módulo Lítio 24V 100Ah',
    shortLabel: '24V 100Ah',
    cycles: 6000,
  },
  {
    id: 'st-12-240',
    tech: 'stationary',
    voltageV: 12,
    capacityAh: 240,
    energyWh: 2880,
    name: 'Bateria Estacionária 12V 240Ah',
    shortLabel: '12V 240Ah',
    cycles: 600,
  },
  {
    id: 'st-12-150',
    tech: 'stationary',
    voltageV: 12,
    capacityAh: 150,
    energyWh: 1800,
    name: 'Bateria Estacionária 12V 150Ah',
    shortLabel: '12V 150Ah',
    cycles: 600,
  },
];

/** Faixa de DoD permitida e o valor sugerido de cada tecnologia. */
export const DOD_RANGE: Record<BatteryTech, { min: number; max: number; default: number }> = {
  lithium: { min: 0.7, max: 0.9, default: 0.8 },
  stationary: { min: 0.3, max: 0.6, default: 0.5 },
};

export function batteryModelById(id: BatteryModelId): BatteryModel {
  const model = BATTERY_MODELS.find((item) => item.id === id);
  if (!model) {
    throw new Error(`Modelo de bateria desconhecido: ${id}`);
  }
  return model;
}

export function modelsForTech(tech: BatteryTech): BatteryModel[] {
  return BATTERY_MODELS.filter((item) => item.tech === tech);
}

export type BatteryArrangement = {
  model: BatteryModel;
  compatible: boolean;
  series: number;
  parallel: number;
  total: number;
  /** Energia de um ramo em série (Wh). */
  branchWh: number;
  /** Energia bruta pedida antes de arredondar os ramos. */
  requiredGrossWh: number;
  /** Energia bruta do banco já arredondado. */
  installedGrossWh: number;
  /** Energia útil que o banco instalado entrega com o DoD deste arranjo. */
  installedUsefulWh: number;
  dodApplied: number | null;
  headline: string;
  wiring: string;
};

export type OffGridLoadInput = {
  supply: SupplyStandard;
  /** Usada quando supply é monofásico. */
  monoVoltage: MonoVoltage;
  /** Usada quando supply é trifásico. */
  triPair: TriVoltagePair;
  currentA: number;
  currentB: number;
  currentC: number;
  currentNeutral: number;
  /** 0,60 a 0,90. */
  utilizationFactor: number;
  acOutput: AcOutputTopology;
  busVoltageV: BusVoltageV;
  autonomyHours: number;
  useDod: boolean;
  /** Fração 0–1. Ignorado quando useDod é falso. */
  dod: number;
  batteryModelId: BatteryModelId;
  /** Fração 0–1 (ex.: 0,92). */
  inverterEfficiency: number;
};

export type OffGridLoadResult = {
  voltageFn: number;
  voltageFf: number;
  /** Parcela fase-neutro (127 V no padrão residencial; 220 V no trifásico 220/380). */
  power127W: number;
  powerTotalW: number;
  /** Parcela fase-fase (220 V ou 380 V). */
  power220W: number;
  share127: number;
  share220: number;
  currentInverterA: number;
  inverterMinW: number;
  inverterSuggestedKw: number;
  utilizationFactor: number;
  surgeMarginTight: boolean;
  transformerStatus: TransformerStatus;
  transformerW: number;
  transformerSuggestedKva: number;
  energyWh: number;
  batteryGrossWh: number;
  capacityAh: number;
  /** null quando o DoD foi ignorado. */
  dodApplied: number | null;
  bank: BatteryArrangement;
  comparison: {
    lithium: BatteryArrangement;
    stationary: BatteryArrangement;
  };
  neutralInconsistent: boolean;
  /** Alicate nas fases R, S e T. I_Max é o maior valor medido. */
  measuredLine: CorrenteLinhaResult;
  /**
   * I_R, I_S e I_T pela soma vetorial das correntes de fase
   * (I_RS = fase A, I_ST = fase B, I_TR = fase C).
   */
  phasePhaseVector: CorrenteLinhaResult;
  /** Mesma potência total nas três topologias de saída. */
  topology: {
    mono220A: number;
    splitPhaseA: number;
    triphasicA: number;
  };
  /**
   * Saída trifásica: a potência sobe para cada fase entregar o Imax vetorial.
   */
  sizedByLinePeak: boolean;
  /** FP usado em I = Ptotal / (220 × FP). */
  powerFactor: number;
  /** Disjuntor da saída, acima de 125% da corrente nominal. */
  outputBreakerA: number;
  /** Bitola de cobre PVC que suporta o disjuntor. */
  conductorMm2: number;
  /** 2 na saída 220 V monofásica/bifásica; 3 na saída trifásica. */
  conductorCount: 2 | 3;
};

export function nextCommercialSize(value: number, steps: readonly number[]): number {
  if (!Number.isFinite(value) || value <= 1e-9) return 0;
  for (const step of steps) {
    if (value <= step + 1e-9) return step;
  }
  const last = steps[steps.length - 1];
  const increment = last >= 10 ? 5 : 1;
  return Math.ceil((value - 1e-9) / increment) * increment;
}

/**
 * Corrente de linha em 220 V: I = Ptotal / (220 × FP).
 * Vale para a saída monofásica e para a bifásica em 220 V.
 */
export function lineCurrent220A(powerW: number, powerFactor = OUTPUT_POWER_FACTOR): number {
  if (!(powerW > 0) || !(powerFactor > 0)) return 0;
  return powerW / (220 * powerFactor);
}

/** Corrente nominal que a topologia de saída precisa entregar. */
export function nominalOutputCurrentA(
  powerW: number,
  acOutput: AcOutputTopology,
  voltageFn: number,
): number {
  if (!(powerW > 0)) return 0;
  if (acOutput === 'triphasic') {
    const phaseVoltage = voltageFn > 0 ? voltageFn : 127;
    return powerW / (3 * phaseVoltage);
  }
  return lineCurrent220A(powerW);
}

/**
 * Disjuntor CA imediatamente acima de 125% da corrente nominal de saída.
 * A folga acompanha o fator de ocupação típico de 80%.
 */
export function recommendedAcBreakerA(currentA: number): number {
  if (!(currentA > 0)) return 0;
  return nextCommercialSize(currentA * 1.25, AC_BREAKER_A);
}

/** Menor seção de cobre PVC cuja ampacidade cobre a corrente de projeto. */
export function recommendedConductorMm2(designA: number, loadedConductors: 2 | 3): number {
  if (!(designA > 0)) return 0;
  const table = COPPER_PVC_AMPACITY[loadedConductors];
  for (const row of table) {
    if (designA <= row.amps + 1e-9) return row.mm2;
  }
  return table[table.length - 1].mm2;
}

function ceilCount(total: number, unit: number): number {
  if (!Number.isFinite(total) || total <= 1e-9 || unit <= 0) return 0;
  return Math.ceil(total / unit - 1e-9);
}

function unitWord(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * Fecha série/paralelo de um modelo no barramento.
 * N_série = V_barramento / V_módulo (inteiro).
 * C_ramo = energia do módulo × N_série.
 * N_paralelo = ceil(E_bruta / C_ramo).
 */
export function arrangeBatteryBank(params: {
  model: BatteryModel;
  busVoltageV: BusVoltageV;
  requiredGrossWh: number;
  dodApplied: number | null;
}): BatteryArrangement {
  const { model, busVoltageV, requiredGrossWh, dodApplied } = params;
  const seriesExact = busVoltageV / model.voltageV;
  const compatible = seriesExact >= 1 && Math.abs(seriesExact - Math.round(seriesExact)) < 1e-9;
  const series = compatible ? Math.round(seriesExact) : 0;
  const branchWh = compatible ? model.energyWh * series : 0;
  const parallel = compatible ? ceilCount(requiredGrossWh, branchWh) : 0;
  const total = series * parallel;
  const installedGrossWh = parallel * branchWh;
  const installedUsefulWh =
    dodApplied && dodApplied > 0 ? installedGrossWh * dodApplied : installedGrossWh;
  const feminine = model.tech === 'stationary';
  const piece = feminine
    ? unitWord(total, 'Bateria Estacionária', 'Baterias Estacionárias')
    : unitWord(total, 'Módulo de Lítio', 'Módulos de Lítio');
  const volts = `${model.voltageV}V ${model.capacityAh}Ah`;
  const branchNote =
    series > 1 && parallel > 1
      ? ` (${parallel} ${unitWord(parallel, 'ramo', 'ramos')} de ${series} em série)`
      : '';
  const noun = feminine ? 'baterias' : 'módulos';
  const oneNoun = feminine ? 'bateria' : 'módulo';
  const linked = (count: number) =>
    feminine ? (count === 1 ? 'ligada' : 'ligadas') : count === 1 ? 'ligado' : 'ligados';

  let wiring = `O ${oneNoun} de ${model.voltageV} V não fecha no barramento de ${busVoltageV} V.`;
  if (compatible && series === 1) {
    wiring = `${total} ${unitWord(total, oneNoun, noun)} de ${volts} ${linked(total)} em PARALELO`;
  } else if (compatible && parallel <= 1) {
    wiring = `${series} ${unitWord(series, oneNoun, noun)} de ${volts} ${linked(series)} em SÉRIE`;
  } else if (compatible) {
    wiring = `${series} ${noun} em SÉRIE por ramo, com ${parallel} ramos em PARALELO`;
  }

  return {
    model,
    compatible,
    series,
    parallel,
    total,
    branchWh,
    requiredGrossWh,
    installedGrossWh,
    installedUsefulWh,
    dodApplied,
    headline: compatible ? `${total}x ${piece} ${volts}${branchNote}` : 'Arranjo incompatível com o barramento',
    wiring,
  };
}

function lithiumModelForBus(busVoltageV: BusVoltageV): BatteryModel {
  return batteryModelById(busVoltageV === 48 ? 'li-48-100' : 'li-24-100');
}

/** Tensões nominais do padrão escolhido. A medição não pede V livre. */
export function supplyVoltages(input: Pick<OffGridLoadInput, 'supply' | 'monoVoltage' | 'triPair'>): {
  voltageFn: number;
  voltageFf: number;
} {
  if (input.supply === 'mono') {
    const voltage = input.monoVoltage === 220 ? 220 : 127;
    return { voltageFn: voltage, voltageFf: voltage };
  }
  if (input.supply === 'triphasic' && input.triPair === '220_380') {
    return { voltageFn: 220, voltageFf: 380 };
  }
  return { voltageFn: 127, voltageFf: 220 };
}

export function validateOffGridInput(input: OffGridLoadInput): string | null {
  if (input.supply === 'mono' && input.monoVoltage !== 127 && input.monoVoltage !== 220) {
    return 'Selecione a tensão do padrão monofásico: 127 V ou 220 V.';
  }
  const currents =
    input.supply === 'mono'
      ? [input.currentA]
      : input.supply === 'triphasic'
        ? [input.currentA, input.currentB, input.currentC, input.currentNeutral]
        : [input.currentA, input.currentB, input.currentNeutral];
  if (currents.some((c) => !Number.isFinite(c) || c < 0)) {
    return 'As correntes medidas não podem ser negativas.';
  }
  const phaseSum =
    input.supply === 'mono'
      ? input.currentA
      : input.currentA + input.currentB + (input.supply === 'triphasic' ? input.currentC : 0);
  if (phaseSum <= 0) return 'Informe ao menos uma corrente de fase maior que zero.';
  if (input.utilizationFactor < 0.6 - 1e-9 || input.utilizationFactor > 0.9 + 1e-9) {
    return 'O fator de ocupação deve ficar entre 60% e 90%.';
  }
  if (!(input.autonomyHours > 0)) return 'Informe a autonomia desejada.';
  if (!(input.inverterEfficiency > 0) || input.inverterEfficiency > 1) {
    return 'A eficiência do inversor deve estar entre 1% e 100%.';
  }
  if (input.useDod) {
    const range = DOD_RANGE[batteryModelById(input.batteryModelId).tech];
    const minPct = Math.round(range.min * 100);
    const maxPct = Math.round(range.max * 100);
    if (!(input.dod >= range.min - 1e-9) || input.dod > range.max + 1e-9) {
      const techLabel = range === DOD_RANGE.lithium ? 'lítio' : 'estacionária';
      return `O DoD de ${techLabel} deve ficar entre ${minPct}% e ${maxPct}%.`;
    }
  }
  if (input.busVoltageV !== 24 && input.busVoltageV !== 48) {
    return 'O barramento CC deve ser 24 V ou 48 V.';
  }
  return null;
}

/**
 * Separa carga 127 V (pelo neutro) e 220 V, dimensiona inversor, trafo e banco.
 * P_127 = I_neutro × V_FN
 * P_total = (Σ I_linha medidas) × V_FN
 * P_220 = P_total − P_127
 * Saída monofásica ou bifásica 220 V: I = P_total / (220 × FP)
 * Saída trifásica: I_R, I_S e I_T pela soma vetorial das correntes de fase,
 *   Imax = max(I_R, I_S, I_T) e P_inv cobre 3 × Imax × V_FN.
 * P_inv = P_demanda / FU
 * E_Wh = P_total × horas / η_inv  (energia real, sem inflar pelo pico)
 */
export function calculateOffGridLoad(input: OffGridLoadInput): OffGridLoadResult {
  const { voltageFn, voltageFf } = supplyVoltages(input);
  const currentA = Math.max(0, input.currentA);
  const currentB = input.supply === 'mono' ? 0 : Math.max(0, input.currentB);
  const currentC = input.supply === 'triphasic' ? Math.max(0, input.currentC) : 0;
  const currentNeutral = input.supply === 'mono' ? 0 : Math.max(0, input.currentNeutral);
  const phaseSum = currentA + currentB + currentC;

  let power127W: number;
  let powerTotalW: number;
  let power220W: number;
  let neutralInconsistent: boolean;
  if (input.supply === 'mono') {
    powerTotalW = currentA * voltageFn;
    power127W = input.monoVoltage === 127 ? powerTotalW : 0;
    power220W = input.monoVoltage === 220 ? powerTotalW : 0;
    neutralInconsistent = false;
  } else {
    power127W = currentNeutral * voltageFn;
    powerTotalW = phaseSum * voltageFn;
    const raw220 = powerTotalW - power127W;
    neutralInconsistent = raw220 < -1e-6;
    power220W = Math.max(0, raw220);
  }
  const chart127 = Math.min(Math.max(0, power127W), powerTotalW);
  const share127 = powerTotalW > 0 ? chart127 / powerTotalW : 0;
  const share220 = powerTotalW > 0 ? 1 - share127 : 0;

  const measuredLine = correntesLinhaMedidas({
    I_R: currentA,
    I_S: currentB,
    I_T: currentC,
  });
  const phasePhaseVector = calcularCorrentesLinhaTrifasico({
    I_RS: currentA,
    I_ST: currentB,
    I_TR: currentC,
  });
  const line220A = lineCurrent220A(powerTotalW, OUTPUT_POWER_FACTOR);
  const topology = {
    mono220A: line220A,
    splitPhaseA: line220A,
    triphasicA: phasePhaseVector.I_Max,
  };

  const triOutput = input.acOutput === 'triphasic';
  const peakDemandW = 3 * phasePhaseVector.I_Max * voltageFn;
  const sizedByLinePeak = triOutput && peakDemandW > powerTotalW + 1e-6;
  const demandW = triOutput ? Math.max(powerTotalW, peakDemandW) : powerTotalW;
  const currentInverterA = triOutput ? phasePhaseVector.I_Max : line220A;
  const inverterMinW = input.utilizationFactor > 0 ? demandW / input.utilizationFactor : 0;
  const outputBreakerA = recommendedAcBreakerA(currentInverterA);
  const conductorCount: 2 | 3 = triOutput ? 3 : 2;
  const conductorMm2 = recommendedConductorMm2(outputBreakerA, conductorCount);
  const inverterSuggestedKw = nextCommercialSize(inverterMinW / 1000, COMMERCIAL_INVERTER_KW);

  const hasNeutralSplit = input.supply === 'biphasic' || input.supply === 'triphasic';
  const nativeNeutral = input.acOutput === 'split_phase' || input.acOutput === 'triphasic';
  const transformerW = power127W / TRAFO_LOAD_FACTOR;
  let transformerStatus: TransformerStatus = 'not_applicable';
  if (nativeNeutral) transformerStatus = 'native_neutral';
  else if (hasNeutralSplit && input.acOutput === 'mono220') transformerStatus = 'required';
  const transformerSuggestedKva =
    transformerStatus === 'required'
      ? nextCommercialSize(transformerW / 1000, COMMERCIAL_TRAFO_KVA)
      : 0;

  const energyWh =
    input.inverterEfficiency > 0
      ? (powerTotalW * input.autonomyHours) / input.inverterEfficiency
      : 0;
  const selectedModel = batteryModelById(input.batteryModelId);
  const dodApplied = input.useDod ? input.dod : null;
  const batteryGrossWh = dodApplied && dodApplied > 0 ? energyWh / dodApplied : energyWh;
  const capacityAh = input.busVoltageV > 0 ? batteryGrossWh / input.busVoltageV : 0;

  const arrangeWith = (model: BatteryModel, grossWh: number, dod: number | null) =>
    arrangeBatteryBank({
      model,
      busVoltageV: input.busVoltageV,
      requiredGrossWh: grossWh,
      dodApplied: dod,
    });

  const bank = arrangeWith(selectedModel, batteryGrossWh, dodApplied);
  const lithiumModel =
    selectedModel.tech === 'lithium' ? selectedModel : lithiumModelForBus(input.busVoltageV);
  const stationaryModel =
    selectedModel.tech === 'stationary' ? selectedModel : batteryModelById('st-12-240');
  const grossFor = (model: BatteryModel, dod: number | null) =>
    model.id === selectedModel.id ? batteryGrossWh : dod && dod > 0 ? energyWh / dod : energyWh;
  const dodFor = (model: BatteryModel) =>
    model.id === selectedModel.id ? dodApplied : DOD_RANGE[model.tech].default;

  return {
    voltageFn,
    voltageFf,
    power127W,
    powerTotalW,
    power220W,
    share127,
    share220,
    currentInverterA,
    inverterMinW,
    inverterSuggestedKw,
    utilizationFactor: input.utilizationFactor,
    surgeMarginTight: input.utilizationFactor >= 0.85 - 1e-9,
    transformerStatus,
    transformerW,
    transformerSuggestedKva,
    energyWh,
    batteryGrossWh,
    capacityAh,
    dodApplied,
    bank,
    comparison: {
      lithium: arrangeWith(lithiumModel, grossFor(lithiumModel, dodFor(lithiumModel)), dodFor(lithiumModel)),
      stationary: arrangeWith(
        stationaryModel,
        grossFor(stationaryModel, dodFor(stationaryModel)),
        dodFor(stationaryModel),
      ),
    },
    neutralInconsistent,
    measuredLine,
    phasePhaseVector,
    topology,
    sizedByLinePeak,
    powerFactor: OUTPUT_POWER_FACTOR,
    outputBreakerA,
    conductorMm2,
    conductorCount,
  };
}
