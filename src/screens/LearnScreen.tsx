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
import learnArticles from '../content/learnArticles.json';

/**
 * Article data shape from the bundled JSON.
 */
interface Article {
  id: string;
  title: string;
  category: string;
  contentType: string;
  estimatedReadTime: string;
  body: string;
}

/**
 * Section shape for SectionList.
 */
interface ArticleSection {
  title: string;
  data: Article[];
}

/**
 * LearnScreen — Educational content for intermittent fasting.
 *
 * Implements Requirements 17.1, 17.2, 17.4:
 * - List of articles organized by category
 * - Full article content in readable format on tap
 * - Content type, estimated read time, and category displayed
 *
 * Uses SectionList for lazy-loaded, grouped display (Requirement 28.3).
 * State-based navigation between list and detail views.
 */
export function LearnScreen() {
  const { theme } = useTheme();
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  // Group articles by category into sections
  const sections: ArticleSection[] = useMemo(() => {
    const categoryMap = new Map<string, Article[]>();
    for (const article of learnArticles as Article[]) {
      const existing = categoryMap.get(article.category);
      if (existing) {
        existing.push(article);
      } else {
        categoryMap.set(article.category, [article]);
      }
    }
    return Array.from(categoryMap.entries()).map(([title, data]) => ({
      title,
      data,
    }));
  }, []);

  const handleArticlePress = useCallback((article: Article) => {
    setSelectedArticle(article);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedArticle(null);
  }, []);

  // Detail view
  if (selectedArticle) {
    return (
      <ArticleDetail
        article={selectedArticle}
        onBack={handleBack}
      />
    );
  }

  // List view
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Learn
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
          Educational articles about intermittent fasting
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
          <ArticleCard article={item} onPress={handleArticlePress} />
        )}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

/**
 * ArticleCard — Displays a single article in the list.
 */
function ArticleCard({
  article,
  onPress,
}: {
  article: Article;
  onPress: (article: Article) => void;
}) {
  const { theme } = useTheme();
  const cardColor = getCardColor(article.id, theme);

  return (
    <Pressable
      style={[styles.card, { backgroundColor: cardColor }]}
      onPress={() => onPress(article)}
      accessibilityRole="button"
      accessibilityLabel={`${article.title}. ${article.contentType}. ${article.estimatedReadTime} read.`}
    >
      <View style={styles.cardContent}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]} numberOfLines={2}>
          {article.title}
        </Text>
        <View style={styles.cardMeta}>
          <Text style={[styles.cardMetaText, { color: theme.colors.textSecondary }]}>
            📄 {article.contentType.charAt(0).toUpperCase() + article.contentType.slice(1)}
          </Text>
          <Text style={[styles.cardMetaText, { color: theme.colors.textSecondary }]}>
            ⏱ {article.estimatedReadTime}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * ArticleDetail — Full article content view.
 */
function ArticleDetail({
  article,
  onBack,
}: {
  article: Article;
  onBack: () => void;
}) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.detailHeader}>
        <Pressable
          onPress={onBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back to articles list"
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
        <Text style={[styles.detailCategory, { color: theme.colors.primary }]}>
          {article.category}
        </Text>
        <Text style={[styles.detailTitle, { color: theme.colors.text }]}>
          {article.title}
        </Text>
        <View style={styles.detailMeta}>
          <Text style={[styles.detailMetaText, { color: theme.colors.textSecondary }]}>
            📄 {article.contentType.charAt(0).toUpperCase() + article.contentType.slice(1)}
          </Text>
          <Text style={[styles.detailMetaText, { color: theme.colors.textSecondary }]}>
            ⏱ {article.estimatedReadTime}
          </Text>
        </View>
        <Text style={[styles.detailBody, { color: theme.colors.text }]}>
          {article.body}
        </Text>
      </ScrollView>
    </View>
  );
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
    padding: 16,
  },
  cardContent: {
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  cardMetaText: {
    fontSize: 13,
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
  detailCategory: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
    marginBottom: 12,
  },
  detailMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  detailMetaText: {
    fontSize: 14,
  },
  detailBody: {
    fontSize: 16,
    lineHeight: 26,
  },
});
