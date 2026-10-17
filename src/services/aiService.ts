import * as Network from 'expo-network';
import { AI_MODELS } from '../constants/modules';
import { AiConfig, AiProvider, AiReviewPayload, AiReviewResult } from '../types';
import { explainProviderError } from '../utils/aiErrors';

async function ensureOnline(): Promise<void> {
  const state = await Network.getNetworkStateAsync();
  if (!state.isConnected || state.isInternetReachable === false) {
    throw new Error('Sem conexão com a internet. Verifique a rede e tente novamente.');
  }
}

function buildReviewPrompt(payload: AiReviewPayload): string {
  const base = `Você é um engenheiro especialista em sistemas fotovoltaicos no Brasil.
Analise o dimensionamento abaixo e responda APENAS em JSON válido com o formato:
{"coherent": boolean, "summary": string, "observations": string[], "suggestions": string[]}
Use português do Brasil. Seja objetivo e técnico. Não invente normas inexistentes.
Dados do dimensionamento:
`;

  switch (payload.kind) {
    case 'monthly':
      return (
        base +
        JSON.stringify(
          {
            tipo: 'Consumo mensal',
            consumoMensalKwh: payload.result.monthlyKwh,
            consumoDiarioKwh: payload.result.dailyKwh,
            potenciaKwp: payload.result.powerKwp,
            inversorMinKw: payload.result.inverterMinKw,
            inversorMaxKw: payload.result.inverterMaxKw,
            formulas: {
              diario: 'mensal / 30',
              potencia: 'mensal / 100',
              fdi: '1.15 a 1.30',
            },
          },
          null,
          2,
        )
      );
    case 'daily':
      return (
        base +
        JSON.stringify(
          {
            tipo: 'Consumo diário',
            consumoDiarioKwh: payload.result.dailyKwh,
            consumoMensalKwh: payload.result.monthlyKwh,
            potenciaKwp: payload.result.powerKwp,
            inversorMinKw: payload.result.inverterMinKw,
            inversorMaxKw: payload.result.inverterMaxKw,
            formulas: {
              mensal: 'diario * 30',
              potencia: 'diario / 3.33',
              fdi: '1.15 a 1.30',
            },
          },
          null,
          2,
        )
      );
    case 'roof_direct':
      return (
        base +
        JSON.stringify(
          {
            tipo: 'Área de telhado — sistema para telhado',
            quantidadePlacas: payload.result.quantity,
            modulo: {
              potenciaWp: payload.result.module.powerWp,
              areaM2: payload.result.module.areaM2,
              modelo: payload.result.module.model,
            },
            areaBrutaM2: payload.result.grossAreaM2,
            margemSeguranca: payload.result.safetyMargin,
            areaRecomendadaM2: payload.result.recommendedAreaM2,
            potenciaTotalKwp: payload.result.totalPowerKwp,
          },
          null,
          2,
        )
      );
    case 'roof_inverse':
      return (
        base +
        JSON.stringify(
          {
            tipo: 'Área de telhado — telhado para placas',
            areaTelhadoM2: payload.result.roofAreaM2,
            margemDesconto: payload.result.discountMargin,
            areaUtilM2: payload.result.usefulAreaM2,
            modulo: {
              potenciaWp: payload.result.module.powerWp,
              areaM2: payload.result.module.areaM2,
              modelo: payload.result.module.model,
            },
            qtdMaximaPlacas: payload.result.maxModules,
            potenciaMaximaKwp: payload.result.maxPowerKwp,
            geracaoMensalEstimadaKwh: payload.result.estimatedMonthlyGenerationKwh,
          },
          null,
          2,
        )
      );
  }
}

