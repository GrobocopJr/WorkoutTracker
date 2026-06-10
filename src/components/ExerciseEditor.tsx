import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import {
  getEquipmentList,
  getMuscleList,
  createCustomExercise,
} from '../db/queries';
import { useColors } from '../theme';
import type { Colors } from '../theme';
import type { Exercise } from '../types';

interface ExerciseEditorProps {
  visible: boolean;
  initialName?: string;
  onClose: () => void;
  onCreated: (exercise: Exercise) => void;
}

export function ExerciseEditor({ visible, initialName, onClose, onCreated }: ExerciseEditorProps) {
  const db = useSQLiteContext();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [name, setName] = useState('');
  const [equipmentOptions, setEquipmentOptions] = useState<string[]>([]);
  const [muscleOptions, setMuscleOptions] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [muscles, setMuscles] = useState<string[]>([]);
  const [newEquip, setNewEquip] = useState('');
  const [newMuscle, setNewMuscle] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(initialName ?? '');
    setEquipment(null);
    setMuscles([]);
    setNewEquip('');
    setNewMuscle('');
    if (!loaded) {
      Promise.all([getEquipmentList(db), getMuscleList(db)]).then(([eq, mu]) => {
        setEquipmentOptions(eq);
        setMuscleOptions(mu);
        setLoaded(true);
      });
    }
  }, [visible, db, initialName, loaded]);

  const addEquipTag = () => {
    const t = newEquip.trim().toLowerCase();
    if (!t) return;
    if (!equipmentOptions.includes(t)) setEquipmentOptions((prev) => [...prev, t]);
    setEquipment(t);
    setNewEquip('');
  };

  const addMuscleTag = () => {
    const t = newMuscle.trim().toLowerCase();
    if (!t) return;
    if (!muscleOptions.includes(t)) setMuscleOptions((prev) => [...prev, t]);
    if (!muscles.includes(t)) setMuscles((prev) => [...prev, t]);
    setNewMuscle('');
  };

  const toggleMuscle = (m: string) =>
    setMuscles((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter a name for the exercise.');
      return;
    }
    const exercise = await createCustomExercise(db, {
      name: trimmed,
      equipment,
      category: null,
      primaryMuscles: muscles,
      secondaryMuscles: [],
    });
    onCreated(exercise);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>New Exercise</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color={c.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Close-Grip Bench Press"
            placeholderTextColor={c.placeholder}
            autoFocus={!initialName}
          />

          <Text style={styles.label}>Equipment</Text>
          <View style={styles.chipWrap}>
            {equipmentOptions.map((eq) => {
              const active = equipment === eq;
              return (
                <TouchableOpacity
                  key={eq}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setEquipment(active ? null : eq)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{eq}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              value={newEquip}
              onChangeText={setNewEquip}
              placeholder="Add equipment…"
              placeholderTextColor={c.placeholder}
              autoCapitalize="none"
              onSubmitEditing={addEquipTag}
            />
            <TouchableOpacity style={styles.addBtn} onPress={addEquipTag}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Muscle Groups</Text>
          <View style={styles.chipWrap}>
            {muscleOptions.map((m) => {
              const active = muscles.includes(m);
              return (
                <TouchableOpacity
                  key={m}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleMuscle(m)}
                >
                  {active && (
                    <Ionicons name="checkmark" size={12} color="#fff" style={styles.chipCheck} />
                  )}
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{m}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              value={newMuscle}
              onChangeText={setNewMuscle}
              placeholder="Add muscle group…"
              placeholderTextColor={c.placeholder}
              autoCapitalize="none"
              onSubmitEditing={addMuscleTag}
            />
            <TouchableOpacity style={styles.addBtn} onPress={addMuscleTag}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveText}>Save Exercise</Text>
          </TouchableOpacity>
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
      backgroundColor: c.card,
      borderBottomWidth: 1,
      borderBottomColor: c.borderLight,
    },
    title: { fontSize: 18, fontWeight: '700', color: c.text },
    content: { padding: 16, paddingBottom: 40 },
    label: {
      fontSize: 11,
      fontWeight: '700',
      color: c.muted,
      marginBottom: 8,
      marginTop: 14,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    input: {
      backgroundColor: c.inputBg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      fontSize: 15,
      color: c.text,
    },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: c.card,
    },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipCheck: { marginRight: 3 },
    chipText: { color: c.subtext, fontSize: 13, textTransform: 'capitalize' },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
    addInput: {
      flex: 1,
      backgroundColor: c.inputBg,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
      color: c.text,
    },
    addBtn: {
      backgroundColor: c.accent,
      borderRadius: 8,
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footer: {
      padding: 14,
      backgroundColor: c.card,
      borderTopWidth: 1,
      borderTopColor: c.borderLight,
    },
    saveBtn: {
      backgroundColor: c.accent,
      borderRadius: 10,
      padding: 14,
      alignItems: 'center',
    },
    saveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
}
