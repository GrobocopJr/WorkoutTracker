import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, runOnJS } from 'react-native-reanimated';
import Svg, {
  Path,
  Circle,
  Line,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
  G,
} from 'react-native-svg';
import { useColors } from '../theme';

export interface ChartPoint {
  date: string;
  value: number;
}

interface Props {
  data: ChartPoint[];
}

const CHART_H = 190;
const PAD = { left: 46, right: 16, top: 16, bottom: 28 };
const MIN_VISIBLE = 3;

function fmtDate(d: string) {
  const parts = d.split('-');
  return `${+parts[1]}/${+parts[2]}`;
}

function fmtVal(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

export function ProgressChart({ data }: Props) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const [visibleCount, setVisibleCount] = useState(data.length);

  const pinchStartCount = useSharedValue(data.length);
  const currentCount = useSharedValue(data.length);

  useEffect(() => {
    setVisibleCount(data.length);
    currentCount.value = data.length;
  }, [data.length]);

  const updateCount = useCallback(
    (n: number) => {
      const clamped = Math.max(MIN_VISIBLE, Math.min(data.length, n));
      setVisibleCount(clamped);
      currentCount.value = clamped;
    },
    [data.length, currentCount]
  );

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      pinchStartCount.value = currentCount.value;
    })
    .onUpdate((e) => {
      const n = Math.round(pinchStartCount.value / e.scale);
      runOnJS(updateCount)(n);
    });

  if (data.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={{ color: c.muted, fontSize: 13 }}>No sessions logged yet</Text>
      </View>
    );
  }

  const vc = Math.max(MIN_VISIBLE, Math.min(data.length, visibleCount));
  const visible = data.slice(-vc);
  const vals = visible.map((p) => p.value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV === minV ? 1 : maxV - minV;

  const innerW = width - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;

  const toX = (i: number) =>
    PAD.left + (visible.length > 1 ? (i / (visible.length - 1)) * innerW : innerW / 2);
  const toY = (v: number) =>
    PAD.top + innerH - ((v - minV) / range) * innerH;

  const linePath = visible
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.value).toFixed(1)}`)
    .join(' ');

  const baseline = PAD.top + innerH;
  const areaPath =
    visible.length > 1
      ? linePath +
        ` L${toX(visible.length - 1).toFixed(1)},${baseline} L${toX(0).toFixed(1)},${baseline} Z`
      : '';

  const ySteps = [minV, (minV + maxV) / 2, maxV];

  const xCount = Math.min(5, visible.length);
  const xIdxs =
    visible.length <= 5
      ? visible.map((_, i) => i)
      : Array.from({ length: xCount }, (_, k) =>
          Math.round((k * (visible.length - 1)) / (xCount - 1))
        );

  return (
    <GestureDetector gesture={pinch}>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.chart, { backgroundColor: c.card, borderColor: c.border }]}
      >
        {width > 0 && (
          <Svg width={width} height={CHART_H}>
            <Defs>
              <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={c.accent} stopOpacity="0.20" />
                <Stop offset="1" stopColor={c.accent} stopOpacity="0" />
              </LinearGradient>
            </Defs>

            {ySteps.map((v, i) => {
              const y = toY(v);
              return (
                <G key={`y-${i}`}>
                  <Line
                    x1={PAD.left}
                    y1={y}
                    x2={width - PAD.right}
                    y2={y}
                    stroke={c.borderLight}
                    strokeWidth={1}
                    strokeDasharray={i === 0 ? undefined : '4,4'}
                  />
                  <SvgText x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill={c.muted}>
                    {fmtVal(v)}
                  </SvgText>
                </G>
              );
            })}

            {areaPath !== '' && <Path d={areaPath} fill="url(#areaGrad)" />}

            {visible.length > 1 && (
              <Path
                d={linePath}
                stroke={c.accent}
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {visible.map((p, i) => (
              <G key={`dot-${i}`}>
                <Circle cx={toX(i)} cy={toY(p.value)} r={5} fill={c.bg} />
                <Circle cx={toX(i)} cy={toY(p.value)} r={3} fill={c.accent} />
              </G>
            ))}

            {xIdxs.map((i) => (
              <SvgText
                key={`xl-${i}`}
                x={toX(i)}
                y={CHART_H - 4}
                textAnchor="middle"
                fontSize={10}
                fill={c.muted}
              >
                {fmtDate(visible[i].date)}
              </SvgText>
            ))}
          </Svg>
        )}

        <Text style={[styles.hint, { color: c.muted }]}>
          {data.length > MIN_VISIBLE
            ? `${visible.length} of ${data.length} sessions · pinch to zoom`
            : `${visible.length} session${visible.length !== 1 ? 's' : ''}`}
        </Text>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  chart: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: 8,
  },
  empty: {
    borderRadius: 12,
    borderWidth: 1,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hint: {
    fontSize: 11,
    textAlign: 'center',
    paddingBottom: 4,
  },
});
