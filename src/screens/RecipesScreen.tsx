import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
  ScrollView,
} from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { getCardColor } from '../theme/tokens';
import recipes from '../content/recipes.json';

/**
 * Recipe data shape from the bundled JSON.
 */
interface Recipe {
  id: string;
  title: string;
  category: string;
  description: string;
  ingredients: string[];
  steps: string[];
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  prepTime: string;
  thumbnail: string;
}

/**
 * Section shape for SectionList.
 */
interface RecipeSection {
  title: string;
  data: Recipe[];
}

/**
 * RecipesScreen — Healthy recipes for the fasting lifestyle.
 *
 * Implements Requirements 18.1, 18.2, 18.4:
 * - List of recipes organized by category with thumbnail and description
 * - Full recipe with title, description, ingredients, steps, nutrition, prep time
 * - Thumbnail and brief description in list view
 *
 * Uses SectionList for lazy-loaded, grouped display (Requirement 28.3).
 * State-based navigation between list and detail views.
 */
export function RecipesScreen() {
  const { theme } = useTheme();
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  // Group recipes by category into sections
  const sections: RecipeSection[] = useMemo(() => {
    const categoryMap = new Map<string, Recipe[]>();
    for (const recipe of recipes as Recipe[]) {
      const existing = categoryMap.get(recipe.category);
      if (existing) {
        existing.push(recipe);
      } else {
        categoryMap.set(recipe.category, [recipe]);
      }
    }
    return Array.from(categoryMap.entries()).map(([title, data]) => ({
      title,
      data,
    }));
  }, []);

  const handleRecipePress = useCallback((recipe: Recipe) => {
    setSelectedRecipe(recipe);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedRecipe(null);
  }, []);

  // Detail view
  if (selectedRecipe) {
    return (
      <RecipeDetail
        recipe={selectedRecipe}
        onBack={handleBack}
      />
    );
  }

  // List view
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Recipes
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
          Healthy meals for your eating window
        </Text>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {section.title}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <RecipeCard recipe={item} onPress={handleRecipePress} />
        )}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

/**
 * RecipeCard — Displays a single recipe in the list with thumbnail placeholder and description.
 */
function RecipeCard({
  recipe,
  onPress,
}: {
  recipe: Recipe;
  onPress: (recipe: Recipe) => void;
}) {
  const { theme } = useTheme();
  const cardColor = getCardColor(recipe.id, theme);

  return (
    <Pressable
      style={[styles.card, { backgroundColor: theme.colors.surface }]}
      onPress={() => onPress(recipe)}
      accessibilityRole="button"
      accessibilityLabel={`${recipe.title}. ${recipe.category}. ${recipe.prepTime} prep time. ${recipe.nutrition.calories} calories.`}
    >
      {/* Thumbnail placeholder — uses deterministic pastel color */}
      <View style={[styles.thumbnail, { backgroundColor: cardColor }]}>
        <Text style={styles.thumbnailEmoji}>
          {getCategoryEmoji(recipe.category)}
        </Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]} numberOfLines={1}>
          {recipe.title}
        </Text>
        <Text
          style={[styles.cardDescription, { color: theme.colors.textSecondary }]}
          numberOfLines={2}
        >
          {recipe.description}
        </Text>
        <View style={styles.cardMeta}>
          <Text style={[styles.cardMetaText, { color: theme.colors.textSecondary }]}>
            ⏱ {recipe.prepTime}
          </Text>
          <Text style={[styles.cardMetaText, { color: theme.colors.textSecondary }]}>
            🔥 {recipe.nutrition.calories} kcal
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * RecipeDetail — Full recipe content view.
 */
