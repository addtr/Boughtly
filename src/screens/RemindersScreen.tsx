import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Reminders'>;

interface UpcomingReminder {
  id: string;
  title: string;
  body: string;
  /** When it fires; null for repeating interval reminders */
  fireAt: Date | null;
  /** For repeating reminders, the repeat interval in days */
  repeatDays: number | null;
}

/** Read the fire time out of the platform-specific trigger shape, defensively. */
function parseTrigger(trigger: unknown): { fireAt: Date | null; repeatDays: number | null } {
  const t = trigger as Record<string, any> | null;
  if (!t) return { fireAt: null, repeatDays: null };
  // Repeating interval (the price-check reminder)
  if (typeof t.seconds === 'number' && (t.repeats || t.type === 'timeInterval')) {
    return { fireAt: null, repeatDays: Math.round(t.seconds / 86400) };
  }
  // One-shot date triggers surface differently per platform/version
  const raw = t.value ?? t.date ?? t.timestamp;
  if (typeof raw === 'number') return { fireAt: new Date(raw), repeatDays: null };
  if (typeof raw === 'string') {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return { fireAt: d, repeatDays: null };
  }
  return { fireAt: null, repeatDays: null };
}

function formatFireAt(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function RemindersScreen(_props: Props) {
  const [reminders, setReminders] = useState<UpcomingReminder[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (Platform.OS === 'web') {
      setLoaded(true);
      return;
    }
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const list: UpcomingReminder[] = scheduled.map((n) => {
        const { fireAt, repeatDays } = parseTrigger(n.trigger);
        return {
          id: n.identifier,
          title: n.content.title ?? 'Reminder',
          body: n.content.body ?? '',
          fireAt,
          repeatDays,
        };
      });
      // Soonest first; repeating ones sink to the bottom.
      list.sort((a, b) => {
        if (a.fireAt && b.fireAt) return a.fireAt.getTime() - b.fireAt.getTime();
        if (a.fireAt) return -1;
        if (b.fireAt) return 1;
        return 0;
      });
      setReminders(list);
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Every nudge Boughtly has scheduled on this phone, soonest first. They update
        automatically as you add, edit, and return items.
      </Text>

      {Platform.OS === 'web' ? (
        <Card>
          <Text style={styles.emptyText}>
            Reminders live on your phone — open Boughtly there to see them.
          </Text>
        </Card>
      ) : !loaded ? null : reminders.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>
            Nothing scheduled right now. Reminders appear here once you track
            something with an upcoming deadline (and reminders are turned on).
          </Text>
        </Card>
      ) : (
        <Card style={styles.listCard}>
          {reminders.map((r, i) => (
            <View key={r.id} style={[styles.row, i > 0 && styles.rowDivider]}>
              <View style={styles.rowIcon}>
                <Ionicons
                  name={r.repeatDays ? 'repeat' : 'notifications-outline'}
                  size={17}
                  color={colors.primary}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {r.title}
                </Text>
                <Text style={styles.rowBody} numberOfLines={2}>
                  {r.body}
                </Text>
                <Text style={styles.rowWhen}>
                  {r.fireAt
                    ? formatFireAt(r.fireAt)
                    : r.repeatDays
                    ? `Repeats every ${r.repeatDays} day${r.repeatDays === 1 ? '' : 's'}`
                    : 'Scheduled'}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  intro: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  listCard: {
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 12,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.deepBlue,
  },
  rowBody: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
    lineHeight: 17,
  },
  rowWhen: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.primary,
    marginTop: 4,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
});
