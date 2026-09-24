/**
 * HomeScreen — Fasting Dashboard
 *
 * Displays the circular fasting timer, remaining/elapsed time, plan info,
 * start/end fast controls, daily stats summary, and current streak.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.1, 7.2, 7.4, 7.5,
 *            9.4, 13.2, 25.4, 29.1, 29.4
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { CircularTimer } from '../components/CircularTimer';
import { checkForwardClockJump, clearClockSuspect, computeProgress, isClockSuspect, markClockSuspect } from '../domain/fastingTimer';
import { persistTimerTick } from '../domain/timerTickPersistence';
import {
  startFastWithLifecycle,
  endFastWithLifecycle,
  onAppLaunchLifecycle,
} from '../domain/timerLifecycle';
import { useSessionRecovery } from '../domain/useSessionRecovery';
import { getDailyStats, getLocalDate } from '../domain/dailyTracker';
import { FastingSession, DailyStats, StreakRecord, UserProfile, FastingPlan } from '../models/index';
import { FREE_PLANS, ALL_PREDEFINED_PLANS } from '../models/plans';
import { getItem } from '../data/localStorage';
import { STORAGE_KEYS } from '../utils/constants';
import { useTheme } from '../theme/ThemeContext';
import type { HomeStackParamList } from '../navigation/HomeStack';

type HomeNavProp = NativeStackNavigationProp<HomeStackParamList, 'Dashboard'>;

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
  const navigation = useNavigation<HomeNavProp>();
  const [session, setSession] = useState<FastingSession | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [dailyStats, setDailyStats] = useState<DailyStats | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<FastingPlan>(FREE_PLANS[0]!);
  const [streakData, setStreakData] = useState<{ current: number; longest: number }>({
    current: 0,
    longest: 0,
  });
  // Guards against duplicate "End Fast" taps finalizing the session twice.
  const endingRef = useRef(false);
  const clockAlertedRef = useRef<string | null>(null);

  const isActive = session !== null && session.status === 'ACTIVE';

  // Reload the selected plan whenever the screen regains focus, so a change
  // made on the PlanSelection screen is reflected here on return.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const profile = await getItem<UserProfile>(STORAGE_KEYS.PROFILE);
        const plan = ALL_PREDEFINED_PLANS.find((p) => p.planId === profile?.selectedPlanId);
        if (active && plan) setSelectedPlan(plan);
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const loadStreak = useCallback(async () => {
    const cachedStreak = await getItem<StreakRecord>(STORAGE_KEYS.STREAK);
    if (cachedStreak) {
      setStreakData({
        current: cachedStreak.currentStreak,
        longest: cachedStreak.longestStreak,
      });
    }
  }, []);

  // App-launch lifecycle: restore session, flush/pull sync, load dashboard data.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const restored = await onAppLaunchLifecycle();
      if (!mounted) return;
      if (restored && restored.status === 'ACTIVE') {
        setSession(restored);
      }
      const stats = await getDailyStats(getLocalDate());
      if (!mounted) return;
      setDailyStats(stats);
      await loadStreak();
    })();
    return () => {
      mounted = false;
    };
  }, [loadStreak]);

  // Compare wall time with a monotonic clock while this process is active.
  // Reset the baseline after backgrounding because device sleep can pause JS.
  useEffect(() => {
    if (!isActive || !session) return;
    let baseline: { wall: number; monotonic: number } | null = {
      wall: Date.now(), monotonic: performance.now(),
    };
    let lastPersist = 0;
    const appState = AppState.addEventListener('change', (state) => {
      baseline = state === 'active' ? { wall: Date.now(), monotonic: performance.now() } : null;
    });
    const id = setInterval(() => {
      const wall = Date.now();
      const monotonic = performance.now();
      if (baseline) {
        const result = checkForwardClockJump(new Date(wall), new Date(baseline.wall), monotonic - baseline.monotonic);
        if (result.suspicious && clockAlertedRef.current !== session.sessionId) {
          clockAlertedRef.current = session.sessionId;
          void markClockSuspect(session.sessionId);
          Alert.alert('Device clock changed', 'This fast needs a time review before it counts toward your streak.');
        }
      }
      baseline = { wall, monotonic };
      if (wall - lastPersist >= 10_000) {
        lastPersist = wall;
        void persistTimerTick(session);
      }
      setNow(wall);
    }, 1000);
    return () => {
      clearInterval(id);
      appState.remove();
    };
  }, [isActive, session]);

  const timerState = useMemo(
    () => (isActive && session ? computeProgress(session, new Date(now)) : null),
    [isActive, session, now],
  );

  // Recompute progress when returning from background. Fasting is open-ended,
  // so a session past its goal simply resumes in overtime — never auto-completed.
  useSessionRecovery({
    onRecovery: (state) => {
      setSession(state.session);
      setNow(Date.now());
    },
  });

  const handleStartFast = useCallback(async () => {
    const newSession = await startFastWithLifecycle(selectedPlan);
    setSession(newSession);
    setNow(Date.now());
  }, [selectedPlan]);

  const handleEndFast = useCallback(() => {
    const reachedGoal = timerState?.isGoalReached ?? false;
    Alert.alert(
      reachedGoal ? 'End Fast' : 'End Fast Early',
      reachedGoal
        ? 'Great work — ready to end your fast and log it?'
        : 'Are you sure you want to end your fast before reaching your goal? Your progress will be saved.',
      [
        { text: 'Keep Fasting', style: 'cancel' },
        {
          text: 'End Fast',
          style: reachedGoal ? 'default' : 'destructive',
          onPress: async () => {
            const finalize = async () => {
              if (endingRef.current) return;
              endingRef.current = true;
              try {
                await endFastWithLifecycle();
                setSession(null);
                await loadStreak();
              } finally {
                endingRef.current = false;
              }
            };
            if (session && await isClockSuspect(session.sessionId)) {
              Alert.alert(
                'Review fasting time',
                'Your device clock changed during this fast. Confirm that the displayed start and end times are accurate before it counts toward your streak.',
                [
                  { text: 'Keep Fasting', style: 'cancel' },
                  { text: 'Confirm Times', onPress: async () => {
                    await clearClockSuspect(session.sessionId);
                    await finalize();
                  } },
                ],
              );
              return;
            }
            await finalize();
          },
        },
      ],
    );
  }, [timerState?.isGoalReached, loadStreak, session]);

  const progressPercent = Math.round(timerState?.progressPercent ?? 0);
  const progressFraction = progressPercent / 100;
  const isGoalReached = timerState?.isGoalReached ?? false;

  const timerAccessibilityLabel = !isActive
    ? 'Fasting timer: No active session'
    : isGoalReached
      ? `Fasting timer: goal reached, ${timerState?.overtimeFormatted ?? '00:00:00'} overtime, ${timerState?.totalElapsedFormatted ?? '00:00:00'} total fasted`
      : `Fasting timer: ${progressPercent}% complete, ${timerState?.remainingFormatted ?? '00:00:00'} remaining`;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Circular Timer */}
      <View style={styles.timerContainer}>
        <CircularTimer
          progressFraction={progressFraction}
          size={240}
          strokeWidth={16}
          arcColor={isGoalReached ? theme.colors.goalAccent : theme.colors.timerArc}
          trackColor={theme.colors.timerTrack}
          accessibilityLabel={timerAccessibilityLabel}
        />
        {/* Overlay text inside the timer */}
        <View style={styles.timerOverlay}>
          {isActive && isGoalReached ? (
            <>
              <Text style={[styles.goalLabel, { color: theme.colors.goalAccent }]}>
                Goal Achieved 🎉
              </Text>
              <Text
                style={[styles.overtimeTime, { color: theme.colors.goalAccent }]}
                accessibilityLabel={`Overtime: ${timerState?.overtimeFormatted ?? '00:00:00'}`}
              >
                +{timerState?.overtimeFormatted ?? '00:00:00'}
              </Text>
              <Text style={[styles.elapsedTime, { color: theme.colors.textSecondary }]}>
                {timerState?.totalElapsedFormatted ?? '00:00:00'} total fasted
              </Text>
            </>
          ) : (
            <>
              <Text
                style={[styles.remainingTime, { color: theme.colors.text }]}
                accessibilityLabel={`Remaining time: ${timerState?.remainingFormatted ?? '00:00:00'}`}
              >
                {timerState?.remainingFormatted ?? '00:00:00'}
              </Text>
              {isActive && (
                <Text
                  style={[styles.elapsedTime, { color: theme.colors.textSecondary }]}
                  accessibilityLabel={`Elapsed time: ${timerState?.totalElapsedFormatted ?? '00:00:00'}`}
                >
                  Elapsed: {timerState?.totalElapsedFormatted ?? '00:00:00'}
                </Text>
              )}
            </>
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
          {isGoalReached && (
            <View style={[styles.overtimeBadge, { backgroundColor: theme.colors.goalAccent }]}>
              <Text style={styles.overtimeBadgeText}>OVERTIME</Text>
            </View>
          )}
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.buttonContainer}>
        {!isActive && (
          <>
            <Text
              style={[styles.selectedPlanLabel, { color: theme.colors.textSecondary }]}
              accessibilityLabel={`Selected plan: ${selectedPlan.name}, ${selectedPlan.fastingHours} hours fasting`}
            >
              Plan: {selectedPlan.name} · {selectedPlan.fastingHours}h fast
            </Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.primary }]}
              onPress={handleStartFast}
              accessibilityLabel="Start Fast"
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Start Fast</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.changePlanButton}
              onPress={() => navigation.navigate('PlanSelection')}
              accessibilityLabel="Change plan"
              accessibilityRole="button"
            >
              <Text style={[styles.changePlanText, { color: theme.colors.primary }]}>
                Change Plan
              </Text>
            </TouchableOpacity>
          </>
        )}
        {isActive && (
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: isGoalReached ? theme.colors.goalAccent : theme.colors.error },
            ]}
            onPress={handleEndFast}
            accessibilityLabel="End Fast"
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>End Fast</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Streak Display — tap to view the Streaks & Achievements calendar */}
      <TouchableOpacity
        style={[styles.streakContainer, { backgroundColor: theme.colors.surface }]}
        onPress={() => navigation.navigate('Streaks')}
        accessibilityRole="button"
        accessibilityHint="Tap to view streaks and achievements"
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
        <View style={[styles.streakDivider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.streakItem}>
          <Text style={[styles.streakValue, { color: theme.colors.text }]}>
            {streakData.longest}
          </Text>
          <Text style={[styles.streakLabel, { color: theme.colors.textSecondary }]}>
            Longest Streak
          </Text>
        </View>
      </TouchableOpacity>

      {/* Fasting History link */}
      <TouchableOpacity
        style={styles.historyButton}
        onPress={() => navigation.navigate('FastingHistory')}
        accessibilityRole="button"
        accessibilityLabel="View fasting history"
      >
        <Text style={[styles.historyButtonText, { color: theme.colors.primary }]}>
          View Fasting History
        </Text>
      </TouchableOpacity>

      {/* Meal Journal link */}
      <TouchableOpacity
        style={styles.historyButton}
        onPress={() => navigation.navigate('MealJournal')}
        accessibilityRole="button"
        accessibilityLabel="Open meal journal"
      >
        <Text style={[styles.historyButtonText, { color: theme.colors.primary }]}>
          Meal Journal
        </Text>
      </TouchableOpacity>

      {/* Daily Stats Summary */}
      {dailyStats && (
        <View
          style={[styles.statsContainer, { backgroundColor: theme.colors.surface }]}
          accessibilityLabel="Today's daily stats"
        >
          <Text style={[styles.statsTitle, { color: theme.colors.text }]}>
            Today&apos;s Stats
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
  goalLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  overtimeTime: {
    fontSize: 30,
    fontWeight: '700',
  },
  elapsedTime: {
    fontSize: 14,
    marginTop: 4,
  },
  overtimeBadge: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  overtimeBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
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
  selectedPlanLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  changePlanButton: {
    marginTop: 12,
    paddingVertical: 8,
  },
  changePlanText: {
    fontSize: 15,
    fontWeight: '600',
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
  historyButton: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  historyButtonText: {
    fontSize: 15,
    fontWeight: '600',
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