function extractJson(text: string): AiReviewResult {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return {
      coherent: true,
      summary: text.trim(),
      observations: [],
      suggestions: [],
      rawText: text,
    };
  }

  try {
    const parsed = JSON.parse(match[0]) as Partial<AiReviewResult>;
    return {
      coherent: Boolean(parsed.coherent),
      summary: String(parsed.summary ?? 'Análise concluída.'),
      observations: Array.isArray(parsed.observations)
        ? parsed.observations.map(String)
        : [],
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.map(String)
        : [],
      rawText: text,
    };
  } catch {
    return {
      coherent: true,
      summary: text.trim(),
      observations: [],
      suggestions: [],
      rawText: text,
    };
  }
}

async function callOpenAi(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: AI_MODELS.openai,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Você analisa dimensionamentos fotovoltaicos e responde somente em JSON válido.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };

  if (!response.ok) {
    throw new Error(
      explainProviderError('openai', data.error?.message ?? '', response.status),
    );
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Resposta vazia da OpenAI.');
  }
  return content;
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const model = AI_MODELS.gemini;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        thinkingConfig: { thinkingLevel: 'low' },
      },
    }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    }>;
  };

  if (!response.ok) {
    throw new Error(
      explainProviderError('gemini', data.error?.message ?? '', response.status),
    );
  }

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const content = parts
    .filter((part) => part.text && !part.thought)
    .map((part) => part.text)
    .join('\n')
    .trim();
  if (!content) {
    throw new Error('Resposta vazia do Gemini.');
  }
  return content;
}

export async function testAiConnection(config: AiConfig): Promise<string> {
  if (!config.apiKey.trim()) {
    throw new Error('Informe a chave de API antes de testar a conexão.');
  }

  await ensureOnline();

  const prompt =
    'Responda apenas com a palavra OK se a conexão estiver funcionando.';

  if (config.provider === 'openai') {
    const text = await callOpenAi(config.apiKey, prompt);
    return text.trim() || 'Conexão OpenAI OK';
  }

  const text = await callGemini(config.apiKey, prompt);
  return text.trim() || 'Conexão Gemini OK';
}

export async function reviewDimensioning(
  config: AiConfig,
  payload: AiReviewPayload,
): Promise<AiReviewResult> {
  if (!config.apiKey.trim()) {
    throw new Error(
      'Configure a chave de API na aba Configurações da IA para usar a revisão inteligente.',
    );
  }

  await ensureOnline();
  const prompt = buildReviewPrompt(payload);
  const text =
    config.provider === 'openai'
      ? await callOpenAi(config.apiKey, prompt)
      : await callGemini(config.apiKey, prompt);

  return extractJson(text);
}

export type ExtractedModuleFields = {
  manufacturer?: string;
  model?: string;
  powerWp?: number;
  lengthM?: number;
  widthM?: number;
  areaM2?: number;
  thicknessMm?: number;
  weightKg?: number;
  frame?: string;
  glass?: string;
};

export async function extractModuleFromText(
  config: AiConfig,
  datasheet: string,
): Promise<ExtractedModuleFields> {
  if (!config.apiKey.trim()) {
    throw new Error('Informe a chave de IA na aba Config para ler a placa com IA.');
  }
  await ensureOnline();
  const prompt = `Extraia os dados físicos de um módulo fotovoltaico do texto abaixo.
Responda APENAS com JSON válido neste formato:
{"manufacturer":"","model":"","powerWp":0,"lengthM":0,"widthM":0,"areaM2":0,"thicknessMm":0,"weightKg":0,"frame":"","glass":""}
Regras: comprimento e largura em metros; espessura da moldura em milímetros; potência em Wp; peso em kg.
Se um dado não existir, use 0 ou texto vazio. Não invente medidas.
Texto da placa:
${datasheet}`;
  const text =
    config.provider === 'openai'
      ? await callOpenAi(config.apiKey, prompt)
      : await callGemini(config.apiKey, prompt);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('A IA não devolveu os dados da placa.');
  }
  const parsed = JSON.parse(match[0]) as ExtractedModuleFields;
  return parsed;
}

export function providerLabel(provider: AiProvider): string {
  return provider === 'openai' ? 'OpenAI (GPT-4o-mini)' : 'Google Gemini';
}
