import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../theme/ThemeContext';
import { FastingSession, FastingPlan } from '../models/index';
import { ALL_PREDEFINED_PLANS } from '../models/plans';
import { verifiedSessions } from '../domain/fastingTimer';
import { recomputeStreaks, isQualifyingFast } from '../domain/streakEngine';
import { getSubscriptionStatus, hasProAccess } from '../domain/subscriptionManager';
import { getItem } from '../data/localStorage';
import { STORAGE_KEYS } from '../utils/constants';

// ─── Types ───────────────────────────────────────────────────────────────────

type DayStatus = 'qualifying' | 'started' | 'unmarked';

interface CalendarDay {
  date: string; // "YYYY-MM-DD"
  dayOfMonth: number;
  status: DayStatus;
}

interface StreaksScreenProps {
  sessions?: FastingSession[];
  plans?: FastingPlan[];
  isPro?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonthDays(now: Date): CalendarDay[] {
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: CalendarDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ date: dateStr, dayOfMonth: d, status: 'unmarked' });
  }
  return days;
}

function getFirstDayOfWeek(now: Date): number {
  const year = now.getFullYear();
  const month = now.getMonth();
  return new Date(year, month, 1).getDay(); // 0 = Sunday
}

function getMonthName(now: Date): string {
  return now.toLocaleString('default', { month: 'long', year: 'numeric' });
}

/**
 * Determines the status of each day in the current month based on sessions.
 * - green (qualifying): day has at least one qualifying fast
 * - yellow (started): day has a session that started but didn't qualify
 * - unmarked: no sessions on that day
 */
function computeDayStatuses(
  days: CalendarDay[],
  sessions: FastingSession[],
  plans: FastingPlan[],
): CalendarDay[] {
  const planMap = new Map<string, FastingPlan>();
  for (const plan of plans) {
    planMap.set(plan.planId, plan);
  }

  // Build maps for qualifying days and started days
  const qualifyingDays = new Set<string>();
  const startedDays = new Set<string>();

  for (const session of sessions) {
    if (session.status === 'ACTIVE' || session.status === 'CANCELLED') {
      // ACTIVE sessions that haven't completed yet count as "started"
      if (session.status === 'ACTIVE') {
        const localDate = toLocalDateFromUtc(session.startTime);
        startedDays.add(localDate);
      }
      continue;
    }

    const plan = planMap.get(session.planId);
    if (!plan) continue;

    const localDate = toLocalDateFromUtc(session.startTime);

    if (isQualifyingFast(session, plan)) {
      qualifyingDays.add(localDate);
    } else {
      // ENDED_EARLY or COMPLETED but didn't meet 90% threshold
      startedDays.add(localDate);
    }
  }

  return days.map((day) => {
    if (qualifyingDays.has(day.date)) {
      return { ...day, status: 'qualifying' as DayStatus };
    }
    if (startedDays.has(day.date)) {
      return { ...day, status: 'started' as DayStatus };
    }
    return day;
  });
}

