import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { getExerciseById, getExerciseStat } from '../../src/db/queries';
import { useColors } from '../../src/theme';
import type { Colors } from '../../src/theme';
import type { Exercise, ExerciseStat } from '../../src/types';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [stat, setStat] = useState<ExerciseStat | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const ex = await getExerciseById(db, id);
      const st = await getExerciseStat(db, id);
      setExercise(ex);
      setStat(st);
      if (ex) navigation.setOptions({ title: ex.name });
      setLoading(false);
    }
    load();
  }, [id, db]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!exercise) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>Exercise not found.</Text>
      </View>
    );
  }

  const primaryMuscles: string[] = safeJson(exercise.primary_muscles);
  const secondaryMuscles: string[] = safeJson(exercise.secondary_muscles);
  const instructions: string[] = safeJson(exercise.instructions);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.tags}>
        {[exercise.equipment, exercise.category, exercise.level, exercise.mechanic]
          .filter(Boolean)
          .map((t) => (
            <View key={t} style={styles.tag}>
              <Text style={styles.tagText}>{t}</Text>
            </View>
          ))}
      </View>

      {stat && (stat.last_weight !== null || stat.best_weight !== null) && (
        <View style={styles.statsCard}>
          {stat.last_weight !== null && (
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Last Used</Text>
              <Text style={styles.statValue}>
                {stat.last_weight} × {stat.last_reps} reps
              </Text>
            </View>
          )}
          {stat.best_weight !== null && (
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Best Weight</Text>
              <Text style={styles.statValue}>{stat.best_weight}</Text>
            </View>
          )}
          {stat.best_1rm !== null && (
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Est. 1RM (Epley)</Text>
              <Text style={styles.statValue}>{stat.best_1rm?.toFixed(1)}</Text>
            </View>
          )}
        </View>
      )}

      {primaryMuscles.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Primary Muscles</Text>
          <Text style={styles.muscleText}>{primaryMuscles.join(', ')}</Text>
        </View>
      )}

      {secondaryMuscles.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Secondary Muscles</Text>
          <Text style={styles.muscleText}>{secondaryMuscles.join(', ')}</Text>
        </View>
      )}

      {instructions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          {instructions.map((step, i) => (
            <View key={i} style={styles.step}>
              <Text style={styles.stepNum}>{i + 1}.</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function safeJson(text: string | null): string[] {
  if (!text) return [];
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, paddingBottom: 40 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    notFound: { color: c.muted },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
    tag: {
      backgroundColor: c.accentFaded,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    tagText: { color: c.accentFadedText, fontSize: 12, textTransform: 'capitalize' },
    statsCard: {
      backgroundColor: c.card,
      borderRadius: 10,
      padding: 14,
      marginBottom: 16,
      elevation: 1,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    statLabel: { color: c.muted, fontSize: 14 },
    statValue: { color: c.text, fontWeight: '600', fontSize: 14 },
    section: { marginBottom: 16 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: c.subtext, marginBottom: 6 },
    muscleText: { color: c.text, textTransform: 'capitalize', lineHeight: 20 },
    step: { flexDirection: 'row', marginBottom: 8, gap: 8 },
    stepNum: { color: c.accent, fontWeight: '700', minWidth: 20 },
    stepText: { flex: 1, color: c.subtext, lineHeight: 20 },
  });
}
