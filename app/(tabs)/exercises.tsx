import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getExercises, getEquipmentList, getMuscleList } from '../../src/db/queries';
import { useColors } from '../../src/theme';
import type { Colors } from '../../src/theme';
import type { Exercise } from '../../src/types';

export default function ExercisesTab() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [search, setSearch] = useState('');
  const [equipment, setEquipment] = useState('');
  const [muscles, setMuscles] = useState<string[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [equipmentList, setEquipmentList] = useState<string[]>([]);
  const [muscleList, setMuscleList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFilters = useCallback(async () => {
    const [eq, mu] = await Promise.all([getEquipmentList(db), getMuscleList(db)]);
    setEquipmentList(eq);
    setMuscleList(mu);
  }, [db]);

  useFocusEffect(
    useCallback(() => { void loadFilters(); }, [loadFilters])
  );

  const loadExercises = useCallback(async () => {
    setLoading(true);
    const data = await getExercises(db, search, equipment, muscles);
    setExercises(data);
    setLoading(false);
  }, [db, search, equipment, muscles]);

  useFocusEffect(
    useCallback(() => { void loadExercises(); }, [loadExercises])
  );

  const toggleMuscle = (m: string) =>
    setMuscles((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search exercises..."
        placeholderTextColor={c.placeholder}
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
        onSubmitEditing={loadExercises}
        clearButtonMode="while-editing"
      />

      <Text style={styles.filterLabel}>Equipment</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, equipment === '' && styles.chipActive]}
          onPress={() => setEquipment('')}
        >
          <Text style={[styles.chipText, equipment === '' && styles.chipTextActive]}>All</Text>
        </TouchableOpacity>
        {equipmentList.map((eq) => (
          <TouchableOpacity
            key={eq}
            style={[styles.chip, equipment === eq && styles.chipActive]}
            onPress={() => setEquipment(equipment === eq ? '' : eq)}
          >
            <Text style={[styles.chipText, equipment === eq && styles.chipTextActive]}>{eq}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Muscle Group</Text>
        {muscles.length > 0 && (
          <TouchableOpacity onPress={() => setMuscles([])}>
            <Text style={styles.clearBtn}>Clear {muscles.length}</Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {muscleList.map((m) => {
          const active = muscles.includes(m);
          return (
            <TouchableOpacity
              key={m}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggleMuscle(m)}
            >
              {active && (
                <Ionicons name="checkmark" size={11} color="#fff" style={styles.chipCheck} />
              )}
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{m}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(ex) => ex.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/exercises/${item.id}`)}
            >
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardSub}>
                {[item.equipment, item.category].filter(Boolean).join(' · ')}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No exercises found.</Text>
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, padding: 12 },
    searchInput: {
      backgroundColor: c.inputBg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      padding: 10,
      fontSize: 15,
      marginBottom: 10,
      color: c.text,
    },
    filterLabel: { fontSize: 11, fontWeight: '700', color: c.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.6 },
    filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 4 },
    clearBtn: { fontSize: 12, color: c.accent, fontWeight: '600' },
    chipRow: { flexDirection: 'row', marginBottom: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 11,
      paddingVertical: 5,
      marginRight: 6,
      backgroundColor: c.card,
    },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipCheck: { marginRight: 3 },
    chipText: { color: c.subtext, fontSize: 13, textTransform: 'capitalize' },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    card: {
      backgroundColor: c.card,
      borderRadius: 10,
      padding: 14,
      marginBottom: 8,
      elevation: 1,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    cardTitle: { fontSize: 15, fontWeight: '600', color: c.text },
    cardSub: { fontSize: 12, color: c.muted, marginTop: 2, textTransform: 'capitalize' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 },
    empty: { color: c.muted, textAlign: 'center', marginTop: 40 },
  });
}
