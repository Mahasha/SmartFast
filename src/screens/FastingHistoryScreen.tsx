/**
 * FastingHistoryScreen — Displays all past fasting sessions in reverse chronological order.
 *
 * Each entry shows: plan name, start time, end time, duration, status.
 * Tapping an entry shows a detail view with full metadata.
 *
 * Validates: Requirements 10.1, 10.2, 10.3
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { FastingSession, DailyStats } from '../models/index';
import { ALL_PREDEFINED_PLANS } from '../models/plans';
import { getItem } from '../data/localStorage';
import { STORAGE_KEYS, dailyStatsKey } from '../utils/constants';

/**
 * Formats a UTC ISO 8601 timestamp to a local date/time string.
 */
function formatLocalDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Formats a UTC ISO 8601 timestamp to a local time string.
 */
function formatLocalTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Formats duration in seconds to a human-readable string.
 */
function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

/**
 * Returns the plan name for a given planId.
 */
function getPlanName(planId: string): string {
  const plan = ALL_PREDEFINED_PLANS.find((p) => p.planId === planId);
  return plan ? plan.name : 'Custom Plan';
}

/**
 * Returns a display-friendly status label.
 */
function getStatusLabel(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'Completed';
    case 'ENDED_EARLY':
      return 'Ended Early';
    case 'CANCELLED':
      return 'Cancelled';
    case 'ACTIVE':
      return 'Active';
    default:
      return status;
  }
}

/**
 * Returns the local date string (YYYY-MM-DD) for a UTC ISO timestamp.
 */
