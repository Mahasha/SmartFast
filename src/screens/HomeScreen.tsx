/**
 * HomeScreen — Fasting Dashboard
 *
 * Displays the circular fasting timer, remaining/elapsed time, plan info,
 * start/end fast controls, daily stats summary, and current streak.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.1, 7.2, 7.4, 7.5,
 *            9.4, 13.2, 25.4, 29.1, 29.4
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';

import { CircularTimer } from '../components/CircularTimer';
import {
  computeProgress,
  endFastEarly,
  restoreSession,
  startFast,
} from '../domain/fastingTimer';
import { getDailyStats, getLocalDate } from '../domain/dailyTracker';
import { recomputeStreaks } from '../domain/streakEngine';
import { FastingSession, TimerState, DailyStats, StreakRecord } from '../models/index';
import { FREE_PLANS, ALL_PREDEFINED_PLANS } from '../models/plans';
import { getItem } from '../data/localStorage';
import { STORAGE_KEYS } from '../utils/constants';
import { useTheme } from '../theme/ThemeContext';

/**
 * Formats a UTC ISO 8601 timestamp to a local time string (e.g., "2:30 PM").
 */
function formatLocalTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Resolves the plan name for a given planId from predefined plans.
 */
function getPlanName(planId: string): string {
  const plan = ALL_PREDEFINED_PLANS.find((p) => p.planId === planId);
  return plan ? plan.name : 'Custom Plan';
}

