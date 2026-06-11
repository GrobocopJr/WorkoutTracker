import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  StatusBar,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getExerciseById, getExerciseStat, getExerciseHistory, deleteExercise } from '../../src/db/queries';
import { ProgressChart } from '../../src/components/ProgressChart';
import { useColors } from '../../src/theme';
import type { Colors } from '../../src/theme';
import type { Exercise, ExerciseStat } from '../../src/types';
import type { ExerciseHistoryPoint } from '../../src/db/queries';

type ChartMetric = 'weight' | 'volume' | '1rm';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c, insets.top), [c, insets.top]);

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [stat, setStat] = useState<ExerciseStat | null>(null);
  const [history, setHistory] = useState<ExerciseHistoryPoint[]>([]);
  const [chartMetric, setChartMetric] = useState<ChartMetric>('weight');
  const [loading, setLoading] = useState(true);
  const [imgIndex, setImgIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [imgAuto, setImgAuto] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!imgAuto || imgError || exercise?.is_custom === 1) return;
    const timer = setInterval(() => setImgIndex((i) => (i === 0 ? 1 : 0)), 1200);
    return () => clearInterval(timer);
  }, [imgAuto, imgError, exercise?.is_custom]);


  useEffect(() => {
    async function load() {
      const [ex, st, hist] = await Promise.all([
        getExerciseById(db, id),
        getExerciseStat(db, id),
        getExerciseHistory(db, id),
      ]);
      setExercise(ex);
      setStat(st);
      setHistory(hist);
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

  const chartData = history.map((p) => ({
    date: p.date,
    value:
      chartMetric === 'weight'
        ? p.max_weight
        : chartMetric === 'volume'
        ? p.volume
        : p.best_1rm,
  }));

  const handleDelete = () => {
    Alert.alert(
      'Delete Exercise',
      `Delete "${exercise.name}"? This removes it from your library, any routines, and its logged history. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteExercise(db, exercise.id);
            router.back();
          },
        },
      ]
    );
  };

  const CDN = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises';
  const imgUri = `${CDN}/${exercise.id}/${imgIndex}.jpg`;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {exercise.is_custom !== 1 && !imgError && (
          <View style={styles.imageContainer}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => setFullscreen(true)}>
              <Image
                source={{ uri: imgUri }}
                style={styles.image}
                resizeMode="contain"
                onError={() => setImgError(true)}
              />
            </TouchableOpacity>
            <View style={styles.imgFooter}>
              <View style={styles.imgDots}>
                <View style={[styles.imgDot, imgIndex === 0 && styles.imgDotActive]} />
                <View style={[styles.imgDot, imgIndex === 1 && styles.imgDotActive]} />
              </View>
              <TouchableOpacity
                style={styles.imgToggleBtn}
                onPress={() => setImgAuto((a) => !a)}
                hitSlop={8}
              >
                <Ionicons
                  name={imgAuto ? 'pause-circle-outline' : 'play-circle-outline'}
                  size={18}
                  color={c.muted}
                />
                <Text style={styles.imgToggleText}>{imgAuto ? 'Pause' : 'Play'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

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

        <View style={styles.section}>
          <View style={styles.chartHeader}>
            <Text style={styles.sectionTitle}>Progress</Text>
            <View style={styles.metricToggle}>
              {(['weight', 'volume', '1rm'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.metricBtn,
                    chartMetric === m && { backgroundColor: c.accent },
                  ]}
                  onPress={() => setChartMetric(m)}
                >
                  <Text
                    style={[
                      styles.metricBtnText,
                      { color: chartMetric === m ? '#fff' : c.muted },
                    ]}
                  >
                    {m === 'weight' ? 'Weight' : m === 'volume' ? 'Volume' : '1RM'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <ProgressChart data={chartData} />
        </View>

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

        {exercise.is_custom === 1 && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={18} color={c.danger} />
            <Text style={styles.deleteText}>Delete Exercise</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={fullscreen} transparent animationType="fade" onRequestClose={() => setFullscreen(false)}>
        <StatusBar hidden />
        <TouchableOpacity
          style={styles.fsBackdrop}
          activeOpacity={1}
          onPress={() => setFullscreen(false)}
        >
          <Image
            source={{ uri: imgUri }}
            style={styles.fsImage}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={styles.fsClose}
            onPress={() => setFullscreen(false)}
            hitSlop={12}
          >
            <Ionicons name="close-circle" size={32} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fsToggleBtn}
            onPress={(e) => { e.stopPropagation(); setImgAuto((a) => !a); }}
            hitSlop={8}
          >
            <Ionicons
              name={imgAuto ? 'pause-circle-outline' : 'play-circle-outline'}
              size={22}
              color="#fff"
            />
            <Text style={styles.fsToggleText}>{imgAuto ? 'Pause' : 'Play'}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
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

function makeStyles(c: Colors, topInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { paddingBottom: 40 },
    imageContainer: {
      width: '100%',
      backgroundColor: c.card,
      marginBottom: 16,
    },
    image: {
      width: '100%',
      height: 220,
    },
    imgFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    imgDots: {
      flexDirection: 'row',
      gap: 6,
      flex: 1,
      alignItems: 'center',
    },
    imgDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.border,
    },
    imgDotActive: {
      backgroundColor: c.accent,
    },
    imgToggleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    imgToggleText: {
      fontSize: 13,
      color: c.muted,
    },
    // fullscreen modal
    fsBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.90)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    fsImage: {
      width: '100%',
      height: '100%',
    },
    fsClose: {
      position: 'absolute',
      top: topInset + 12,
      right: 16,
    },
    fsToggleBtn: {
      position: 'absolute',
      bottom: 32,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    fsToggleText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    notFound: { color: c.muted },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14, paddingHorizontal: 16, paddingTop: 16 },
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
      marginHorizontal: 16,
      elevation: 1,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    statLabel: { color: c.muted, fontSize: 14 },
    statValue: { color: c.text, fontWeight: '600', fontSize: 14 },
    section: { marginBottom: 16, paddingHorizontal: 16 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: c.subtext, marginBottom: 6 },
    muscleText: { color: c.text, textTransform: 'capitalize', lineHeight: 20 },
    step: { flexDirection: 'row', marginBottom: 8, gap: 8 },
    stepNum: { color: c.accent, fontWeight: '700', minWidth: 20 },
    stepText: { flex: 1, color: c.subtext, lineHeight: 20 },
    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: c.danger,
      borderRadius: 10,
      padding: 12,
      marginTop: 8,
      marginHorizontal: 16,
    },
    deleteText: { color: c.danger, fontWeight: '700', fontSize: 15 },
    chartHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    metricToggle: {
      flexDirection: 'row',
      gap: 4,
      backgroundColor: c.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      padding: 3,
    },
    metricBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    metricBtnText: {
      fontSize: 12,
      fontWeight: '600',
    },
  });
}