function toLocalDate(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function FastingHistoryScreen() {
  const { theme } = useTheme();
  const [sessions, setSessions] = useState<FastingSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<FastingSession | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const history = await getItem<FastingSession[]>(STORAGE_KEYS.SESSION_HISTORY);
    if (history) {
      // Sort reverse chronological
      const sorted = [...history].sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
      );
      setSessions(sorted);
    }
  };

  const handleSelectSession = useCallback(async (session: FastingSession) => {
    setSelectedSession(session);
    // Load daily stats for that day
    const localDate = toLocalDate(session.startTime);
    const stats = await getItem<DailyStats>(dailyStatsKey(localDate));
    setDailyStats(stats);
    setShowDetail(true);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return theme.colors.success;
      case 'ENDED_EARLY':
        return theme.colors.warning;
      case 'CANCELLED':
        return theme.colors.error;
      default:
        return theme.colors.textSecondary;
    }
  };

  const renderSession = ({ item }: { item: FastingSession }) => (
    <TouchableOpacity
      style={[styles.sessionCard, { backgroundColor: theme.colors.surface }]}
      onPress={() => handleSelectSession(item)}
      accessibilityLabel={`${getPlanName(item.planId)} fast, ${getStatusLabel(item.status)}, ${formatDuration(item.durationFasted)}`}
      accessibilityRole="button"
      accessibilityHint="Tap to view details"
    >
      <View style={styles.sessionHeader}>
        <Text style={[styles.planName, { color: theme.colors.text }]}>
          {getPlanName(item.planId)}
        </Text>
        <Text style={[styles.statusBadge, { color: getStatusColor(item.status) }]}>
          {getStatusLabel(item.status)}
        </Text>
      </View>
      <View style={styles.sessionMeta}>
        <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
          {formatLocalDateTime(item.startTime)}
        </Text>
        <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
          {formatDuration(item.durationFasted)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
        No fasting sessions yet. Start your first fast to see your history here.
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.sessionId}
        renderItem={renderSession}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        accessibilityLabel="Fasting history list"
      />

      {/* Detail Modal */}
      <Modal
        visible={showDetail}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetail(false)}
      >
        <ScrollView
          style={[styles.detailContainer, { backgroundColor: theme.colors.background }]}
          contentContainerStyle={styles.detailContent}
          accessibilityLabel="Session detail view"
        >
          <View style={styles.detailHeader}>
            <Text style={[styles.detailTitle, { color: theme.colors.text }]}>
              Session Details
            </Text>
            <TouchableOpacity
              onPress={() => setShowDetail(false)}
              accessibilityLabel="Close details"
              accessibilityRole="button"
            >
              <Text style={[styles.closeButton, { color: theme.colors.primary }]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>

          {selectedSession && (
            <View style={[styles.detailCard, { backgroundColor: theme.colors.surface }]}>
              <DetailRow
                label="Plan"
                value={getPlanName(selectedSession.planId)}
                textColor={theme.colors.text}
                labelColor={theme.colors.textSecondary}
              />
              <DetailRow
                label="Status"
                value={getStatusLabel(selectedSession.status)}
                textColor={getStatusColor(selectedSession.status)}
                labelColor={theme.colors.textSecondary}
              />
              <DetailRow
                label="Start Time"
                value={formatLocalDateTime(selectedSession.startTime)}
                textColor={theme.colors.text}
                labelColor={theme.colors.textSecondary}
              />
              <DetailRow
                label="Planned End"
                value={formatLocalDateTime(selectedSession.endTime)}
                textColor={theme.colors.text}
                labelColor={theme.colors.textSecondary}
              />
              {selectedSession.actualEndTime && (
                <DetailRow
                  label="Actual End"
                  value={formatLocalDateTime(selectedSession.actualEndTime)}
                  textColor={theme.colors.text}
                  labelColor={theme.colors.textSecondary}
                />
              )}
              <DetailRow
                label="Duration Fasted"
                value={formatDuration(selectedSession.durationFasted)}
                textColor={theme.colors.text}
                labelColor={theme.colors.textSecondary}
              />
            </View>
          )}

          {/* Daily Stats for that day */}
          {dailyStats && (
            <>
              <Text
                style={[styles.detailSectionTitle, { color: theme.colors.textSecondary }]}
                accessibilityRole="header"
              >
                DAILY STATS
              </Text>
              <View style={[styles.detailCard, { backgroundColor: theme.colors.surface }]}>
                {dailyStats.waterIntake !== null && (
                  <DetailRow
                    label="Water Intake"
                    value={`${dailyStats.waterIntake} ml`}
                    textColor={theme.colors.text}
                    labelColor={theme.colors.textSecondary}
                  />
                )}
                {dailyStats.weight !== null && (
                  <DetailRow
                    label="Weight"
                    value={`${dailyStats.weight} kg`}
                    textColor={theme.colors.text}
                    labelColor={theme.colors.textSecondary}
                  />
                )}
                {dailyStats.calories !== null && (
                  <DetailRow
                    label="Calories"
                    value={`${dailyStats.calories} kcal`}
                    textColor={theme.colors.text}
                    labelColor={theme.colors.textSecondary}
                  />
                )}
                {dailyStats.steps !== null && (
                  <DetailRow
                    label="Steps"
                    value={`${dailyStats.steps}`}
                    textColor={theme.colors.text}
                    labelColor={theme.colors.textSecondary}
                  />
                )}
              </View>
            </>
          )}
        </ScrollView>
      </Modal>
    </View>
  );
}

function DetailRow({
  label,
  value,
  textColor,
  labelColor,
}: {
  label: string;
  value: string;
  textColor: string;
  labelColor: string;
}) {
  return (
    <View
      style={detailRowStyles.row}
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text style={[detailRowStyles.label, { color: labelColor }]}>{label}</Text>
      <Text style={[detailRowStyles.value, { color: textColor }]}>{value}</Text>
    </View>
  );
}

const detailRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sessionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 17,
    fontWeight: '600',
  },
  statusBadge: {
    fontSize: 13,
    fontWeight: '600',
  },
  sessionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  detailContainer: {
    flex: 1,
  },
  detailContent: {
    padding: 24,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  closeButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  detailCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  detailSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 8,
  },
});
