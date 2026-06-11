import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../theme';
import type { Colors } from '../theme';

const PLATES_LBS = [45, 35, 25, 10, 5, 2.5];
const PLATES_KG = [20, 15, 10, 5, 2.5, 1.25];
const BAR_LBS = 45;
const BAR_KG = 20;

function plateColor(weight: number, units: string): string {
  if (units === 'lbs') {
    if (weight === 45) return '#EF4444';
    if (weight === 35) return '#EAB308';
    if (weight === 25) return '#22C55E';
    if (weight === 10) return '#D1D5DB';
    if (weight === 5) return '#3B82F6';
    return '#6B7280';
  } else {
    if (weight === 20) return '#EF4444';
    if (weight === 15) return '#EAB308';
    if (weight === 10) return '#22C55E';
    if (weight === 5) return '#D1D5DB';
    if (weight === 2.5) return '#3B82F6';
    return '#6B7280';
  }
}

interface PlateResult {
  plates: { weight: number; count: number }[];
  remainder: number;
}

function calcPlates(targetWeight: number, barWeight: number, units: string): PlateResult {
  const available = units === 'lbs' ? PLATES_LBS : PLATES_KG;
  const plates: { weight: number; count: number }[] = [];
  let remaining = (targetWeight - barWeight) / 2;

  for (const plate of available) {
    const count = Math.floor(remaining / plate + 0.0001);
    if (count > 0) {
      plates.push({ weight: plate, count });
      remaining -= count * plate;
      remaining = Math.round(remaining * 10000) / 10000;
    }
  }

  return { plates, remainder: remaining };
}

interface Props {
  visible: boolean;
  initialWeight: string;
  units: string;
  onApply: (weight: string) => void;
  onClose: () => void;
}

export function PlateCalculator({ visible, initialWeight, units, onApply, onClose }: Props) {
  const c = useColors();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c, bottomInset), [c, bottomInset]);
  const [weightText, setWeightText] = useState(initialWeight);
  const defaultBar = units === 'lbs' ? BAR_LBS : BAR_KG;
  const [barText, setBarText] = useState(String(defaultBar));

  const barWeight = parseFloat(barText);
  const effectiveBar = isNaN(barWeight) || barWeight < 0 ? defaultBar : barWeight;
  const target = parseFloat(weightText);
  const valid = !isNaN(target) && target > effectiveBar;
  const result = valid ? calcPlates(target, effectiveBar, units) : null;
  const isExact = result ? result.remainder < 0.01 : false;
  const weightPerSide = valid ? (target - effectiveBar) / 2 : null;

  const loadedTotal = result
    ? effectiveBar + result.plates.reduce((s, p) => s + p.weight * p.count * 2, 0)
    : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Plate Calculator</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={c.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.inputRow}>
              <TextInput
                style={styles.weightInput}
                value={weightText}
                onChangeText={setWeightText}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={c.placeholder}
                selectTextOnFocus
                autoFocus
              />
              <Text style={styles.unitLabel}>{units}</Text>
            </View>

            <View style={styles.barRow}>
              <Text style={styles.barLabel}>Bar weight</Text>
              <TextInput
                style={styles.barInput}
                value={barText}
                onChangeText={setBarText}
                keyboardType="decimal-pad"
                placeholder={String(defaultBar)}
                placeholderTextColor={c.placeholder}
                selectTextOnFocus
              />
              <Text style={styles.barUnit}>{units}</Text>
            </View>

            {!isNaN(target) && target > 0 && target <= effectiveBar && (
              <Text style={styles.error}>
                Weight must exceed the bar ({effectiveBar} {units})
              </Text>
            )}

            {result && (
              <View style={styles.results}>
                <Text style={styles.sideLabel}>
                  Each side: {weightPerSide} {units}
                </Text>

                {result.plates.length === 0 && isExact ? (
                  <Text style={styles.noPlates}>No plates — bar only</Text>
                ) : (
                  result.plates.map(({ weight, count }) => (
                    <View key={weight} style={styles.plateRow}>
                      <View
                        style={[styles.plateDot, { backgroundColor: plateColor(weight, units) }]}
                      />
                      <Text style={styles.plateText}>
                        {count} × {weight} {units}
                      </Text>
                    </View>
                  ))
                )}

                {!isExact && (
                  <Text style={styles.remainder}>
                    {'⚠'} {result.remainder.toFixed(2)} {units} remainder — not achievable with standard plates
                  </Text>
                )}

                <View style={styles.totalRow}>
                  <Ionicons
                    name={isExact ? 'checkmark-circle' : 'alert-circle'}
                    size={16}
                    color={isExact ? c.success : c.danger}
                  />
                  <Text style={[styles.total, isExact ? styles.totalOk : styles.totalWarn]}>
                    Loads {loadedTotal} {units}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={() => { onApply(weightText); onClose(); }}
            >
              <Text style={styles.applyText}>Load into Set</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => setWeightText('')}
            >
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: Colors, bottomInset: number) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: c.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 12,
      paddingHorizontal: 20,
      maxHeight: '75%',
    },
    scrollContent: {
      paddingBottom: 8,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      alignSelf: 'center',
      marginBottom: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: c.text,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 6,
    },
    weightInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 28,
      fontWeight: '700',
      textAlign: 'center',
      backgroundColor: c.inputBg,
      color: c.text,
    },
    unitLabel: {
      fontSize: 18,
      color: c.muted,
      fontWeight: '600',
      width: 36,
    },
    barRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
    },
    barLabel: {
      fontSize: 13,
      color: c.muted,
      flex: 1,
    },
    barInput: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 10,
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
      backgroundColor: c.inputBg,
      color: c.text,
      width: 70,
    },
    barUnit: {
      fontSize: 13,
      color: c.muted,
      width: 28,
    },
    error: {
      color: c.danger,
      fontSize: 14,
      marginBottom: 8,
    },
    results: {
      borderTopWidth: 1,
      borderTopColor: c.borderLight,
      paddingTop: 14,
      gap: 8,
    },
    sideLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: c.text,
      marginBottom: 4,
    },
    noPlates: {
      color: c.muted,
      fontSize: 14,
    },
    plateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    plateDot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.1)',
    },
    plateText: {
      fontSize: 16,
      color: c.text,
      fontWeight: '500',
    },
    remainder: {
      color: c.danger,
      fontSize: 13,
    },
    totalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
    },
    total: {
      fontSize: 15,
      fontWeight: '700',
    },
    totalOk: {
      color: c.success,
    },
    totalWarn: {
      color: c.danger,
    },
    actions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 12,
      paddingBottom: Math.max(bottomInset, 16),
    },
    applyBtn: {
      flex: 1,
      backgroundColor: c.accent,
      borderRadius: 10,
      padding: 14,
      alignItems: 'center',
    },
    applyText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 15,
    },
    clearBtn: {
      flex: 1,
      backgroundColor: c.danger,
      borderRadius: 10,
      padding: 14,
      alignItems: 'center',
    },
    clearText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 15,
    },
  });
}
