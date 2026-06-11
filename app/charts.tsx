import { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import { getExerciseHistory } from '../src/db/queries';
import { ExercisePicker } from '../src/components/ExercisePicker';
import { MultiLineChart, LINE_COLORS } from '../src/components/MultiLineChart';
import { useColors } from '../src/theme';
import type { Colors } from '../src/theme';
import type { Exercise } from '../src/types';
import type { ExerciseHistoryPoint } from '../src/db/queries';

type ChartMetric = 'weight' | 'volume' | '1rm';

interface SelectedExercise {
  id: string;
  name: string;
  color: string;
  history: ExerciseHistoryPoint[];
}

export default function ChartsScreen() {
  const db = useSQLiteContext();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [metric, setMetric] = useState<ChartMetric>('weight');
  const [selected, setSelected] = useState<SelectedExercise[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const addExercise = async (exercise: Exercise) => {
    setPickerVisible(false);
    if (selected.some((s) => s.id === exercise.id)) return;
    setLoading(true);
    const history = await getExerciseHistory(db, exercise.id);
    const color = LINE_COLORS[selected.length % LINE_COLORS.length];
    setSelected((prev) => [...prev, { id: exercise.id, name: exercise.name, color, history }]);
    setLoading(false);
  };

  const removeExercise = (id: string) => {
    setSelected((prev) => prev.filter((s) => s.id !== id));
  };

  const series = useMemo(
    () =>
      selected.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        points: s.history.map((p) => ({
          date: p.date,
          value:
            metric === 'weight'
              ? p.max_weight
              : metric === 'volume'
              ? p.volume
              : p.best_1rm,
        })),
      })),
    [selected, metric]
  );

  const METRICS: { key: ChartMetric; label: string }[] = [
    { key: 'weight', label: 'Max Weight' },
    { key: 'volume', label: 'Volume' },
    { key: '1rm', label: 'Est. 1RM' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Metric toggle */}
      <View style={[styles.metricRow, { backgroundColor: c.card, borderColor: c.border }]}>
        {METRICS.map((m) => (
          <TouchableOpacity
            key={m.key}
            style={[styles.metricBtn, metric === m.key && { backgroundColor: c.accent }]}
            onPress={() => setMetric(m.key)}
          >
            <Text style={[styles.metricLabel, { color: metric === m.key ? '#fff' : c.muted }]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Chart */}
      {series.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: c.card, borderColor: c.border }]}>
          <Ionicons name="stats-chart-outline" size={40} color={c.muted} />
          <Text style={[styles.emptyTitle, { color: c.text }]}>No exercises selected</Text>
          <Text style={[styles.emptyHint, { color: c.muted }]}>
            Tap "Add Exercise" below to start comparing progress
          </Text>
        </View>
      ) : (
        <MultiLineChart series={series} />
      )}

      {/* Exercise list */}
      {selected.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.subtext }]}>
            Exercises ({selected.length})
          </Text>
          {selected.map((ex) => (
            <View key={ex.id} style={[styles.exRow, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={[styles.colorDot, { backgroundColor: ex.color }]} />
              <Text style={[styles.exName, { color: c.text }]} numberOfLines={1}>
                {ex.name}
              </Text>
              <TouchableOpacity onPress={() => removeExercise(ex.id)} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color={c.muted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Add Exercise */}
      <TouchableOpacity
        style={[styles.addBtn, { borderColor: c.accent }]}
        onPress={() => setPickerVisible(true)}
        disabled={loading}
      >
        <Ionicons name="add-circle-outline" size={20} color={c.accent} />
        <Text style={[styles.addBtnText, { color: c.accent }]}>
          {loading ? 'Loading…' : 'Add Exercise'}
        </Text>
      </TouchableOpacity>

      <ExercisePicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={addExercise}
      />
    </ScrollView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, gap: 14, paddingBottom: 40 },
    metricRow: {
      flexDirection: 'row',
      borderRadius: 10,
      borderWidth: 1,
      padding: 4,
      gap: 4,
    },
    metricBtn: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 7,
      alignItems: 'center',
    },
    metricLabel: {
      fontSize: 13,
      fontWeight: '600',
    },
    empty: {
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '600',
    },
    emptyHint: {
      fontSize: 13,
      textAlign: 'center',
      paddingHorizontal: 32,
    },
    section: { gap: 8 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    exRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 10,
      borderWidth: 1,
      padding: 12,
    },
    colorDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      flexShrink: 0,
    },
    exName: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 10,
      borderWidth: 1.5,
      paddingVertical: 13,
    },
    addBtnText: {
      fontSize: 15,
      fontWeight: '600',
    },
  });
}