function toLocalDateFromUtc(utcIso: string): string {
  const date = new Date(utcIso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * StreaksScreen — Streaks and Achievements.
 * Displays calendar view, current/longest streak, and Pro-only insights.
 *
 * Validates: Requirements 13.1, 13.2
 */
export function StreaksScreen({
  sessions: sessionsProp = [],
  plans: plansProp = [],
  isPro: isProProp = false,
}: StreaksScreenProps) {
  const { theme } = useTheme();
  const now = useMemo(() => new Date(), []);

  // When navigated to (no props), load real data from storage. Props remain
  // supported so the component stays testable/renderable in isolation.
  const [sessions, setSessions] = useState<FastingSession[]>(sessionsProp);
  const [isPro, setIsPro] = useState<boolean>(isProProp);
  const plans = plansProp.length > 0 ? plansProp : ALL_PREDEFINED_PLANS;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const history = await getItem<FastingSession[]>(STORAGE_KEYS.SESSION_HISTORY);
        const status = await getSubscriptionStatus();
        if (!active) return;
        if (history) setSessions(await verifiedSessions(history));
        setIsPro(hasProAccess(status.tier));
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  // Compute streaks
  const streakResult = useMemo(
    () => recomputeStreaks(sessions, plans, now),
    [sessions, plans, now],
  );

  // Build calendar days with statuses
  const calendarDays = useMemo(() => {
    const days = getMonthDays(now);
    return computeDayStatuses(days, sessions, plans);
  }, [sessions, plans, now]);

  const firstDayOffset = getFirstDayOfWeek(now);
  const monthName = getMonthName(now);

  const weekDayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Streak Summary */}
      <View style={styles.streakSummary}>
        <View style={[styles.streakCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.streakValue, { color: theme.colors.primary }]}>
            {streakResult.currentStreak}
          </Text>
          <Text style={[styles.streakLabel, { color: theme.colors.textSecondary }]}>
            Current Streak
          </Text>
        </View>
        <View style={[styles.streakCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.streakValue, { color: theme.colors.primary }]}>
            {streakResult.longestStreak}
          </Text>
          <Text style={[styles.streakLabel, { color: theme.colors.textSecondary }]}>
            Longest Streak
          </Text>
        </View>
      </View>

      {/* Calendar */}
      <View style={[styles.calendarContainer, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.monthTitle, { color: theme.colors.text }]}>
          {monthName}
        </Text>

        {/* Weekday headers */}
        <View style={styles.weekRow}>
          {weekDayHeaders.map((day) => (
            <View key={day} style={styles.dayCell}>
              <Text style={[styles.weekDayHeader, { color: theme.colors.textSecondary }]}>
                {day}
              </Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.calendarGrid}>
          {/* Empty cells for offset */}
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <View key={`empty-${i}`} style={styles.dayCell} />
          ))}

          {/* Day cells */}
          {calendarDays.map((day) => (
            <View key={day.date} style={styles.dayCell}>
              <View
                style={[
                  styles.dayCircle,
                  day.status === 'qualifying' && styles.dayQualifying,
                  day.status === 'started' && styles.dayStarted,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    { color: theme.colors.text },
                    day.status === 'qualifying' && styles.dayTextActive,
                  ]}
                >
                  {day.dayOfMonth}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.dayQualifying]} />
            <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>
              Qualifying fast
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.dayStarted]} />
            <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>
              Started (not qualifying)
            </Text>
          </View>
        </View>
      </View>

      {/* Pro Insights Section */}
      <View style={[styles.insightsContainer, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.insightsHeader}>
          <Text style={[styles.insightsTitle, { color: theme.colors.text }]}>
            Streak Insights
          </Text>
          {!isPro && (
            <Text style={[styles.lockIndicator, { color: theme.colors.locked }]}>
              🔒 PRO
            </Text>
          )}
        </View>
        {isPro ? (
          <Text style={[styles.insightsBody, { color: theme.colors.textSecondary }]}>
            Detailed streak trends, average fasts per week, and best performing days coming soon.
          </Text>
        ) : (
          <Text style={[styles.insightsBody, { color: theme.colors.textSecondary }]}>
            Upgrade to Pro to unlock streak insights, trends, and achievement badges.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  streakSummary: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  streakCard: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    elevation: 1,
  },
  streakValue: {
    fontSize: 36,
    fontWeight: '700',
  },
  streakLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  calendarContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayQualifying: {
    backgroundColor: '#4CAF50',
  },
  dayStarted: {
    backgroundColor: '#FFC107',
  },
  dayText: {
    fontSize: 13,
    fontWeight: '500',
  },
  dayTextActive: {
    color: '#FFFFFF',
  },
  weekDayHeader: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
  },
  insightsContainer: {
    borderRadius: 12,
    padding: 16,
    elevation: 1,
  },
  insightsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  lockIndicator: {
    fontSize: 14,
    fontWeight: '600',
  },
  insightsBody: {
    fontSize: 14,
    lineHeight: 20,
  },
});