export function HomeScreen() {
  const { theme } = useTheme();
  const [session, setSession] = useState<FastingSession | null>(null);
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats | null>(null);
  const [streakData, setStreakData] = useState<{ current: number; longest: number }>({
    current: 0,
    longest: 0,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore session and load dashboard data on mount
  useEffect(() => {
    async function restore() {
      const restored = await restoreSession();
      if (restored && restored.status === 'ACTIVE') {
        setSession(restored);
      }
      // Load daily stats
      const today = getLocalDate();
      const stats = await getDailyStats(today);
      setDailyStats(stats);

      // Load streak data
      const cachedStreak = await getItem<StreakRecord>(STORAGE_KEYS.STREAK);
      if (cachedStreak) {
        setStreakData({
          current: cachedStreak.currentStreak,
          longest: cachedStreak.longestStreak,
        });
      }
    }
    restore();
  }, []);

  // Update timer state every second while session is active
  useEffect(() => {
    if (session && session.status === 'ACTIVE') {
      // Compute immediately
      setTimerState(computeProgress(session, new Date()));

      intervalRef.current = setInterval(() => {
        const state = computeProgress(session, new Date());
        setTimerState(state);

        // Auto-complete detection
        if (state.isComplete) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      }, 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else {
      setTimerState(null);
    }
  }, [session]);

  const handleStartFast = useCallback(async () => {
    const defaultPlan = FREE_PLANS[0]!;
    const newSession = await startFast(defaultPlan);
    setSession(newSession);
  }, []);

  const handleEndFast = useCallback(() => {
    Alert.alert(
      'End Fast Early',
      'Are you sure you want to end your fast early? Your progress will be saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Fast',
          style: 'destructive',
          onPress: async () => {
            await endFastEarly();
            setSession(null);
          },
        },
      ],
    );
  }, []);

  const isActive = session !== null && session.status === 'ACTIVE';
  const progressFraction = timerState?.progressFraction ?? 0;
  const progressPercent = Math.round(progressFraction * 100);

  const timerAccessibilityLabel = isActive
    ? `Fasting timer: ${progressPercent}% complete, ${timerState?.remainingFormatted ?? '00:00:00'} remaining`
    : 'Fasting timer: No active session';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Circular Timer */}
      <View style={styles.timerContainer}>
        <CircularTimer
          progressFraction={progressFraction}
          size={240}
          strokeWidth={16}
          arcColor={theme.colors.timerArc}
          trackColor={theme.colors.timerTrack}
          accessibilityLabel={timerAccessibilityLabel}
        />
        {/* Overlay text inside the timer */}
        <View style={styles.timerOverlay}>
          <Text
            style={[styles.remainingTime, { color: theme.colors.text }]}
            accessibilityLabel={`Remaining time: ${timerState?.remainingFormatted ?? '00:00:00'}`}
          >
            {timerState?.remainingFormatted ?? '00:00:00'}
          </Text>
          {isActive && (
            <Text
              style={[styles.elapsedTime, { color: theme.colors.textSecondary }]}
              accessibilityLabel={`Elapsed time: ${timerState?.elapsedFormatted ?? '00:00:00'}`}
            >
              Elapsed: {timerState?.elapsedFormatted ?? '00:00:00'}
            </Text>
          )}
        </View>
      </View>

      {/* Session info */}
      {isActive && (
        <View style={styles.infoContainer}>
          <Text
            style={[styles.planName, { color: theme.colors.text }]}
            accessibilityLabel={`Plan: ${getPlanName(session.planId)}`}
          >
            {getPlanName(session.planId)}
          </Text>
          <Text
            style={[styles.startTime, { color: theme.colors.textSecondary }]}
            accessibilityLabel={`Started at ${formatLocalTime(session.startTime)}`}
          >
            Started at {formatLocalTime(session.startTime)}
          </Text>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.buttonContainer}>
        {!isActive && (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
            onPress={handleStartFast}
            accessibilityLabel="Start Fast"
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Start Fast</Text>
          </TouchableOpacity>
        )}
        {isActive && (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.colors.error }]}
            onPress={handleEndFast}
            accessibilityLabel="End Fast"
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>End Fast</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Streak Display */}
      <View
        style={[styles.streakContainer, { backgroundColor: theme.colors.surface }]}
        accessibilityLabel={`Current streak: ${streakData.current} days. Longest streak: ${streakData.longest} days.`}
      >
        <View style={styles.streakItem}>
          <Text style={[styles.streakValue, { color: theme.colors.primary }]}>
            {streakData.current}
          </Text>
          <Text style={[styles.streakLabel, { color: theme.colors.textSecondary }]}>
            Current Streak
          </Text>
        </View>
        <View style={styles.streakDivider} />
        <View style={styles.streakItem}>
          <Text style={[styles.streakValue, { color: theme.colors.text }]}>
            {streakData.longest}
          </Text>
          <Text style={[styles.streakLabel, { color: theme.colors.textSecondary }]}>
            Longest Streak
          </Text>
        </View>
      </View>

      {/* Daily Stats Summary */}
      {dailyStats && (
        <View
          style={[styles.statsContainer, { backgroundColor: theme.colors.surface }]}
          accessibilityLabel="Today's daily stats"
        >
          <Text style={[styles.statsTitle, { color: theme.colors.text }]}>
            Today's Stats
          </Text>
          <View style={styles.statsGrid}>
            {dailyStats.waterIntake !== null && (
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                  {Math.round(dailyStats.waterIntake / 250)}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                  Glasses
                </Text>
              </View>
            )}
            {dailyStats.weight !== null && (
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                  {dailyStats.weight.toFixed(1)}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                  kg
                </Text>
              </View>
            )}
            {dailyStats.calories !== null && (
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                  {dailyStats.calories}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                  kcal
                </Text>
              </View>
            )}
            {dailyStats.steps !== null && (
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                  {dailyStats.steps.toLocaleString()}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                  Steps
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  timerOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remainingTime: {
    fontSize: 32,
    fontWeight: '700',
  },
  elapsedTime: {
    fontSize: 14,
    marginTop: 4,
  },
  infoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  planName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  startTime: {
    fontSize: 14,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  streakContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakItem: {
    flex: 1,
    alignItems: 'center',
  },
  streakDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  streakValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  streakLabel: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  statsContainer: {
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    width: '100%',
  },
  statsTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
});
