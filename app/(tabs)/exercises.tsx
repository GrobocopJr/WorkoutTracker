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
  const [muscle, setMuscle] = useState('');
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
    const data = await getExercises(db, search, equipment, muscle);
    setExercises(data);
    setLoading(false);
  }, [db, search, equipment, muscle]);

  useFocusEffect(
    useCallback(() => { void loadExercises(); }, [loadExercises])
  );

  const chipStyle = (active: boolean) => [styles.chip, active && styles.chipActive];
  const chipTextStyle = (active: boolean) => [
    styles.chipText,
    active && styles.chipTextActive,
  ];

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
          style={chipStyle(equipment === '')}
          onPress={() => setEquipment('')}
        >
          <Text style={chipTextStyle(equipment === '')}>All</Text>
        </TouchableOpacity>
        {equipmentList.map((eq) => (
          <TouchableOpacity
            key={eq}
            style={chipStyle(equipment === eq)}
            onPress={() => setEquipment(equipment === eq ? '' : eq)}
          >
            <Text style={chipTextStyle(equipment === eq)}>{eq}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.filterLabel}>Muscle</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        <TouchableOpacity
          style={chipStyle(muscle === '')}
          onPress={() => setMuscle('')}
        >
          <Text style={chipTextStyle(muscle === '')}>All</Text>
        </TouchableOpacity>
        {muscleList.map((m) => (
          <TouchableOpacity
            key={m}
            style={chipStyle(muscle === m)}
            onPress={() => setMuscle(muscle === m ? '' : m)}
          >
            <Text style={chipTextStyle(muscle === m)}>{m}</Text>
          </TouchableOpacity>
        ))}
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
    filterLabel: { fontSize: 13, fontWeight: '600', color: c.subtext, marginBottom: 4 },
    chipRow: { flexDirection: 'row', marginBottom: 8 },
    chip: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 12,
      paddingVertical: 5,
      marginRight: 6,
      backgroundColor: c.card,
    },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { color: c.subtext, fontSize: 13 },
    chipTextActive: { color: '#fff' },
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
