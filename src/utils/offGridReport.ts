import { formatNumber } from './calculations';
import {
  AcOutputTopology,
  batteryModelById,
  BatteryTech,
  OffGridLoadInput,
  OffGridLoadResult,
  recommendedAcBreakerA,
  SupplyStandard,
  supplyVoltages,
} from './offGridLoad';

export type OffGridReportMeta = {
  clientName: string;
  location: string;
  /** Data exibida, em geral DD/MM/AAAA. */
  surveyDate: string;
};

/** Textos de apoio exibidos na tela e repetidos no PDF. */
export const FIELD_HELP = {
  neutral:
    'A corrente medida no Neutro indica a parcela de carga operando exclusivamente em 127V na residência.',
  utilization:
    'Fator de ocupação: fração da potência do inversor que pode trabalhar em regime contínuo. 80% deixa 20% de folga para picos, temperatura e partida de motores.',
  dod:
    'Profundidade de descarga: parcela da capacidade que pode ser usada. Lítio LiFePO4 fica entre 70% e 90% (padrão 80%). Estacionária fica entre 30% e 60% (padrão 50%). Desligado, o cálculo usa 100% da capacidade nominal.',
  inverterIntro:
    'Defina como o inversor entregará a energia para o quadro de distribuição e como se conecta à rede/bypass.',
  mono220:
    'Saída em 220V com 2 fios. Requer Autotransformador externo para atender circuitos de 127V.',
  splitPhase:
    'Saída em 127V/220V com 3 fios. Alimenta tomadas 127V e cargas 220V diretamente sem Autotransformador.',
  triphasic:
    'Saída industrial/comercial (380V/220V ou 220V/127V). Atende motores e quadros trifásicos.',
  lithiumBadge: 'Alta durabilidade / Menor espaço',
  stationaryBadge: 'Custo inicial reduzido',
  supplyMono:
    'Um condutor de fase e o neutro. Informe só a corrente da fase A e a tensão da rede (127 V ou 220 V).',
  supplyBi:
    'Duas fases e o neutro em 127 V/220 V. A corrente do neutro separa a carga de 127 V da carga de 220 V.',
  supplyTri:
    'Três fases e o neutro. 127 V/220 V no padrão residencial ou 220 V/380 V no padrão industrial.',
  nativeNeutral: 'Topologia com Neutro Nativo. Dispensa Autotransformador.',
} as const;

export function supplyTitle(supply: SupplyStandard): string {
  if (supply === 'mono') return 'Monofásico Fase + Neutro (127V ou 220V)';
  if (supply === 'biphasic') return 'Bifásico Fase + Fase + Neutro (127V/220V)';
  return 'Trifásico 3 Fases + Neutro (127V/220V ou 220V/380V)';
}

export function supplyHelp(supply: SupplyStandard): string {
  if (supply === 'mono') return FIELD_HELP.supplyMono;
  if (supply === 'biphasic') return FIELD_HELP.supplyBi;
  return FIELD_HELP.supplyTri;
}

export function acOutputTag(output: AcOutputTopology): string {
  if (output === 'mono220') return 'Saída AC: 220V Monofásica';
  if (output === 'split_phase') return 'Saída AC: Bifásica Nativa (127V/220V)';
  return 'Saída AC: Trifásica Nativa (3F+N)';
}

export function acOutputTitle(output: AcOutputTopology): string {
  if (output === 'mono220') return 'Saída 220V Monofásica (Fase + Neutro)';
  if (output === 'split_phase') return 'Saída Bifásica Nativa (Split-Phase: Fase A + Fase B + Neutro)';
  return 'Saída Trifásica Nativa (3 Fases + Neutro)';
}

/** Rótulos da rosca. No trifásico 220/380 a parcela do neutro é 220 V, não 127 V. */
export function loadSplitLabels(input: OffGridLoadInput): { low: string; high: string } {
  const { voltageFn, voltageFf } = supplyVoltages(input);
  if (input.supply === 'triphasic' && input.triPair === '220_380') {
    return { low: `${voltageFn} V (F-N)`, high: `${voltageFf} V (F-F)` };
  }
  return { low: '127 V', high: '220 V' };
}

