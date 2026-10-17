import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HelpCard } from '../components/HelpCard';
import { ScreenContainer } from '../components/ScreenContainer';
import { FACTOR_333_EXPLANATION } from '../constants/modules';
import { useTheme } from '../theme/ThemeContext';

const TERMS = [
  {
    term: 'kWh',
    definition:
      'Quilowatt-hora: unidade de energia consumida ou gerada. É o valor que aparece na fatura de energia.',
  },
  {
    term: 'kWp',
    definition:
      'Quilowatt-pico: potência nominal do sistema fotovoltaico sob condições padrão de teste (STC).',
  },
  {
    term: 'Módulo / Placa',
    definition:
      'Unidade geradora fotovoltaica. Neste app, cada módulo possui potência (Wp), dimensões e área unitária.',
  },
  {
    term: 'Inversor',
    definition:
      'Equipamento que converte a corrente contínua (CC) dos módulos em corrente alternada (CA) para a rede.',
  },
  {
    term: 'FDI / Overboarding',
    definition:
      'Fator de Dimensionamento do Inversor. Relação entre a potência dos módulos e a potência do inversor. Faixa usada: 1,15 a 1,30.',
  },
  {
    term: 'Área bruta',
    definition: 'Soma das áreas unitárias dos módulos, sem margem de circulação ou sombreamento.',
  },
  {
    term: 'Área útil / margem',
    definition:
      'Área em que as placas cabem de fato: telhado menos a folga fixa do perímetro, os obstáculos e o corredor de manutenção. É a mesma conta nas abas Cálculo e Telhado.',
  },
  {
    term: 'Layout 2D / Arranjo',
    definition:
      'Sub-aba do Telhado que desconta a folga fixa do perímetro, obstáculos e o corredor opcional, e testa Vertical, Horizontal e Misto para a quantidade máxima de placas.',
  },
];

const FORMULAS = [
  {
    title: 'Consumo mensal → potência',
    body: 'Consumo Diário (kWh/dia) = Consumo Mensal / 30\nPotência (kWp) = Consumo Mensal / 100',
  },
  {
    title: 'Consumo diário → potência',
    body: 'Consumo Mensal (kWh/mês) = Consumo Diário × 30\nPotência (kWp) = Consumo Diário / 3,33',
  },
  {
    title: 'Sugestão de inversor',
    body: 'Inversor mín. (kW) = Potência kWp / 1,30\nInversor máx. (kW) = Potência kWp / 1,15',
  },
  {
    title: 'Área — sistema para telhado',
    body: 'Área Bruta = Qtd × Área Unitária\nTelhado mínimo = menor retângulo que comporta essa quantidade\ncom a folga do perímetro, mid clamp de 2 cm, end clamp de 3 a 5 cm e o corredor\nPlacas suportadas = as que o Layout 2D desenha nesse retângulo',
  },
  {
    title: 'Área — telhado para placas',
    body: 'A aba Cálculo do Telhado usa o mesmo arranjo do Layout 2D\nÁrea Útil = telhado − folga do perímetro − obstáculos − corredores\nQtd Máx. = placas que cabem sem invadir borda, obstáculo ou corredor\nPotência (kWp) = (Qtd × Wp) / 1000\nGeração Mensal ≈ Potência × 100 kWh/mês',
  },
  {
    title: 'Cadastro da placa e backup',
    body: 'Na aba Módulos, cole as informações da placa (potência, comprimento, largura, peso, moldura e vidro). O app cadastra o modelo neste aparelho e, se houver chave, pode pedir ajuda da IA.\nPlacas, telhado, carga e consumo são salvos automaticamente. Atualizar o app recupera esses dados. Ao desinstalar, mantenha os dados do Solar Calculator quando o Android perguntar. Uma cópia fica em Meus Documentos/Calculadora Solar/Backups/solar-calculator-backup.json.',
  },
  {
    title: 'Layout 2D — distribuição espacial',
    body: 'Área útil = polígono − folga fixa do perímetro − obstáculos − corredores\nMid clamp entre placas: 2 cm obrigatórios\nEnd clamp no fim da fileira: 3 a 5 cm\nCorredor opcional (padrão desligado): 0,60 m a cada 2 fileiras\nTesta Vertical, Horizontal e Misto\nArrastar obstáculo ou mudar o corredor recalcula placas e kWp',
  },
];

export function GuiaScreen() {
  const { colors } = useTheme();

  return (
    <ScreenContainer
      title="Guia & Dicionário"
      subtitle="Explicações das fórmulas, do fator 3,33 e dos termos técnicos usados no app."
    >
      <HelpCard title="Fator 3,33 — explicação completa" body={FACTOR_333_EXPLANATION} initiallyOpen />

      <Text style={[styles.section, { color: colors.text }]}>Fórmulas do app</Text>
      {FORMULAS.map((item) => (
        <View
          key={item.title}
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
          <Text style={[styles.formula, { color: colors.textSecondary }]}>{item.body}</Text>
        </View>
      ))}

      <Text style={[styles.section, { color: colors.text }]}>Dicionário técnico</Text>
      {TERMS.map((item) => (
        <View
          key={item.term}
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.accent }]}>{item.term}</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{item.definition}</Text>
        </View>
      ))}

      <View
        style={[
          styles.note,
          { backgroundColor: colors.primarySoft, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.noteTitle, { color: colors.text }]}>Aviso técnico</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Os cálculos deste aplicativo são estimativas rápidas para pré-dimensionamento. Irradiação
          local, orientação, inclinação, sombreamento, perdas e normas locais devem ser validados
          por um profissional habilitado antes da instalação.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    marginBottom: 12,
    marginTop: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    marginBottom: 8,
  },
  formula: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 22,
  },
  body: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 21,
  },
  note: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
    marginBottom: 20,
  },
  noteTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
    marginBottom: 6,
  },
});
