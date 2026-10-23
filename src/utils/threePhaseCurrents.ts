/**
 * Correntes de linha a partir de cargas ligadas entre fases.
 *
 * As tensões do sistema estão defasadas 120°. No mesmo terminal, as duas
 * correntes de ramo (por exemplo R→S e R→T) formam 60° entre si.
 * |I| = √(I₁² + I₂² + I₁·I₂) = √(I₁² + I₂² + 2·I₁·I₂·cos 60°).
 * I_Max é a maior corrente de linha e define condutor, disjuntor e a fase
 * mais carregada do inversor.
 */

export interface CargasFases {
  /** Corrente total entre as fases R e S (A). */
  I_RS: number;
  /** Corrente total entre as fases S e T (A). */
  I_ST: number;
  /** Corrente total entre as fases T e R (A). */
  I_TR: number;
}

export interface CorrenteLinhaResult {
  /** Corrente resultante na fase R (A). */
  I_R: number;
  /** Corrente resultante na fase S (A). */
  I_S: number;
  /** Corrente resultante na fase T (A). */
  I_T: number;
  /** Maior corrente de linha (base para dimensionamento). */
  I_Max: number;
}

function branchCurrent(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

export function calcularCorrentesLinhaTrifasico(cargas: CargasFases): CorrenteLinhaResult {
  const I_RS = branchCurrent(cargas.I_RS);
  const I_ST = branchCurrent(cargas.I_ST);
  const I_TR = branchCurrent(cargas.I_TR);

  const I_R = Math.sqrt(I_RS ** 2 + I_TR ** 2 + I_RS * I_TR);
  const I_S = Math.sqrt(I_RS ** 2 + I_ST ** 2 + I_RS * I_ST);
  // O termo cruzado de T é I_ST × I_TR, simétrico a R (I_RS × I_TR) e S (I_RS × I_ST).
  const I_T = Math.sqrt(I_ST ** 2 + I_TR ** 2 + I_ST * I_TR);
  const I_Max = Math.max(I_R, I_S, I_T);

  return {
    I_R: round2(I_R),
    I_S: round2(I_S),
    I_T: round2(I_T),
    I_Max: round2(I_Max),
  };
}

/** Correntes já lidas no alicate, nos condutores de linha. I_Max é o pico medido. */
export function correntesLinhaMedidas(phases: {
  I_R: number;
  I_S: number;
  I_T: number;
}): CorrenteLinhaResult {
  const I_R = round2(branchCurrent(phases.I_R));
  const I_S = round2(branchCurrent(phases.I_S));
  const I_T = round2(branchCurrent(phases.I_T));
  return {
    I_R,
    I_S,
    I_T,
    I_Max: round2(Math.max(I_R, I_S, I_T)),
  };
}