function RecipeDetail({
  recipe,
  onBack,
}: {
  recipe: Recipe;
  onBack: () => void;
}) {
  const { theme } = useTheme();
  const cardColor = getCardColor(recipe.id, theme);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.detailHeader}>
        <Pressable
          onPress={onBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back to recipes list"
        >
          <Text style={[styles.backText, { color: theme.colors.primary }]}>
            ← Back
          </Text>
        </Pressable>
      </View>
      <ScrollView
        style={styles.detailScroll}
        contentContainerStyle={styles.detailContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero thumbnail placeholder */}
        <View style={[styles.detailThumbnail, { backgroundColor: cardColor }]}>
          <Text style={styles.detailThumbnailEmoji}>
            {getCategoryEmoji(recipe.category)}
          </Text>
        </View>

        <Text style={[styles.detailCategory, { color: theme.colors.primary }]}>
          {recipe.category}
        </Text>
        <Text style={[styles.detailTitle, { color: theme.colors.text }]}>
          {recipe.title}
        </Text>
        <Text style={[styles.detailDescription, { color: theme.colors.textSecondary }]}>
          {recipe.description}
        </Text>

        {/* Prep time */}
        <View style={styles.prepTimeRow}>
          <Text style={[styles.prepTimeText, { color: theme.colors.text }]}>
            ⏱ Prep Time: {recipe.prepTime}
          </Text>
        </View>

        {/* Nutrition info */}
        <View style={[styles.nutritionCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>
            Nutrition per serving
          </Text>
          <View style={styles.nutritionGrid}>
            <NutritionItem label="Calories" value={`${recipe.nutrition.calories}`} unit="kcal" theme={theme} />
            <NutritionItem label="Protein" value={`${recipe.nutrition.protein}`} unit="g" theme={theme} />
            <NutritionItem label="Carbs" value={`${recipe.nutrition.carbs}`} unit="g" theme={theme} />
            <NutritionItem label="Fat" value={`${recipe.nutrition.fat}`} unit="g" theme={theme} />
          </View>
        </View>

        {/* Ingredients */}
        <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>
          Ingredients
        </Text>
        {recipe.ingredients.map((ingredient, index) => (
          <View key={index} style={styles.ingredientRow}>
            <Text style={[styles.bullet, { color: theme.colors.primary }]}>•</Text>
            <Text style={[styles.ingredientText, { color: theme.colors.text }]}>
              {ingredient}
            </Text>
          </View>
        ))}

        {/* Steps */}
        <Text style={[styles.sectionLabel, { color: theme.colors.text, marginTop: 24 }]}>
          Preparation Steps
        </Text>
        {recipe.steps.map((step, index) => (
          <View key={index} style={styles.stepRow}>
            <View style={[styles.stepNumber, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <Text style={[styles.stepText, { color: theme.colors.text }]}>
              {step}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * NutritionItem — Single nutrition value display.
 */
function NutritionItem({
  label,
  value,
  unit,
  theme,
}: {
  label: string;
  value: string;
  unit: string;
  theme: { colors: { text: string; textSecondary: string; primary: string } };
}) {
  return (
    <View style={styles.nutritionItem}>
      <Text style={[styles.nutritionValue, { color: theme.colors.primary }]}>
        {value}
        <Text style={styles.nutritionUnit}>{unit}</Text>
      </Text>
      <Text style={[styles.nutritionLabel, { color: theme.colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Returns an emoji for a recipe category to use as thumbnail placeholder.
 */
function getCategoryEmoji(category: string): string {
  switch (category) {
    case 'Breakfast':
      return '🍳';
    case 'Lunch':
      return '🥗';
    case 'Dinner':
      return '🍽️';
    case 'Snacks':
      return '🥜';
    case 'Smoothies':
      return '🥤';
    default:
      return '🍴';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionHeader: {
    paddingTop: 20,
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  card: {
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  thumbnail: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailEmoji: {
    fontSize: 32,
  },
  cardContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
    gap: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 2,
  },
  cardMetaText: {
    fontSize: 12,
  },
  // Detail styles
  detailHeader: {
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 8,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backText: {
    fontSize: 16,
    fontWeight: '500',
  },
  detailScroll: {
    flex: 1,
  },
  detailContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  detailThumbnail: {
    height: 160,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  detailThumbnailEmoji: {
    fontSize: 64,
  },
  detailCategory: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
    marginBottom: 8,
  },
  detailDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  prepTimeRow: {
    marginBottom: 20,
  },
  prepTimeText: {
    fontSize: 15,
    fontWeight: '500',
  },
  nutritionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  nutritionItem: {
    alignItems: 'center',
    flex: 1,
  },
  nutritionValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  nutritionUnit: {
    fontSize: 12,
    fontWeight: '400',
  },
  nutritionLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingLeft: 4,
  },
  bullet: {
    fontSize: 16,
    marginRight: 10,
    lineHeight: 22,
  },
  ingredientText: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  stepText: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
});
