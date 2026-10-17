export type AiProviderName = 'openai' | 'gemini';

/**
 * Converte a mensagem crua do provedor em um texto em português.
 * O dimensionamento local não depende dessa chave.
 */
export function explainProviderError(
  provider: AiProviderName,
  rawMessage: string,
  status?: number,
): string {
  const text = rawMessage.toLowerCase();
  const providerName = provider === 'openai' ? 'OpenAI' : 'Google Gemini';

  const noCredit =
    text.includes('no credits') ||
    text.includes('insufficient_quota') ||
    text.includes('insufficient quota') ||
    text.includes('billing') ||
    text.includes('exceeded your current quota') ||
    (text.includes('quota') && (text.includes('exceed') || text.includes('credit')));

  if (noCredit) {
    if (provider === 'openai') {
      return 'A chave da OpenAI está sem créditos. Os cálculos do aplicativo continuam funcionando. Para usar a revisão com IA, adicione créditos na conta da OpenAI ou selecione Google Gemini e informe uma chave do Gemini.';
    }
    return 'A cota do Google Gemini acabou. Os cálculos do aplicativo continuam funcionando. Aguarde a renovação da cota ou informe outra chave.';
  }

  const invalidKey =
    status === 401 ||
    status === 403 ||
    text.includes('incorrect api key') ||
    text.includes('invalid api key') ||
    text.includes('api key not valid') ||
    text.includes('permission denied');

  if (invalidKey) {
    return provider === 'openai'
      ? 'A OpenAI recusou a chave. Confira se ela está completa, começa com sk- e pertence a uma conta com acesso à API.'
      : 'O Gemini recusou a chave. Confira se ela é uma chave de API do Google AI Studio.';
  }

  if (
    text.includes('model') &&
    (text.includes('not found') ||
      text.includes('does not exist') ||
      text.includes('no longer available') ||
      text.includes('not available') ||
      text.includes('is not supported'))
  ) {
    const whose = provider === 'openai' ? 'da OpenAI' : 'do Google Gemini';
    return `O modelo ${whose} foi desativado. Atualize o aplicativo para usar o modelo atual. Os cálculos continuam funcionando sem a chave.`;
  }

  if (status === 429 || text.includes('rate limit')) {
    return `A ${providerName} limitou as consultas por excesso de pedidos. Aguarde um minuto e teste de novo. Os cálculos do aplicativo não dependem dessa conexão.`;
  }

  const cleaned = rawMessage.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return `Não foi possível falar com a ${providerName}${status ? ` (código ${status})` : ''}. Os cálculos do aplicativo continuam funcionando.`;
  }

  return `A ${providerName} recusou a consulta: ${cleaned}`;
}
