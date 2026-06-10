import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import { getExercises, getEquipmentList, getMuscleList } from '../db/queries';
import { useColors } from '../theme';
import type { Colors } from '../theme';
import type { Exercise } from '../types';

interface ExercisePickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
}

export function ExercisePicker({ visible, onClose, onSelect }: ExercisePickerProps) {
  const db = useSQLiteContext();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [search, setSearch] = useState('');
  const [equipment, setEquipment] = useState('');
  const [muscles, setMuscles] = useState<string[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [equipmentList, setEquipmentList] = useState<string[]>([]);
  const [muscleList, setMuscleList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  // Load filter option lists once on first open
  useEffect(() => {
    if (visible && !filtersLoaded) {
      Promise.all([getEquipmentList(db), getMuscleList(db)]).then(([eq, mu]) => {
        setEquipmentList(eq);
        setMuscleList(mu);
        setFiltersLoaded(true);
      });
    }
  }, [visible, db, filtersLoaded]);

  // Re-query exercises whenever any filter changes
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    getExercises(db, search, equipment, muscles).then((data) => {
      if (!cancelled) {
        setExercises(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [visible, search, equipment, muscles, db]);

  const handleClose = () => {
    setSearch('');
    setEquipment('');
    setMuscles([]);
    onClose();
  };

  const toggleMuscle = (m: string) =>
    setMuscles((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Add Exercise</Text>
          <TouchableOpacity onPress={handleClose} hitSlop={12}>
            <Ionicons name="close" size={26} color={c.text} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <TextInput
          style={styles.search}
          placeholder="Search exercises..."
          placeholderTextColor={c.placeholder}
          value={search}
          onChangeText={setSearch}
          autoFocus
          clearButtonMode="while-editing"
        />

        {/* Equipment filter — single select */}
        <Text style={styles.filterLabel}>Equipment</Text>
        <View style={styles.chipRowWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRowContent}
          >
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
                onPress={() => setEquipment((prev) => prev === eq ? '' : eq)}
              >
                <Text style={[styles.chipText, equipment === eq && styles.chipTextActive]}>
                  {eq}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Muscle filter — multi-select */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Muscle Group</Text>
          {muscles.length > 0 && (
            <TouchableOpacity onPress={() => setMuscles([])}>
              <Text style={styles.clearBtn}>Clear {muscles.length}</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.chipRowWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRowContent}
          >
            {muscleList.map((m) => {
              const active = muscles.includes(m);
              return (
                <TouchableOpacity
                  key={m}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleMuscle(m)}
                >
                  {active && (
                    <Ionicons
                      name="checkmark"
                      size={11}
                      color="#fff"
                      style={styles.chipCheck}
                    />
                  )}
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{m}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Results — flex:1 so this is the only child that grows */}
        <View style={styles.results}>
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={c.accent} />
            </View>
          ) : (
            <FlatList
              data={exercises}
              keyExtractor={(e) => e.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.item} onPress={() => onSelect(item)}>
                  <View style={styles.itemMain}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemSub} numberOfLines={1}>
                      {[item.equipment, item.category].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color={c.accent} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.empty}>No exercises found.</Text>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      paddingBottom: 12,
      backgroundColor: c.card,
      borderBottomWidth: 1,
      borderBottomColor: c.borderLight,
    },
    title: { fontSize: 18, fontWeight: '700', color: c.text },
    search: {
      margin: 12,
      marginBottom: 6,
      backgroundColor: c.inputBg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      padding: 10,
      fontSize: 15,
      color: c.text,
    },
    filterLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.muted,
      marginLeft: 12,
      marginBottom: 5,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    filterRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingRight: 12,
    },
    clearBtn: { fontSize: 12, color: c.accent, fontWeight: '600' },
    chipRowWrap: { height: 32, marginBottom: 8 },
    chipRowContent: { paddingHorizontal: 12, gap: 6, alignItems: 'center' },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 11,
      paddingVertical: 5,
      backgroundColor: c.card,
    },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipCheck: { marginRight: 3 },
    chipText: { color: c.subtext, fontSize: 13, lineHeight: 18, textTransform: 'capitalize' },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    results: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
    },
    itemMain: { flex: 1 },
    itemName: { fontSize: 15, fontWeight: '600', color: c.text },
    itemSub: { fontSize: 12, color: c.muted, marginTop: 2, textTransform: 'capitalize' },
    empty: { color: c.muted, textAlign: 'center', marginTop: 40 },
  });
}
