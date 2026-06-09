import { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, useColorScheme } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import { getSessionDates, getSessionsForDate, getSessionDetail } from '../../src/db/queries';
import { useColors } from '../../src/theme';
import type { Colors } from '../../src/theme';
import type { Session } from '../../src/types';

interface SetDetail {
  exercise_name: string;
  set_number: number;
  weight: number;
  reps: number;
}

interface SessionWithSets {
  session: Session;
  sets: SetDetail[];
}

export default function HistoryTab() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [markedDates, setMarkedDates] = useState<Record<string, { marked: boolean; dotColor: string }>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SessionWithSets[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    const dates = await getSessionDates(db);
    const marks: Record<string, { marked: boolean; dotColor: string }> = {};
    for (const d of dates) {
      marks[d] = { marked: true, dotColor: c.accent };
    }
    setMarkedDates(marks);
    setLoading(false);
  }, [db, c.accent]);

  useFocusEffect(useCallback(() => { void loadCalendar(); }, [loadCalendar]));

  const handleDayPress = async (day: { dateString: string }) => {
    const date = day.dateString;
    setSelectedDate(date);
    const sessions = await getSessionsForDate(db, date);
    const details: SessionWithSets[] = [];
    for (const s of sessions) {
      const sets = await getSessionDetail(db, s.id);
      details.push({ session: s, sets });
    }
    setSessionDetails(details);
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
            sessionDetails.map(({ session, sets }) => (
              <View key={session.id} style={styles.sessionCard}>
                <Text style={styles.sessionTime}>
                  {session.started_at.slice(11, 16)}
                  {session.ended_at ? ` – ${session.ended_at.slice(11, 16)}` : ''}
                </Text>
                {groupSetsByExercise(sets).map(({ name, rows }) => (
                  <View key={name} style={styles.exerciseBlock}>
                    <Text style={styles.exerciseName}>{name}</Text>
                    {rows.map((s) => (
                      <Text key={s.set_number} style={styles.setRow}>
                        Set {s.set_number}: {s.weight} × {s.reps} reps
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

function groupSetsByExercise(sets: SetDetail[]) {
  const map = new Map<string, SetDetail[]>();
  for (const s of sets) {
    const arr = map.get(s.exercise_name) ?? [];
    arr.push(s);
    map.set(s.exercise_name, arr);
  }
  return Array.from(map.entries()).map(([name, rows]) => ({ name, rows }));
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
    sessionTime: { fontSize: 13, color: c.muted, marginBottom: 8 },
    exerciseBlock: { marginBottom: 8 },
    exerciseName: { fontSize: 15, fontWeight: '600', color: c.text, marginBottom: 2 },
    setRow: { fontSize: 13, color: c.subtext, marginLeft: 8 },
  });
}
