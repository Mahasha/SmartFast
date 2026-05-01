/**
 * DailyStatsInput — Card-style component for daily health metric input.
 *
 * Provides input fields for water intake, weight, calories, and steps.
 * Converts units at the UI boundary:
 * - Water: glasses (1 glass = 250 ml) → stored as ml
 * - Weight: lb → stored as kg when unitPreference is 'imperial'
 *
 * Displays current day's stats and shows validation warnings with
 * confirmation for out-of-range values.
 *
 * Validates: Requirements 9.1, 9.4, 9.5, 9.7
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  getDailyStats,
  getLocalDate,
  MetricType,
  saveDailyStats,
  validateMetric,
} from '../domain/dailyTracker';
import { useTheme } from '../theme/ThemeContext';

// ─── Constants ───────────────────────────────────────────────────────────────

const ML_PER_GLASS = 250;
const KG_PER_LB = 0.453592;
const LB_PER_KG = 2.20462;

// ─── Props ───────────────────────────────────────────────────────────────────

export interface DailyStatsInputProps {
  /** User's unit preference for weight display */
  unitPreference: 'metric' | 'imperial';
  /** User ID for saving stats (defaults to 'guest') */
  userId?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DailyStatsInput({
  unitPreference,
  userId = 'guest',
}: DailyStatsInputProps) {
  const { theme } = useTheme();

  // Display values (in user-facing units)
  const [waterGlasses, setWaterGlasses] = useState('');
  const [weight, setWeight] = useState('');
  const [calories, setCalories] = useState('');
  const [steps, setSteps] = useState('');

  // Load existing stats on mount
  useEffect(() => {
    async function loadStats() {
      const localDate = getLocalDate();
      const stats = await getDailyStats(localDate);
      if (stats) {
        if (stats.waterIntake !== null) {
          setWaterGlasses(String(stats.waterIntake / ML_PER_GLASS));
        }
        if (stats.weight !== null) {
          const displayWeight =
            unitPreference === 'imperial'
              ? stats.weight * LB_PER_KG
              : stats.weight;
          setWeight(String(Math.round(displayWeight * 10) / 10));
        }
        if (stats.calories !== null) {
          setCalories(String(stats.calories));
        }
        if (stats.steps !== null) {
          setSteps(String(stats.steps));
        }
      }
    }
    loadStats();
  }, [unitPreference]);

  /**
   * Converts a display value to canonical units and saves with validation.
   */
  const handleSave = useCallback(
    async (metric: MetricType, displayValue: string) => {
      const parsed = parseFloat(displayValue);
      if (isNaN(parsed)) return;

      // Convert to canonical units at the UI boundary
      let canonicalValue: number;
      switch (metric) {
        case 'waterIntake':
          canonicalValue = parsed * ML_PER_GLASS;
          break;
        case 'weight':
          canonicalValue =
            unitPreference === 'imperial' ? parsed * KG_PER_LB : parsed;
          break;
        case 'calories':
          canonicalValue = parsed;
          break;
        case 'steps':
          canonicalValue = Math.round(parsed);
          break;
      }

      const validation = validateMetric(metric, canonicalValue);

      if (!validation.valid) {
        // Show warning and ask for confirmation
        Alert.alert(
          'Value Out of Range',
          validation.warning,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Save Anyway',
              onPress: async () => {
                await saveDailyStats({ [metric]: canonicalValue }, userId);
              },
            },
          ],
        );
        return;
      }

      await saveDailyStats({ [metric]: canonicalValue }, userId);
    },
    [unitPreference, userId],
  );

  const weightLabel = unitPreference === 'imperial' ? 'Weight (lb)' : 'Weight (kg)';

  return (
    <View
      style={[styles.card, { backgroundColor: theme.colors.surface }]}
      accessibilityLabel="Daily health stats input"
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Today&apos;s Stats
      </Text>

      {/* Water Intake */}
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          Water (glasses)
        </Text>
        <TextInput
          style={[
            styles.input,
            { color: theme.colors.text, borderColor: theme.colors.textSecondary },
          ]}
          value={waterGlasses}
          onChangeText={setWaterGlasses}
          onEndEditing={() => handleSave('waterIntake', waterGlasses)}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={theme.colors.textSecondary}
          accessibilityLabel="Water intake in glasses"
        />
      </View>

      {/* Weight */}
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          {weightLabel}
        </Text>
        <TextInput
          style={[
            styles.input,
            { color: theme.colors.text, borderColor: theme.colors.textSecondary },
          ]}
          value={weight}
          onChangeText={setWeight}
          onEndEditing={() => handleSave('weight', weight)}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={theme.colors.textSecondary}
          accessibilityLabel={`Weight in ${unitPreference === 'imperial' ? 'pounds' : 'kilograms'}`}
        />
      </View>

      {/* Calories */}
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          Calories (kcal)
        </Text>
        <TextInput
          style={[
            styles.input,
            { color: theme.colors.text, borderColor: theme.colors.textSecondary },
          ]}
          value={calories}
          onChangeText={setCalories}
          onEndEditing={() => handleSave('calories', calories)}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={theme.colors.textSecondary}
          accessibilityLabel="Calorie intake in kcal"
        />
      </View>

      {/* Steps */}
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          Steps
        </Text>
        <TextInput
          style={[
            styles.input,
            { color: theme.colors.text, borderColor: theme.colors.textSecondary },
          ]}
          value={steps}
          onChangeText={setSteps}
          onEndEditing={() => handleSave('steps', steps)}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={theme.colors.textSecondary}
          accessibilityLabel="Step count"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 100,
    textAlign: 'right',
    fontSize: 16,
  },
});
