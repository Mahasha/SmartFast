/**
 * MealJournalScreen — daily meal timeline.
 *
 * Shows the meals logged for a selected day (with a prev/next day switcher),
 * a running calorie total, and an "Add Meal" action. Free-tier users see their
 * 1-photo-per-day quota; attempting a second photo surfaces the upgrade sheet.
 *
 * All data is local-only (see mealJournal / mealImageStore). Styling follows the
 * app's themed tokens — OLED black in the default dark theme.
 */

import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../theme/ThemeContext';
import { MealEntry, SubscriptionTier } from '../models/index';
import { getLocalDate } from '../domain/dailyTracker';
import { getSubscriptionStatus } from '../domain/subscriptionManager';
import {
  AddMealInput,
  addMeal,
  deleteMeal,
  getMealsForDate,
  hasUnlimitedMealPhotos,
  FREE_TIER_DAILY_PHOTO_LIMIT,
  PHOTO_LIMIT_MESSAGE,
} from '../domain/mealJournal';
import { AddMealSheet } from '../components/AddMealSheet';
import { UpgradeBottomSheet } from '../components/UpgradeBottomSheet';

// ─── Date helpers ──────────────────────────────────────────────────────────────

function shiftDate(dateStr: string, deltaDays: number): string {
  const parts = dateStr.split('-').map(Number);
  const dt = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
  dt.setDate(dt.getDate() + deltaDays);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatHeading(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return 'Today';
  if (dateStr === shiftDate(todayStr, -1)) return 'Yesterday';
  const parts = dateStr.split('-').map(Number);
  const dt = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function MealJournalScreen() {
  const { theme } = useTheme();
  const today = getLocalDate();
  const [selectedDate, setSelectedDate] = useState(today);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [addVisible, setAddVisible] = useState(false);
  const [upgradeVisible, setUpgradeVisible] = useState(false);

  const loadMeals = useCallback(async () => {
    const [dayMeals, sub] = await Promise.all([
      getMealsForDate(selectedDate),
      getSubscriptionStatus(),
    ]);
    setMeals(dayMeals);
    setTier(sub.tier);
  }, [selectedDate]);

  // Reloads on focus and whenever the selected day changes.
  useFocusEffect(
    useCallback(() => {
      void loadMeals();
    }, [loadMeals]),
  );

  const handleSaveMeal = useCallback(
    async (input: AddMealInput) => {
      const result = await addMeal(input, { tier, localDate: selectedDate });
      if (result.ok) {
        setAddVisible(false);
        await loadMeals();
      } else if (result.reason === 'PHOTO_LIMIT_REACHED') {
        setUpgradeVisible(true);
      } else {
        Alert.alert('Could not add meal', result.message);
      }
    },
    [tier, selectedDate, loadMeals],
  );

  const handleDeleteMeal = useCallback(
    (meal: MealEntry) => {
      Alert.alert('Delete meal', `Remove "${meal.name}" from this day?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteMeal(meal.mealId, selectedDate);
            await loadMeals();
          },
        },
      ]);
    },
    [selectedDate, loadMeals],
  );

  const isToday = selectedDate === today;
  const totalCalories = meals.reduce((sum, m) => sum + (m.calories ?? 0), 0);
  const photoCount = meals.filter((m) => m.photoUri !== null).length;
  const showPhotoQuota = !hasUnlimitedMealPhotos(tier);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Date switcher */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={() => setSelectedDate((d) => shiftDate(d, -1))}
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel="Previous day"
        >
          <Text style={[styles.navArrow, { color: theme.colors.primary }]}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerDate, { color: theme.colors.text }]}>
            {formatHeading(selectedDate, today)}
          </Text>
          <Text style={[styles.headerSub, { color: theme.colors.textSecondary }]}>
            {meals.length} {meals.length === 1 ? 'meal' : 'meals'}
            {totalCalories > 0 ? ` · ${totalCalories} kcal` : ''}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => !isToday && setSelectedDate((d) => shiftDate(d, 1))}
          disabled={isToday}
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel="Next day"
        >
          <Text style={[styles.navArrow, { color: isToday ? theme.colors.border : theme.colors.primary }]}>
            ›
          </Text>
        </TouchableOpacity>
      </View>

      {showPhotoQuota && (
        <Text style={[styles.quota, { color: theme.colors.textSecondary }]}>
          {photoCount}/{FREE_TIER_DAILY_PHOTO_LIMIT} photo log used today · text meals unlimited
        </Text>
      )}

      {/* Timeline */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
        {meals.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: theme.colors.text }]}>No meals logged</Text>
            <Text style={[styles.emptyHint, { color: theme.colors.textSecondary }]}>
              Tap “Add Meal” to start your journal.
            </Text>
          </View>
        ) : (
          meals.map((meal) => (
            <TouchableOpacity
              key={meal.mealId}
              style={[styles.mealRow, { borderColor: theme.colors.border }]}
              onLongPress={() => handleDeleteMeal(meal)}
              accessibilityRole="button"
              accessibilityLabel={`${meal.name}${
                meal.calories !== null ? `, ${meal.calories} kcal` : ''
              }, at ${formatTime(meal.loggedAt)}. Long press to delete.`}
            >
              <Text style={[styles.mealTime, { color: theme.colors.textSecondary }]}>
                {formatTime(meal.loggedAt)}
              </Text>
              {meal.photoUri ? (
                <Image
                  source={{ uri: meal.photoUri }}
                  style={styles.thumb}
                  accessibilityLabel={`Photo of ${meal.name}`}
                />
              ) : (
                <View
                  style={[
                    styles.thumbPlaceholder,
                    { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                  ]}
                >
                  <Text style={styles.thumbPlaceholderText}>🍽️</Text>
                </View>
              )}
              <View style={styles.mealInfo}>
                <Text style={[styles.mealName, { color: theme.colors.text }]} numberOfLines={1}>
                  {meal.name}
                </Text>
                {meal.calories !== null && (
                  <Text style={[styles.mealCalories, { color: theme.colors.textSecondary }]}>
                    {meal.calories} kcal
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Add */}
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
        onPress={() => setAddVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Add meal"
      >
        <Text style={styles.addButtonText}>Add Meal</Text>
      </TouchableOpacity>

      <AddMealSheet
        visible={addVisible}
        tier={tier}
        localDate={selectedDate}
        onClose={() => setAddVisible(false)}
        onSave={handleSaveMeal}
        onPhotoBlocked={() => setUpgradeVisible(true)}
      />
      <UpgradeBottomSheet
        visible={upgradeVisible}
        message={PHOTO_LIMIT_MESSAGE}
        onClose={() => setUpgradeVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrow: {
    fontSize: 30,
    fontWeight: '400',
    lineHeight: 32,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerDate: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 13,
    marginTop: 2,
  },
  quota: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 8,
  },
  scroll: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 14,
    marginTop: 6,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mealTime: {
    width: 64,
    fontSize: 13,
    fontWeight: '500',
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  thumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholderText: {
    fontSize: 18,
  },
  mealInfo: {
    flex: 1,
    marginLeft: 12,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '600',
  },
  mealCalories: {
    fontSize: 13,
    marginTop: 2,
  },
  addButton: {
    margin: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
