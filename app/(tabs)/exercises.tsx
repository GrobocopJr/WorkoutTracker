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
import {
  getExercises,
  getEquipmentList,
  getMuscleList,
  getFavorites,
  setFavorites,
  orderByFavorites,
  orderExercisesByFavorites,
} from '../../src/db/queries';
import { ExerciseEditor } from '../../src/components/ExerciseEditor';
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

  // Type-to-filter the equipment / muscle chips
  const [equipFilter, setEquipFilter] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('');
  const [showEquipSearch, setShowEquipSearch] = useState(false);
  const [showMuscleSearch, setShowMuscleSearch] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);

  // Favorited chips (long-press to toggle) float to the front of each list
  const [favEquip, setFavEquip] = useState<string[]>([]);
  const [favMuscle, setFavMuscle] = useState<string[]>([]);
  const [favExercises, setFavExercises] = useState<string[]>([]);

  const shownEquip = orderByFavorites(equipmentList, favEquip).filter((e) =>
    e.toLowerCase().includes(equipFilter.trim().toLowerCase())
  );
  const shownMuscles = orderByFavorites(muscleList, favMuscle).filter((m) =>
    m.toLowerCase().includes(muscleFilter.trim().toLowerCase())
  );

  const toggleEquipFav = (eq: string) =>
    setFavEquip((prev) => {
      const next = prev.includes(eq) ? prev.filter((x) => x !== eq) : [...prev, eq];
      void setFavorites(db, 'fav_equipment', next);
      return next;
    });

  const toggleMuscleFav = (m: string) =>
    setFavMuscle((prev) => {
      const next = prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m];
      void setFavorites(db, 'fav_muscle', next);
      return next;
    });

  const toggleExerciseFav = (id: string) =>
    setFavExercises((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      void setFavorites(db, 'fav_exercises', next);
      return next;
    });

  const loadFilters = useCallback(async () => {
    const [eq, mu, fe, fm, fx] = await Promise.all([
      getEquipmentList(db),
      getMuscleList(db),
      getFavorites(db, 'fav_equipment'),
      getFavorites(db, 'fav_muscle'),
      getFavorites(db, 'fav_exercises'),
    ]);
    setEquipmentList(eq);
    setMuscleList(mu);
    setFavEquip(fe);
    setFavMuscle(fm);
    setFavExercises(fx);
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
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.searchInput, styles.searchInputFlex]}
          placeholder="Search exercises..."
          placeholderTextColor={c.placeholder}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          onSubmitEditing={loadExercises}
          clearButtonMode="while-editing"
        />
        <TouchableOpacity style={styles.newBtn} onPress={() => setEditorVisible(true)}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.newBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Equipment</Text>
        <TouchableOpacity
          onPress={() => { setShowEquipSearch((v) => !v); setEquipFilter(''); }}
          hitSlop={8}
        >
          <Ionicons name={showEquipSearch ? 'close' : 'search'} size={16} color={c.accent} />
        </TouchableOpacity>
      </View>
      {showEquipSearch && (
        <TextInput
          style={styles.filterSearch}
          value={equipFilter}
          onChangeText={setEquipFilter}
          placeholder="Filter equipment…"
          placeholderTextColor={c.placeholder}
          autoFocus
          autoCapitalize="none"
        />
      )}
      <View style={styles.chipRowWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRowContent}
        >
          {equipFilter.trim() === '' && (
            <TouchableOpacity
              style={[styles.chip, equipment === '' && styles.chipActive]}
              onPress={() => setEquipment('')}
            >
              <Text style={[styles.chipText, equipment === '' && styles.chipTextActive]}>All</Text>
            </TouchableOpacity>
          )}
          {shownEquip.map((eq) => {
            const fav = favEquip.includes(eq);
            const active = equipment === eq;
            return (
              <TouchableOpacity
                key={eq}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setEquipment(active ? '' : eq)}
                onLongPress={() => toggleEquipFav(eq)}
                delayLongPress={300}
              >
                {fav && (
                  <Ionicons
                    name="star"
                    size={10}
                    color={active ? '#fff' : c.accent}
                    style={styles.chipStar}
                  />
                )}
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{eq}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Muscle Group</Text>
        <View style={styles.filterRowRight}>
          {muscles.length > 0 && (
            <TouchableOpacity onPress={() => setMuscles([])}>
              <Text style={styles.clearBtn}>Clear {muscles.length}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => { setShowMuscleSearch((v) => !v); setMuscleFilter(''); }}
            hitSlop={8}
          >
            <Ionicons name={showMuscleSearch ? 'close' : 'search'} size={16} color={c.accent} />
          </TouchableOpacity>
        </View>
      </View>
      {showMuscleSearch && (
        <TextInput
          style={styles.filterSearch}
          value={muscleFilter}
          onChangeText={setMuscleFilter}
          placeholder="Filter muscles…"
          placeholderTextColor={c.placeholder}
          autoFocus
          autoCapitalize="none"
        />
      )}
      <View style={styles.chipRowWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRowContent}
        >
          {shownMuscles.map((m) => {
            const active = muscles.includes(m);
            const fav = favMuscle.includes(m);
            return (
              <TouchableOpacity
                key={m}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleMuscle(m)}
                onLongPress={() => toggleMuscleFav(m)}
                delayLongPress={300}
              >
                {active ? (
                  <Ionicons name="checkmark" size={11} color="#fff" style={styles.chipCheck} />
                ) : (
                  fav && <Ionicons name="star" size={10} color={c.accent} style={styles.chipStar} />
                )}
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{m}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.results}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={c.accent} />
          </View>
        ) : (
          <FlatList
            data={orderExercisesByFavorites(exercises, favExercises)}
            keyExtractor={(ex) => ex.id}
            renderItem={({ item }) => {
              const fav = favExercises.includes(item.id);
              return (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => router.push(`/exercises/${item.id}`)}
                  onLongPress={() => toggleExerciseFav(item.id)}
                  delayLongPress={300}
                >
                  <View style={styles.cardTitleRow}>
                    {fav && (
                      <Ionicons name="star" size={12} color={c.accent} style={styles.cardStar} />
                    )}
                    <Text style={styles.cardTitle}>{item.name}</Text>
                  </View>
                  <Text style={styles.cardSub}>
                    {[item.equipment, item.category].filter(Boolean).join(' · ')}
                  </Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.empty}>No exercises found.</Text>
            }
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}
      </View>

      <ExerciseEditor
        visible={editorVisible}
        onClose={() => setEditorVisible(false)}
        onCreated={(ex) => {
          setEditorVisible(false);
          void loadFilters();
          void loadExercises();
          router.push(`/exercises/${ex.id}`);
        }}
      />
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, padding: 12 },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
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
    searchInputFlex: { flex: 1, marginBottom: 0 },
    newBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      backgroundColor: c.accent,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    newBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    filterLabel: { fontSize: 11, fontWeight: '700', color: c.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.6 },
    filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 4 },
    filterRowRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    filterSearch: {
      backgroundColor: c.inputBg,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 14,
      marginBottom: 6,
      color: c.text,
    },
    clearBtn: { fontSize: 12, color: c.accent, fontWeight: '600' },
    chipRowWrap: { height: 32, marginBottom: 8 },
    chipRowContent: { paddingHorizontal: 4, alignItems: 'center' },
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
    chipStar: { marginRight: 3 },
    chipText: { color: c.subtext, fontSize: 13, lineHeight: 18, textTransform: 'capitalize' },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    results: { flex: 1 },
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
    cardTitleRow: { flexDirection: 'row', alignItems: 'center' },
    cardStar: { marginRight: 4 },
    cardTitle: { fontSize: 15, fontWeight: '600', color: c.text },
    cardSub: { fontSize: 12, color: c.muted, marginTop: 2, textTransform: 'capitalize' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 },
    empty: { color: c.muted, textAlign: 'center', marginTop: 40 },
  });
}
