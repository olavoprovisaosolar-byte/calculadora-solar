import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { formatNumber } from '../utils/calculations';

const YELLOW_127 = '#E8A317';
const BLUE_220 = '#2C6BED';

type Props = {
  share127: number;
  share220: number;
  power127Kw: number;
  power220Kw: number;
  lowLabel?: string;
  highLabel?: string;
};

/** Rosca da parcela fase-neutro (amarelo) × fase-fase (azul). */
export function LoadShareChart({
  share127,
  share220,
  power127Kw,
  power220Kw,
  lowLabel = '127 V',
  highLabel = '220 V',
}: Props) {
  const { colors } = useTheme();
  const size = 168;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction127 = Math.min(1, Math.max(0, share127));
  const dash127 = fraction127 * circumference;
  const empty = share127 + share220 <= 0;
  const emphasizeHigh = fraction127 <= 0.001 && share220 > 0;
  const centerFraction = emphasizeHigh ? Math.min(1, Math.max(0, share220)) : fraction127;
  const centerLabel = emphasizeHigh ? highLabel : lowLabel;

  return (
    <View style={styles.wrap}>
      <View style={styles.chart}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={empty ? colors.border : BLUE_220}
            strokeWidth={stroke}
            fill="none"
          />
          {dash127 > 0 ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={YELLOW_127}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${dash127} ${circumference - dash127}`}
              strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ) : null}
        </Svg>
        <View style={styles.center} pointerEvents="none">
          <Text style={[styles.centerValue, { color: colors.text }]}>
            {formatNumber(centerFraction * 100, 0)}%
          </Text>
          <Text style={[styles.centerLabel, { color: colors.textMuted }]}>{centerLabel}</Text>
        </View>
      </View>
      <View style={styles.legend}>
        <LegendDot color={YELLOW_127} label={`Carga ${lowLabel}`} value={`${formatNumber(power127Kw)} kW · ${formatNumber(share127 * 100, 0)}%`} />
        <LegendDot color={BLUE_220} label={`Carga ${highLabel}`} value={`${formatNumber(power220Kw)} kW · ${formatNumber(share220 * 100, 0)}%`} />
      </View>
    </View>
  );
}

function LegendDot({ color, label, value }: { color: string; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.legendRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={styles.legendText}>
        <Text style={[styles.legendLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.legendValue, { color: colors.textSecondary }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  chart: {
    width: 168,
    height: 168,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
  },
  centerValue: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 22,
  },
  centerLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
  },
  legend: {
    alignSelf: 'stretch',
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: { flex: 1 },
  legendLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
  },
  legendValue: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    marginTop: 1,
  },
});