export function dodConsideredLabel(tech: BatteryTech, dodPercent: number, useDod: boolean): string {
  if (!useDod) return 'DoD ignorado: 100% da capacidade bruta';
  const name = tech === 'lithium' ? 'Lítio' : 'Estacionária';
  return `DoD Considerado: ${formatNumber(dodPercent, 0)}% (${name})`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function kw(watts: number): string {
  return `${formatNumber(watts / 1000)} kW`;
}

function pct(fraction: number): string {
  return `${formatNumber(fraction * 100, 1)}%`;
}

/** Frase do card de resultados, também repetida no PDF. */
export function describeOutputCurrent(input: OffGridLoadInput, result: OffGridLoadResult): string {
  const amps = formatNumber(result.currentInverterA);
  if (input.acOutput === 'triphasic') {
    return `Corrente Nominal de Saída: ${amps} A por Fase (Trifásico)`;
  }
  if (input.acOutput === 'split_phase') {
    return `Corrente Nominal de Saída: ${amps} A por Fase (127V/220V)`;
  }
  return `Corrente Nominal de Saída: ${amps} A (Monofásico 220V)`;
}

export function describeTransformer(result: OffGridLoadResult): string {
  if (result.transformerStatus === 'native_neutral') return FIELD_HELP.nativeNeutral;
  if (result.transformerStatus === 'not_applicable') {
    return 'Padrão monofásico: a carga inteira está na tensão selecionada. Autotransformador de apoio não se aplica.';
  }
  const loadName = result.voltageFn === 127 ? '127V' : `${formatNumber(result.voltageFn, 0)}V fase-neutro`;
  return `Potência do Trafo: ${formatNumber(result.transformerSuggestedKva)} kVA (Para atender a carga ${loadName} de ${kw(result.power127W)})`;
}

/** Guia rápido de ligação do banco instalado. */
export function describeAssembly(result: OffGridLoadResult): string {
  const bank = result.bank;
  if (!bank.compatible) return bank.wiring;
  const many = bank.model.tech === 'lithium' ? 'módulos' : 'baterias';
  const one = bank.model.tech === 'lithium' ? 'módulo' : 'bateria';
  const noun = bank.total === 1 ? one : many;
  if (bank.series <= 1) {
    return `Montagem: ${bank.total} ${noun} no total (ligação em paralelo)`;
  }
  const seriesNoun = bank.series === 1 ? one : many;
  const branches = bank.parallel === 1 ? 'ramo' : 'ramos';
  return `Montagem: ${bank.total} ${noun} no total (${bank.parallel} ${branches} de ${bank.series} ${seriesNoun} em série)`;
}

export function describeBatteryBank(_input: OffGridLoadInput, result: OffGridLoadResult): string {
  if (!result.bank.compatible) return result.bank.wiring;
  return `${result.bank.headline}. ${result.bank.wiring}.`;
}

export function describeDod(result: OffGridLoadResult): string {
  if (result.dodApplied == null) return 'Capacidade bruta máx. / DoD ignorado';
  return `${formatNumber(result.dodApplied * 100, 0)}% DoD aplicado`;
}

export function supplyShort(supply: SupplyStandard): string {
  if (supply === 'mono') return 'Monofásico';
  if (supply === 'biphasic') return 'Bifásico';
  return 'Trifásico';
}

export function outputTopologyShort(output: AcOutputTopology): string {
  if (output === 'mono220') return '220V Monofásico';
  if (output === 'split_phase') return 'Bifásico Nativo';
  return 'Trifásico';
}

/** Valor da corrente, sem o prefixo da frase do card. */
export function outputCurrentValue(input: OffGridLoadInput, result: OffGridLoadResult): string {
  return describeOutputCurrent(input, result).replace(/^Corrente Nominal de Saída:\s*/, '');
}

export function utilizationLine(factor: number): string {
  const use = Math.round(factor * 100);
  const margin = Math.max(0, 100 - use);
  return `${use}% de uso (${margin}% de folga técnica)`;
}

/** Guia do PDF: ramos em paralelo e peças em série por ramo. */
export function describeArrangementGuide(result: OffGridLoadResult): string {
  const bank = result.bank;
  if (!bank.compatible) return bank.wiring;
  const seriesNoun =
    bank.model.tech === 'lithium'
      ? bank.series === 1
        ? 'módulo'
        : 'módulos'
      : bank.series === 1
        ? 'bateria'
        : 'baterias';
  const branches = bank.parallel === 1 ? 'ramo' : 'ramos';
  return `Arranjo: ${bank.parallel} ${branches} em paralelo com ${bank.series} ${seriesNoun} em série por ramo`;
}

function slugFilePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function fileDate(surveyDate: string): string {
  const match = surveyDate.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  const digits = surveyDate.replace(/[^\d]/g, '');
  return digits || 'sem_data';
}

/** Relatorio_OffGrid_[Nome]_[Data].pdf, sem acentos e com underline. */
export function offGridReportFileName(clientName: string, surveyDate: string): string {
  const client = slugFilePart(clientName.trim()) || 'Cliente';
  return `Relatorio_OffGrid_${client}_${fileDate(surveyDate)}.pdf`;
}

/** HTML da proposta técnica de dimensionamento off-grid. */
export function buildOffGridReportHtml(
  input: OffGridLoadInput,
  result: OffGridLoadResult,
  meta: OffGridReportMeta,
): string {
  const { voltageFn, voltageFf } = supplyVoltages(input);
  const split = loadSplitLabels(input);
  const model = batteryModelById(input.batteryModelId);
  const tech = model.tech === 'lithium' ? 'Lítio (LiFePO4)' : 'Estacionária (Chumbo-Ácido)';
  const clientName = meta.clientName.trim() || 'Cliente não informado';
  const location = meta.location.trim() || '—';
  const surveyDate = meta.surveyDate.trim() || '—';
  const breakerA = recommendedAcBreakerA(result.currentInverterA);
  const outputHelp =
    input.acOutput === 'mono220'
      ? FIELD_HELP.mono220
      : input.acOutput === 'split_phase'
        ? FIELD_HELP.splitPhase
        : FIELD_HELP.triphasic;
  const usefulKwh = formatNumber(result.bank.installedUsefulWh / 1000);
  const dodNote =
    result.dodApplied == null
      ? `${formatNumber(result.bank.installedGrossWh / 1000)} kWh (DoD ignorado)`
      : `${usefulKwh} kWh (com DoD de ${formatNumber(result.dodApplied * 100, 0)}%)`;
  const lowShare =
    split.low === '127 V'
      ? `Parcela em 127V`
      : `Parcela em ${split.low}`;
  const highShare =
    split.high === '220 V'
      ? `Parcela em 220V`
      : `Parcela em ${split.high}`;
  const showTransformer = result.transformerStatus === 'required' && result.power127W > 1e-6;
  const trafoTitle = result.voltageFn === 127
    ? `AUTOTRANSFORMADOR DE APOIO 127V/220V: ${formatNumber(result.transformerSuggestedKva)} kVA`
    : `AUTOTRANSFORMADOR DE APOIO: ${formatNumber(result.transformerSuggestedKva)} kVA`;
  const trafoDetail = `Atende a carga monofásica de ${kw(result.power127W)}.`;

  const measureRows: Array<[string, string, string]> = [
    ['Tensão fase-neutro', `${formatNumber(voltageFn, 0)} V`, '—'],
    ['Tensão fase-fase', `${formatNumber(voltageFf, 0)} V`, '—'],
    ['Fase A', `${formatNumber(Math.max(0, input.currentA))} A`, kw(Math.max(0, input.currentA) * voltageFn)],
  ];
  if (input.supply !== 'mono') {
    measureRows.push([
      'Fase B',
      `${formatNumber(Math.max(0, input.currentB))} A`,
      kw(Math.max(0, input.currentB) * voltageFn),
    ]);
  }
  if (input.supply === 'triphasic') {
    measureRows.push([
      'Fase C',
      `${formatNumber(Math.max(0, input.currentC))} A`,
      kw(Math.max(0, input.currentC) * voltageFn),
    ]);
    measureRows.push([
      'Neutro',
      `${formatNumber(Math.max(0, input.currentNeutral))} A`,
      kw(result.power127W),
    ]);
  } else if (input.supply === 'biphasic') {
    measureRows.push([
      'Neutro',
      `${formatNumber(Math.max(0, input.currentNeutral))} A`,
      kw(result.power127W),
    ]);
  }

  const table = measureRows
    .map(
      ([parameter, reading, power]) =>
        `<tr><td>${esc(parameter)}</td><td>${esc(reading)}</td><td>${esc(power)}</td></tr>`,
    )
    .join('');

  const warning = result.neutralInconsistent
    ? '<p class="note warn">A corrente de neutro supera a soma das fases. Revise a medição antes de fechar a proposta.</p>'
    : '';
  const nativeNotice =
    result.transformerStatus === 'native_neutral'
      ? `<p class="note ok">${esc(FIELD_HELP.nativeNeutral)}</p>`
      : '';
  const neutralNote =
    input.supply === 'mono'
      ? ''
      : `<p class="caption">${esc(FIELD_HELP.neutral)}</p>`;
  const transformerCard = showTransformer
    ? `<section class="callout trafo">
        <div class="badge">PERIFÉRICO CONDICIONAL</div>
        <h3>${esc(trafoTitle)}</h3>
        <p>${esc(trafoDetail)}</p>
      </section>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${esc(offGridReportFileName(meta.clientName, meta.surveyDate).replace(/\.pdf$/, ''))}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: Inter, Roboto, Helvetica, Arial, sans-serif;
      color: #0F172A;
      font-size: 10pt;
      line-height: 1.4;
    }
    .page { min-height: 100vh; display: flex; flex-direction: column; }
    .content { flex: 1 0 auto; }
    .topbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand strong { display: block; color: #1E3A8A; font-size: 12pt; letter-spacing: 0.4px; }
    .brand span { display: block; color: #64748B; font-size: 9pt; }
    .tag {
      color: #1E3A8A;
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 0.4px;
      text-align: right;
      text-transform: uppercase;
      max-width: 58%;
    }
    .rule { height: 2px; background: #1E3A8A; margin: 10px 0 14px; }
    h2 { color: #1E3A8A; font-size: 16pt; margin: 16px 0 8px; }
    h3 { margin: 4px 0 0; font-size: 14pt; letter-spacing: 0.2px; }
    .card, .callout, .mini {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .card { padding: 12px 14px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; }
    .field .label { color: #64748B; font-size: 9pt; }
    .field .value { color: #0F172A; font-size: 10pt; font-weight: 650; font-weight: 600; }
    table.measure { width: 100%; border-collapse: collapse; margin-top: 4px; }
    table.measure th {
      text-align: left;
      color: #1E3A8A;
      font-size: 10pt;
      font-weight: 700;
      background: #F8FAFC;
      padding: 8px 10px;
      border-bottom: 1px solid #E2E8F0;
    }
    table.measure td {
      font-size: 10pt;
      padding: 7px 10px;
      border-bottom: 1px solid #E2E8F0;
    }
    table.measure tr:nth-child(even) td { background: #F8FAFC; }
    table.measure td:nth-child(2), table.measure td:nth-child(3),
    table.measure th:nth-child(2), table.measure th:nth-child(3) { text-align: right; }
    .caption, .note { font-size: 9pt; color: #475569; margin: 8px 0 0; }
    .minis { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 12px; }
    .mini { padding: 10px 12px; }
    .mini .label { color: #64748B; font-size: 9pt; }
    .mini .value { color: #1E3A8A; font-size: 13pt; font-weight: 700; margin-top: 2px; }
    .mini .sub { color: #334155; font-size: 10pt; }
    .callout { padding: 14px 16px; margin-top: 12px; border-left-width: 5px; }
    .callout.inverter { border-left-color: #059669; }
    .callout.inverter h3 { color: #059669; }
    .callout.battery { border-left-color: #4F46E5; }
    .callout.battery h3 { color: #4F46E5; }
    .callout.trafo { border-left-color: #D97706; }
    .callout.trafo h3 { color: #92400E; font-size: 12pt; }
    .badge {
      display: inline-block;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #1E3A8A;
      background: #E0E7FF;
      border-radius: 999px;
      padding: 3px 8px;
    }
    .callout.inverter .badge { color: #065F46; background: #D1FAE5; }
    .callout.battery .badge { color: #3730A3; background: #E0E7FF; }
    .callout.trafo .badge { color: #92400E; background: #FEF3C7; }
    .spec { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; margin-top: 12px; }
    .spec .label { color: #64748B; font-size: 9pt; }
    .spec .value { color: #0F172A; font-size: 10pt; font-weight: 600; }
    .note.warn { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 8px 10px; }
    .note.ok { background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 8px 10px; color: #065F46; }
    .footer {
      margin-top: auto;
      padding-top: 14px;
      display: flex;
      justify-content: space-between;
      gap: 8px;
      border-top: 2px solid #1E3A8A;
      color: #1E3A8A;
      font-size: 8pt;
      font-weight: 600;
    }
    .footer span:nth-child(2) { text-align: center; }
    .footer span:last-child { text-align: right; }
  </style>
</head>
<body>
  <div class="page">
    <div class="content">
      <header class="topbar">
        <div class="brand">
          <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#1E3A8A"/>
            <circle cx="16" cy="16" r="5.5" fill="#F8FAFC"/>
            <path d="M16 4.5v3.2M16 24.3V27.5M4.5 16h3.2M24.3 16H27.5M7.8 7.8l2.2 2.2M22 22l2.2 2.2M7.8 24.2 10 22M22 10l2.2-2.2" stroke="#059669" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
          <div>
            <strong>SOLAR CALCULATOR</strong>
            <span>Proposta técnica de engenharia</span>
          </div>
        </div>
        <div class="tag">Relatório técnico de dimensionamento off-grid</div>
      </header>
      <div class="rule"></div>

      <section class="card">
        <div class="grid2">
          <div class="field"><div class="label">Cliente</div><div class="value">${esc(clientName)}</div></div>
          <div class="field"><div class="label">Localidade</div><div class="value">${esc(location)}</div></div>
          <div class="field"><div class="label">Data de Emissão</div><div class="value">${esc(surveyDate)}</div></div>
          <div class="field"><div class="label">Padrão da Rede Medida</div><div class="value">${esc(supplyShort(input.supply))}</div></div>
        </div>
        <p class="caption">${esc(supplyTitle(input.supply))}. ${esc(supplyHelp(input.supply))}</p>
      </section>

      <h2>1. Diagnóstico de carga e medições de campo</h2>
      ${warning}
      <table class="measure">
        <thead>
          <tr>
            <th>Condutor / Parâmetro</th>
            <th>Leitura Medida (A / V)</th>
            <th>Potência Atribuída (kW)</th>
          </tr>
        </thead>
        <tbody>${table}</tbody>
      </table>
      ${neutralNote}
      <div class="minis">
        <div class="mini">
          <div class="label">Carga Total Medida (kW)</div>
          <div class="value">${esc(formatNumber(result.powerTotalW / 1000))}</div>
        </div>
        <div class="mini">
          <div class="label">${esc(lowShare)}</div>
          <div class="value">${esc(formatNumber(result.power127W / 1000))}</div>
          <div class="sub">${esc(pct(result.share127))}</div>
        </div>
        <div class="mini">
          <div class="label">${esc(highShare)}</div>
          <div class="value">${esc(formatNumber(result.power220W / 1000))}</div>
          <div class="sub">${esc(pct(result.share220))}</div>
        </div>
      </div>

      <h2>2. Destaques executivos</h2>
      <section class="callout inverter">
        <div class="badge">EQUIPAMENTO PRINCIPAL SELECIONADO</div>
        <h3>INVERSOR OFF-GRID ${esc(formatNumber(result.inverterSuggestedKw))} kW</h3>
        <div class="spec">
          <div><div class="label">Topologia de Saída</div><div class="value">${esc(outputTopologyShort(input.acOutput))}</div></div>
          <div><div class="label">Fator de Utilização Aplicado</div><div class="value">${esc(utilizationLine(result.utilizationFactor))}</div></div>
          <div><div class="label">Corrente Nominal de Saída</div><div class="value">${esc(outputCurrentValue(input, result))}</div></div>
          <div><div class="label">Orientação de Proteção</div><div class="value">Disjuntor CA Recomendado: ${breakerA > 0 ? `${breakerA} A` : 'a definir'}</div></div>
        </div>
        <p class="caption">${esc(acOutputTitle(input.acOutput))}. ${esc(outputHelp)}</p>
      </section>
      ${nativeNotice}

      <section class="callout battery">
        <div class="badge">ARMAZENAMENTO DE ENERGIA (BACKUP)</div>
        <h3>BANCO DE BATERIAS: ${esc(result.bank.headline)}</h3>
        <div class="spec">
          <div><div class="label">Tecnologia</div><div class="value">${esc(tech)}</div></div>
          <div><div class="label">Capacidade Útil Entregue</div><div class="value">${esc(dodNote)}</div></div>
          <div><div class="label">Autonomia Projetada</div><div class="value">${esc(formatNumber(input.autonomyHours))} Horas</div></div>
          <div><div class="label">Guia Rápido de Montagem/Ligação</div><div class="value">${esc(describeArrangementGuide(result))}</div></div>
        </div>
        <p class="caption">${esc(result.bank.wiring)}. ${esc(model.tech === 'lithium' ? FIELD_HELP.lithiumBadge : FIELD_HELP.stationaryBadge)}.</p>
      </section>
      ${transformerCard}
    </div>
    <footer class="footer">
      <span>Desenvolvido via Calculadora Solar — Diagnóstico Eletrotécnico</span>
      <span>Página 1 de 1</span>
      <span>Documento Técnico para Fins de Dimensionamento</span>
    </footer>
  </div>
</body>
</html>`;
}
