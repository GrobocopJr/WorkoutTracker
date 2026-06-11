import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, runOnJS } from 'react-native-reanimated';
import Svg, { Path, Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { useColors } from '../theme';

export interface ChartSeries {
  id: string;
  name: string;
  color: string;
  points: { date: string; value: number }[];
}

interface Props {
  series: ChartSeries[];
}

const CHART_H = 220;
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

export function MultiLineChart({ series }: Props) {
  const c = useColors();
  const [width, setWidth] = useState(0);

  const allDates = useMemo(
    () => [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort(),
    [series]
  );

  const [visibleCount, setVisibleCount] = useState(allDates.length || MIN_VISIBLE);
  const pinchStartCount = useSharedValue(allDates.length || MIN_VISIBLE);
  const currentCount = useSharedValue(allDates.length || MIN_VISIBLE);

  useEffect(() => {
    const n = Math.max(MIN_VISIBLE, allDates.length);
    setVisibleCount(n);
    currentCount.value = n;
  }, [allDates.length]);

  const updateCount = useCallback(
    (n: number) => {
      const clamped = Math.max(MIN_VISIBLE, Math.min(allDates.length, n));
      setVisibleCount(clamped);
      currentCount.value = clamped;
    },
    [allDates.length, currentCount]
  );

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      pinchStartCount.value = currentCount.value;
    })
    .onUpdate((e) => {
      const n = Math.round(pinchStartCount.value / e.scale);
      runOnJS(updateCount)(n);
    });

  const vc = Math.max(MIN_VISIBLE, Math.min(allDates.length, visibleCount));
  const visibleDates = allDates.slice(-vc);
  const dateSet = new Set(visibleDates);
  const dateIndex = new Map(visibleDates.map((d, i) => [d, i]));

  const allVals = series.flatMap((s) =>
    s.points.filter((p) => dateSet.has(p.date)).map((p) => p.value)
  );
  const minV = allVals.length > 0 ? Math.min(...allVals) : 0;
  const maxV = allVals.length > 0 ? Math.max(...allVals) : 1;
  const range = maxV === minV ? 1 : maxV - minV;

  const innerW = width - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;

  const toX = (i: number) =>
    PAD.left + (visibleDates.length > 1 ? (i / (visibleDates.length - 1)) * innerW : innerW / 2);
  const toY = (v: number) =>
    PAD.top + innerH - ((v - minV) / range) * innerH;

  const ySteps = [minV, (minV + maxV) / 2, maxV];

  const xCount = Math.min(5, visibleDates.length);
  const xIdxs =
    visibleDates.length <= 5
      ? visibleDates.map((_, i) => i)
      : Array.from({ length: xCount }, (_, k) =>
          Math.round((k * (visibleDates.length - 1)) / (xCount - 1))
        );

  return (
    <GestureDetector gesture={pinch}>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.chart, { backgroundColor: c.card, borderColor: c.border }]}
      >
        {width > 0 && (
          <Svg width={width} height={CHART_H}>
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

            {series.map((s) => {
              const pts = s.points
                .filter((p) => dateSet.has(p.date))
                .map((p) => ({ x: toX(dateIndex.get(p.date)!), y: toY(p.value) }));
              if (pts.length < 2) return null;
              const d = pts
                .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                .join(' ');
              return (
                <Path
                  key={`line-${s.id}`}
                  d={d}
                  stroke={s.color}
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}

            {series.map((s) =>
              s.points
                .filter((p) => dateSet.has(p.date))
                .map((p, di) => {
                  const x = toX(dateIndex.get(p.date)!);
                  const y = toY(p.value);
                  return (
                    <G key={`dot-${s.id}-${di}`}>
                      <Circle cx={x} cy={y} r={5} fill={c.bg} />
                      <Circle cx={x} cy={y} r={3} fill={s.color} />
                    </G>
                  );
                })
            )}

            {xIdxs.map((i) => (
              <SvgText
                key={`xl-${i}`}
                x={toX(i)}
                y={CHART_H - 4}
                textAnchor="middle"
                fontSize={10}
                fill={c.muted}
              >
                {fmtDate(visibleDates[i])}
              </SvgText>
            ))}
          </Svg>
        )}

        <Text style={[styles.hint, { color: c.muted }]}>
          {allDates.length > MIN_VISIBLE
            ? `${visibleDates.length} of ${allDates.length} dates · pinch to zoom`
            : `${visibleDates.length} date${visibleDates.length !== 1 ? 's' : ''}`}
        </Text>
      </View>
    </GestureDetector>
  );
}

export const LINE_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#F97316',
  '#06B6D4',
  '#EC4899',
];

const styles = StyleSheet.create({
  chart: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: 8,
  },
  hint: {
    fontSize: 11,
    textAlign: 'center',
    paddingBottom: 4,
  },
});
