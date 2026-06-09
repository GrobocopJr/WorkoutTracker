import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getRoutineById,
  getRoutineExercises,
  updateRoutineName,
  removeExerciseFromRoutine,
  getExercises,
} from '../../src/db/queries';
import { addExerciseToRoutine } from '../../src/db/queries';
import { useColors } from '../../src/theme';
import type { Colors } from '../../src/theme';
import type { RoutineExercise, Exercise } from '../../src/types';

export default function RoutineEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const routineId = Number(id);
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const router = useRouter();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [name, setName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [exercises, setExercises] = useState<RoutineExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerExercises, setPickerExercises] = useState<Exercise[]>([]);

  const load = useCallback(async () => {
    const routine = await getRoutineById(db, routineId);
    const exs = await getRoutineExercises(db, routineId);
    if (routine) {
      setName(routine.name);
      navigation.setOptions({ title: routine.name });
    }
    setExercises(exs);
    setLoading(false);
  }, [db, routineId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await updateRoutineName(db, routineId, trimmed);
    navigation.setOptions({ title: trimmed });
    setEditingName(false);
  };

  const handleRemove = (item: RoutineExercise) => {
    Alert.alert('Remove Exercise', `Remove "${item.exercise_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeExerciseFromRoutine(db, item.id, routineId);
          load();
        },
      },
    ]);
  };

  const openPicker = async () => {
    const data = await getExercises(db, '', '', '');
    setPickerExercises(data);
    setPickerVisible(true);
  };

  const filterPicker = async (search: string) => {
    setPickerSearch(search);
    const data = await getExercises(db, search, '', '');
    setPickerExercises(data);
  };

  const handleAddExercise = async (exercise: Exercise) => {
    await addExerciseToRoutine(db, routineId, exercise.id);
    setPickerVisible(false);
    setPickerSearch('');
    load();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {editingName ? (
        <View style={styles.nameRow}>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            autoFocus
            onSubmitEditing={handleSaveName}
            placeholderTextColor={c.placeholder}
          />
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveName}>
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.nameRow} onPress={() => setEditingName(true)}>
          <Text style={styles.routineName}>{name}</Text>
          <Ionicons name="create-outline" size={20} color={c.muted} />
        </TouchableOpacity>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Exercises ({exercises.length})</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openPicker}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {exercises.length === 0 ? (
        <Text style={styles.empty}>No exercises yet. Tap Add to include some.</Text>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(e) => String(e.id)}
          renderItem={({ item, index }) => (
            <View style={styles.card}>
              <Text style={styles.pos}>{index + 1}</Text>
              <View style={styles.cardMain}>
                <Text style={styles.cardTitle}>{item.exercise_name}</Text>
                {item.equipment && (
                  <Text style={styles.cardSub}>{item.equipment}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => handleRemove(item)}>
                <Ionicons name="remove-circle-outline" size={24} color={c.danger} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <Modal visible={pickerVisible} animationType="slide">
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Add Exercise</Text>
            <TouchableOpacity onPress={() => { setPickerVisible(false); setPickerSearch(''); }}>
              <Ionicons name="close" size={26} color={c.text} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.pickerSearch}
            placeholder="Search..."
            placeholderTextColor={c.placeholder}
            value={pickerSearch}
            onChangeText={filterPicker}
            autoFocus
          />
          <FlatList
            data={pickerExercises}
            keyExtractor={(e) => e.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.pickerItem} onPress={() => handleAddExercise(item)}>
                <Text style={styles.pickerItemText}>{item.name}</Text>
                <Text style={styles.pickerItemSub}>{item.equipment ?? ''}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, padding: 16 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 20,
      backgroundColor: c.card,
      borderRadius: 10,
      padding: 14,
      elevation: 1,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    routineName: { flex: 1, fontSize: 18, fontWeight: '700', color: c.text },
    nameInput: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      borderBottomWidth: 2,
      borderBottomColor: c.accent,
      padding: 4,
      color: c.text,
    },
    saveBtn: {
      backgroundColor: c.accent,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    saveBtnText: { color: '#fff', fontWeight: '600' },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: c.accent,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    addBtnText: { color: '#fff', fontWeight: '600' },
    empty: { color: c.muted, textAlign: 'center', marginTop: 40 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 10,
      padding: 14,
      marginBottom: 8,
      elevation: 1,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    pos: { width: 28, fontSize: 14, fontWeight: '700', color: c.muted },
    cardMain: { flex: 1 },
    cardTitle: { fontSize: 15, fontWeight: '600', color: c.text },
    cardSub: { fontSize: 12, color: c.muted, textTransform: 'capitalize' },
    pickerContainer: { flex: 1, backgroundColor: c.bg },
    pickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: c.card,
      borderBottomWidth: 1,
      borderBottomColor: c.borderLight,
    },
    pickerTitle: { fontSize: 18, fontWeight: '700', color: c.text },
    pickerSearch: {
      margin: 12,
      backgroundColor: c.inputBg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      padding: 10,
      fontSize: 15,
      color: c.text,
    },
    pickerItem: {
      backgroundColor: c.card,
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
    },
    pickerItemText: { fontSize: 15, color: c.text },
    pickerItemSub: { fontSize: 12, color: c.muted, textTransform: 'capitalize' },
  });
}
