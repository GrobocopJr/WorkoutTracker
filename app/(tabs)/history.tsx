import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  useColorScheme,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import {
  getSessionDates,
  getSessionsForDate,
  getSessionDetail,
  renameSession,
  saveSessionNote,
  deleteSession,
  getSetting,
} from '../../src/db/queries';
import { useColors } from '../../src/theme';
import type { Colors } from '../../src/theme';
import type { Session } from '../../src/types';

interface SetDetail {
  exercise_id: string;
  exercise_name: string;
  set_number: number;
  weight: number;
  reps: number;
}

interface SessionWithSets {
  session: Session;
  sets: SetDetail[];
}

function formatDuration(startedAt: string, endedAt: string | null): string | null {
  if (!endedAt) return null;
  const start = new Date(startedAt.replace(' ', 'T') + 'Z');
  const end = new Date(endedAt.replace(' ', 'T') + 'Z');
  const secs = Math.floor((end.getTime() - start.getTime()) / 1000);
  if (secs <= 0) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// SQLite datetime('now') is UTC ('YYYY-MM-DD HH:MM:SS'); show it in Chicago time.
function formatChicagoTime(utc: string | null): string {
  if (!utc) return '';
  const d = new Date(utc.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return utc.slice(11, 16);
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    // Fallback if the runtime lacks time-zone data: fixed CDT (UTC-5).
    const cdt = new Date(d.getTime() - 5 * 60 * 60 * 1000);
    const hh = cdt.getUTCHours();
    const mm = cdt.getUTCMinutes().toString().padStart(2, '0');
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${h12}:${mm} ${ampm}`;
  }
}

export default function HistoryTab() {
  const db = useSQLiteContext();
  const router = useRouter();
  const scheme = useColorScheme();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [markedDates, setMarkedDates] = useState<Record<string, { marked: boolean; dotColor: string }>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SessionWithSets[]>([]);
  const [loading, setLoading] = useState(true);
  const [renameTarget, setRenameTarget] = useState<Session | null>(null);
  const [renameText, setRenameText] = useState('');
  const [noteTarget, setNoteTarget] = useState<Session | null>(null);
  const [noteText, setNoteText] = useState('');
  const [units, setUnits] = useState('lbs');

  const loadDay = useCallback(
    async (date: string) => {
      const sessions = await getSessionsForDate(db, date);
      const details = await Promise.all(
        sessions.map(async (s) => ({ session: s, sets: await getSessionDetail(db, s.id) }))
      );
      setSessionDetails(details);
    },
    [db]
  );

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    const [dates, u] = await Promise.all([
      getSessionDates(db),
      getSetting(db, 'units'),
    ]);
    if (u) setUnits(u);
    const marks: Record<string, { marked: boolean; dotColor: string }> = {};
    for (const d of dates) {
      marks[d] = { marked: true, dotColor: c.accent };
    }
    setMarkedDates(marks);
    // Auto-select today so the day's sessions are visible on open.
    const today = new Date().toLocaleDateString('en-CA');
    setSelectedDate(today);
    await loadDay(today);
    setLoading(false);
  }, [db, c.accent, loadDay]);

  useFocusEffect(useCallback(() => { void loadCalendar(); }, [loadCalendar]));

  const handleDayPress = async (day: { dateString: string }) => {
    setSelectedDate(day.dateString);
    await loadDay(day.dateString);
  };

  const handleDelete = (session: Session) => {
    Alert.alert(
      'Delete Workout',
      'Delete this workout and all of its logged sets? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSession(db, session.id);
            if (selectedDate) await loadDay(selectedDate);
            await loadCalendar();
          },
        },
      ]
    );
  };

  const openRename = (session: Session) => {
    setRenameTarget(session);
    setRenameText(session.name ?? '');
  };

  const handleSaveRename = async () => {
    if (!renameTarget) return;
    await renameSession(db, renameTarget.id, renameText);
    setRenameTarget(null);
    setRenameText('');
    if (selectedDate) await loadDay(selectedDate);
  };

  const openNoteEdit = (session: Session) => {
    setNoteTarget(session);
    setNoteText(session.notes ?? '');
  };

  const handleSaveNote = async () => {
    if (!noteTarget) return;
    await saveSessionNote(db, noteTarget.id, noteText);
    setNoteTarget(null);
    setNoteText('');
    if (selectedDate) await loadDay(selectedDate);
  };

  const calendarMarks = selectedDate
    ? {
        ...markedDates,
        [selectedDate]: {
          ...(markedDates[selectedDate] ?? {}),
          selected: true,
          selectedColor: c.accent,
        },
      }
    : markedDates;

  const calendarTheme = {
    backgroundColor: c.card,
    calendarBackground: c.card,
    textSectionTitleColor: c.muted,
    dayTextColor: c.text,
    todayTextColor: c.accent,
    selectedDayTextColor: '#fff',
    selectedDayBackgroundColor: c.accent,
    arrowColor: c.accent,
    monthTextColor: c.text,
    textDisabledColor: c.placeholder,
    dotColor: c.accent,
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Calendar
        markedDates={calendarMarks}
        onDayPress={handleDayPress}
        theme={calendarTheme}
        key={scheme}
      />

      {selectedDate && (
        <View style={styles.detail}>
          <Text style={styles.dateTitle}>{selectedDate}</Text>
          {sessionDetails.length === 0 ? (
            <Text style={styles.empty}>No workouts on this day.</Text>
          ) : (
            sessionDetails.map(({ session, sets }) => {
              const volume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
              return (
              <View key={session.id} style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                  <TouchableOpacity
                    style={styles.sessionHeaderMain}
                    onPress={() => router.push({
                      pathname: '/workout/summary',
                      params: { sessionId: String(session.id) },
                    } as any)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.sessionName}>
                      {session.name?.trim() || 'Workout'}
                    </Text>
                    <View style={styles.sessionMeta}>
                      <Text style={styles.sessionTime}>
                        {formatChicagoTime(session.started_at)}
                        {session.ended_at ? ` – ${formatChicagoTime(session.ended_at)}` : ''}
                      </Text>
                      {formatDuration(session.started_at, session.ended_at) && (
                        <>
                          <Text style={styles.sessionMetaDot}>·</Text>
                          <Ionicons name="time-outline" size={12} color={c.muted} />
                          <Text style={styles.sessionTime}>
                            {formatDuration(session.started_at, session.ended_at)}
                          </Text>
                        </>
                      )}
                      {volume > 0 && (
                        <>
                          <Text style={styles.sessionMetaDot}>·</Text>
                          <Ionicons name="barbell-outline" size={12} color={c.muted} />
                          <Text style={styles.sessionTime}>
                            {volume.toLocaleString()} {units}
                          </Text>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openNoteEdit(session)} hitSlop={8} style={styles.iconBtn}>
                    <Ionicons name="document-text-outline" size={20} color={session.notes ? c.accent : c.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openRename(session)} hitSlop={8} style={styles.iconBtn}>
                    <Ionicons name="create-outline" size={20} color={c.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(session)} hitSlop={8} style={styles.iconBtn}>
                    <Ionicons name="trash-outline" size={20} color={c.danger} />
                  </TouchableOpacity>
                </View>

                {groupSetsByExercise(sets).map(({ name, id, rows }) => (
                  <View key={name} style={styles.exerciseBlock}>
                    <TouchableOpacity
                      onPress={() => router.push(`/exercises/${id}` as any)}
                      hitSlop={4}
                    >
                      <Text style={[styles.exerciseName, styles.exerciseNameLink]}>{name}</Text>
                    </TouchableOpacity>
                    {rows.map((s) => (
                      <Text key={s.set_number} style={styles.setRow}>
                        Set {s.set_number}: {s.weight} × {s.reps} reps
                      </Text>
                    ))}
                  </View>
                ))}
                {sets.length === 0 && (
                  <Text style={styles.empty}>No sets logged.</Text>
                )}
                {session.notes ? (
                  <TouchableOpacity onPress={() => openNoteEdit(session)} style={styles.noteRow}>
                    <Ionicons name="document-text-outline" size={13} color={c.muted} />
                    <Text style={styles.noteText}>{session.notes}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              );
            })
          )}
        </View>
      )}

      <Modal
        visible={renameTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename Workout</Text>
            <TextInput
              style={styles.modalInput}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="Workout name"
              placeholderTextColor={c.placeholder}
              autoFocus
              onSubmitEditing={handleSaveRename}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setRenameTarget(null)} style={styles.modalBtn}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveRename} style={[styles.modalBtn, styles.modalSaveBtn]}>
                <Text style={styles.modalSave}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={noteTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setNoteTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Session Note</Text>
            <TextInput
              style={[styles.modalInput, styles.modalNoteInput]}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="How did this session go?"
              placeholderTextColor={c.placeholder}
              autoFocus
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setNoteTarget(null)} style={styles.modalBtn}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveNote} style={[styles.modalBtn, styles.modalSaveBtn]}>
                <Text style={styles.modalSave}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function groupSetsByExercise(sets: SetDetail[]) {
  const map = new Map<string, { id: string; rows: SetDetail[] }>();
  for (const s of sets) {
    const entry = map.get(s.exercise_name) ?? { id: s.exercise_id, rows: [] };
    entry.rows.push(s);
    map.set(s.exercise_name, entry);
  }
  return Array.from(map.entries()).map(([name, { id, rows }]) => ({ name, id, rows }));
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    detail: { padding: 16 },
    dateTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 10 },
    empty: { color: c.muted, textAlign: 'center', marginTop: 10 },
    sessionCard: {
      backgroundColor: c.card,
      borderRadius: 10,
      padding: 14,
      marginBottom: 12,
      elevation: 1,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    sessionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    sessionHeaderMain: { flex: 1 },
    sessionName: { fontSize: 15, fontWeight: '700', color: c.text },
    sessionMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' },
    sessionMetaDot: { fontSize: 13, color: c.muted },
    sessionTime: { fontSize: 13, color: c.muted },
    iconBtn: { paddingHorizontal: 6 },
    exerciseBlock: { marginBottom: 8 },
    exerciseName: { fontSize: 15, fontWeight: '600', color: c.text, marginBottom: 2 },
    exerciseNameLink: { color: c.accent },
    setRow: { fontSize: 13, color: c.subtext, marginLeft: 8 },
    noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.borderLight },
    noteText: { flex: 1, fontSize: 13, color: c.muted, fontStyle: 'italic', lineHeight: 18 },
    modalNoteInput: { minHeight: 100, textAlignVertical: 'top' },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: 24,
    },
    modalCard: {
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 18,
    },
    modalTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 12 },
    modalInput: {
      backgroundColor: c.inputBg,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      padding: 10,
      fontSize: 15,
      color: c.text,
    },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
    modalBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
    modalSaveBtn: { backgroundColor: c.accent },
    modalCancel: { color: c.muted, fontWeight: '600' },
    modalSave: { color: '#fff', fontWeight: '700' },
  });
}
