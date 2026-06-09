import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';
import { getSetting, setSetting } from '../../src/db/queries';
import { useWorkoutStore } from '../../src/store/workoutStore';
import { useThemeStore } from '../../src/store/themeStore';
import { useColors } from '../../src/theme';
import type { Colors } from '../../src/theme';
import type { ThemeMode } from '../../src/store/themeStore';
import type { Units } from '../../src/types';

export default function SettingsTab() {
  const db = useSQLiteContext();
  const { setTimerDefault } = useWorkoutStore();
  const { theme, setTheme } = useThemeStore();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [units, setUnits] = useState<Units>('lbs');
  const [restSeconds, setRestSeconds] = useState('90');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const u = await getSetting(db, 'units');
    const r = await getSetting(db, 'default_rest_seconds');
    if (u) setUnits(u as Units);
    if (r) {
      setRestSeconds(r);
      setTimerDefault(Number(r));
    }
    setLoading(false);
  }, [db, setTimerDefault]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleUnitsChange = async (newUnits: Units) => {
    setUnits(newUnits);
    await setSetting(db, 'units', newUnits);
  };

  const handleRestChange = async (val: string) => {
    setRestSeconds(val);
    const num = Number(val);
    if (!isNaN(num) && num > 0) {
      await setSetting(db, 'default_rest_seconds', String(num));
      setTimerDefault(num);
    }
  };

  const handleThemeChange = async (mode: ThemeMode) => {
    setTheme(mode);
    await setSetting(db, 'theme', mode);
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
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.toggle}>
          {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.toggleBtn, theme === mode && styles.toggleActive]}
              onPress={() => handleThemeChange(mode)}
            >
              <Text style={[styles.toggleText, theme === mode && styles.toggleTextActive]}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weight Units</Text>
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, units === 'lbs' && styles.toggleActive]}
            onPress={() => handleUnitsChange('lbs')}
          >
            <Text style={[styles.toggleText, units === 'lbs' && styles.toggleTextActive]}>
              lbs
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, units === 'kg' && styles.toggleActive]}
            onPress={() => handleUnitsChange('kg')}
          >
            <Text style={[styles.toggleText, units === 'kg' && styles.toggleTextActive]}>
              kg
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Default Rest Timer</Text>
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={restSeconds}
            onChangeText={handleRestChange}
            keyboardType="number-pad"
            maxLength={4}
            placeholderTextColor={c.placeholder}
          />
          <Text style={styles.inputLabel}>seconds</Text>
        </View>
        <View style={styles.presets}>
          {[30, 60, 90, 120, 180].map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.presetBtn,
                restSeconds === String(s) && styles.presetActive,
              ]}
              onPress={() => handleRestChange(String(s))}
            >
              <Text
                style={[
                  styles.presetText,
                  restSeconds === String(s) && styles.presetTextActive,
                ]}
              >
                {s}s
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, padding: 16 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    section: {
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      elevation: 1,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 12 },
    toggle: { flexDirection: 'row', gap: 8 },
    toggleBtn: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
    },
    toggleActive: { backgroundColor: c.accent, borderColor: c.accent },
    toggleText: { fontSize: 16, fontWeight: '600', color: c.subtext },
    toggleTextActive: { color: '#fff' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      padding: 10,
      fontSize: 18,
      fontWeight: '700',
      width: 80,
      textAlign: 'center',
      backgroundColor: c.inputBg,
      color: c.text,
    },
    inputLabel: { fontSize: 15, color: c.muted },
    presets: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    presetBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.inputBg,
    },
    presetActive: { backgroundColor: c.accentFaded, borderColor: c.accent },
    presetText: { fontSize: 13, color: c.subtext },
    presetTextActive: { color: c.accentFadedText, fontWeight: '600' },
  });
}
