import {
  DAILY_TO_KWP_FACTOR,
  DAYS_PER_MONTH,
  DEFAULT_AREA_MARGIN,
  INVERTER_FDI_MAX,
  INVERTER_FDI_MIN,
  KWH_PER_KWP_MONTH,
  MONTHLY_TO_KWP_DIVISOR,
} from '../constants/modules';
import {
  ConsumptionDailyResult,
  ConsumptionMonthlyResult,
  MaintenanceCorridorConfig,
  RoofDirectResult,
  RoofInverseResult,
  SolarModule,
} from '../types';
import { minimumRoofForQuantity } from './roofLayout';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeModuleArea(lengthM: number, widthM: number): number {
  return round2(lengthM * widthM);
}

export function suggestInverterRange(powerKwp: number): {
  inverterMinKw: number;
  inverterMaxKw: number;
} {
  // Potência do inversor ≈ potência do sistema / FDI
  // FDI 1.15–1.30 → inversor entre power/1.30 e power/1.15
  return {
    inverterMinKw: round2(powerKwp / INVERTER_FDI_MAX),
    inverterMaxKw: round2(powerKwp / INVERTER_FDI_MIN),
  };
}

/**
 * A partir da potência necessária (kWp) e do módulo escolhido:
 * Qtd = ceil(kWp * 1000 / Wp da placa).
 * A área necessária é o menor telhado que comporta essa quantidade
 * com a mesma folga, os mesmos grampos e o mesmo corredor do Layout 2D.
 */
export function calculateModulesForPower(
  requiredPowerKwp: number,
  module: SolarModule,
  spacing?: {
    edgeMarginM?: number;
    endClampM?: number;
    corridor?: MaintenanceCorridorConfig | null;
  },
): {
  module: SolarModule;
  requiredPowerKwp: number;
  quantity: number;
  installedPowerKwp: number;
  grossAreaM2: number;
  requiredInstallAreaM2: number;
  roofWidthM: number;
  roofLengthM: number;
  layoutPanelCount: number;
  layoutPowerKwp: number;
  layoutUsefulAreaM2: number;
  orientationSummary: string;
  inverterMinKw: number;
  inverterMaxKw: number;
} {
  const requiredWp = requiredPowerKwp * 1000;
  const quantity = Math.max(1, Math.ceil(requiredWp / module.powerWp));
  const installedPowerKwp = round2((quantity * module.powerWp) / 1000);
  const grossAreaM2 = round2(quantity * module.areaM2);
  const fit = minimumRoofForQuantity({
    module,
    quantity,
    edgeMarginM: spacing?.edgeMarginM,
    endClampM: spacing?.endClampM,
    corridor: spacing?.corridor,
  });
  const inverter = suggestInverterRange(installedPowerKwp);
  return {
    module,
    requiredPowerKwp,
    quantity,
    installedPowerKwp,
    grossAreaM2,
    requiredInstallAreaM2: fit?.totalRoofAreaM2 ?? 0,
    roofWidthM: fit?.roofWidthM ?? 0,
    roofLengthM: fit?.roofLengthM ?? 0,
    layoutPanelCount: fit?.panelCount ?? 0,
    layoutPowerKwp: fit?.totalPowerKwp ?? 0,
    layoutUsefulAreaM2: fit?.usefulAreaM2 ?? 0,
    orientationSummary: fit?.orientationSummary ?? 'Sem placas',
    ...inverter,
  };
}

export function calculateFromMonthly(monthlyKwh: number): ConsumptionMonthlyResult {
  const dailyKwh = round2(monthlyKwh / DAYS_PER_MONTH);
  const powerKwp = round2(monthlyKwh / MONTHLY_TO_KWP_DIVISOR);
  const inverter = suggestInverterRange(powerKwp);
  return {
    monthlyKwh,
    dailyKwh,
    powerKwp,
    ...inverter,
  };
}

export function calculateFromDaily(dailyKwh: number): ConsumptionDailyResult {
  const monthlyKwh = round2(dailyKwh * DAYS_PER_MONTH);
  const powerKwp = round2(dailyKwh / DAILY_TO_KWP_FACTOR);
  const inverter = suggestInverterRange(powerKwp);
  return {
    dailyKwh,
    monthlyKwh,
    powerKwp,
    ...inverter,
  };
}

export function calculateRoofDirect(
  quantity: number,
  module: SolarModule,
  safetyMargin: number = DEFAULT_AREA_MARGIN,
): RoofDirectResult {
  const grossAreaM2 = round2(quantity * module.areaM2);
  const recommendedAreaM2 = round2(grossAreaM2 * (1 + safetyMargin));
  const totalPowerKwp = round2((quantity * module.powerWp) / 1000);
  return {
    quantity,
    module,
    grossAreaM2,
    safetyMargin,
    recommendedAreaM2,
    totalPowerKwp,
  };
}

export function calculateRoofInverse(
  roofAreaM2: number,
  module: SolarModule,
  discountMargin: number = DEFAULT_AREA_MARGIN,
): RoofInverseResult {
  const usefulAreaM2 = round2(roofAreaM2 * (1 - discountMargin));
  const maxModules = Math.floor(usefulAreaM2 / module.areaM2);
  const maxPowerKwp = round2((maxModules * module.powerWp) / 1000);
  const estimatedMonthlyGenerationKwh = round2(maxPowerKwp * KWH_PER_KWP_MONTH);
  return {
    roofAreaM2,
    module,
    discountMargin,
    usefulAreaM2,
    maxModules: Math.max(0, maxModules),
    maxPowerKwp: Math.max(0, maxPowerKwp),
    estimatedMonthlyGenerationKwh: Math.max(0, estimatedMonthlyGenerationKwh),
  };
}

export function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function parseLocaleNumber(text: string): number {
  const normalized = text.replace(/\s/g, '').replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : NaN;
}
