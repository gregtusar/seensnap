import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Screen } from "@/components/screen";
import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";

type Title = {
  id: string;
  tmdb_id: number;
  content_type: string;
  title: string;
  overview?: string | null;
  poster_url?: string | null;
  genres: string[];
  release_date?: string | null;
};

type WatchlistItem = {
  id: string;
  content_title_id: string;
};

type WatchlistResponse = {
  id: string;
  name: string;
  items: WatchlistItem[];
};

export default function HomeScreen() {
  const { sessionToken, user } = useAuth();
  const [query, setQuery] = useState("Breaking Bad");
  const [results, setResults] = useState<Title[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadWatchlist() {
      if (!sessionToken) {
        return;
      }

      try {
        const watchlist = await apiRequest<WatchlistResponse>("/me/watchlist", { token: sessionToken });
        setSavedIds(new Set(watchlist.items.map((item) => item.content_title_id)));
      } catch (watchlistError) {
        setError(watchlistError instanceof Error ? watchlistError.message : "Failed to load watchlist");
      }
    }

    void loadWatchlist();
  }, [sessionToken]);

  async function search() {
    if (!query.trim() || !sessionToken) {
      return;
    }
    setIsSearching(true);
    setError(null);
    try {
      const titles = await apiRequest<Title[]>(`/titles/search?q=${encodeURIComponent(query)}`, {
        token: sessionToken,
      });
      setResults(titles);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  }

  async function addToWatchlist(titleId: string) {
    if (!sessionToken) {
      return;
    }
    try {
      const watchlist = await apiRequest<WatchlistResponse>("/me/watchlist/items", {
        method: "POST",
        token: sessionToken,
        body: JSON.stringify({ content_title_id: titleId, added_via: "search" }),
      });
      setSavedIds(new Set(watchlist.items.map((item) => item.content_title_id)));
    } catch (watchlistError) {
      setError(watchlistError instanceof Error ? watchlistError.message : "Failed to save title");
    }
  }

  return (
    <Screen
      title="Home"
      subtitle="Identify titles fast, save them to My Picks, and keep your next watch close."
    >
      <ScrollView contentContainerStyle={styles.results}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroEyebrow}>Tonight's queue</Text>
              <Text style={styles.heroTitle}>Add snaps to your team</Text>
            </View>
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles" color={colors.background} size={16} />
              <Text style={styles.heroBadgeText}>Live</Text>
            </View>
          </View>
          <ImageBackground
            imageStyle={styles.posterFrameImage}
            source={results[0]?.poster_url ? { uri: results[0].poster_url } : undefined}
            style={styles.posterFrame}
          >
            <View style={styles.posterFrameOverlay}>
              <Text style={styles.posterTitle}>{results[0]?.title ?? "Skyfall"}</Text>
              <Text style={styles.posterMeta}>Point. Snip. Identify. Share.</Text>
            </View>
          </ImageBackground>
          <View style={styles.quickActions}>
            <View style={styles.quickAction}>
              <Ionicons name="camera" color={colors.accent} size={18} />
              <Text style={styles.quickActionLabel}>Identify</Text>
            </View>
            <View style={styles.quickAction}>
              <Ionicons name="star" color={colors.ink} size={18} />
              <Text style={styles.quickActionLabel}>Top 10</Text>
            </View>
            <View style={styles.quickAction}>
              <Ionicons name="disc" color={colors.ink} size={18} />
              <Text style={styles.quickActionLabel}>Watchlist</Text>
            </View>
            <View style={styles.quickAction}>
              <Ionicons name="help" color={colors.ink} size={18} />
              <Text style={styles.quickActionLabel}>Quiz</Text>
            </View>
          </View>
          <Pressable style={styles.ctaBar}>
            <Ionicons name="flash" color={colors.accent} size={18} />
            <Text style={styles.ctaText}>Add snips to your watch team</Text>
            <Ionicons name="chevron-forward" color={colors.muted} size={18} />
          </Pressable>
        </View>

        <View style={styles.searchCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Search TMDB</Text>
            <Text style={styles.sectionMeta}>{user?.display_name ?? "SeenSnap user"}</Text>
          </View>
          <TextInput
            autoCapitalize="words"
            onChangeText={setQuery}
            onSubmitEditing={() => void search()}
            placeholder="Search movies or series"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={query}
          />
          <Pressable onPress={() => void search()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonLabel}>{isSearching ? "Searching..." : "Search titles"}</Text>
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.rowHeader}>
          <Text style={styles.sectionTitle}>Recommended for you</Text>
          <Text style={styles.rowMeta}>{results.length} results</Text>
        </View>
        {isSearching ? <ActivityIndicator color={colors.accent} /> : null}
        {results.map((title) => (
          <View key={title.id} style={styles.resultCard}>
            <View style={styles.resultHeader}>
              {title.poster_url ? (
                <Image source={{ uri: title.poster_url }} style={styles.posterImage} />
              ) : (
                <View style={styles.posterStub}>
                  <Text style={styles.posterStubType}>{title.content_type.slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.resultCopy}>
                <Text style={styles.resultTitle}>{title.title}</Text>
                <Text style={styles.resultMeta}>{title.content_type}</Text>
                <Text style={styles.resultGenres}>{title.genres.join(" • ") || "Genres unavailable"}</Text>
              </View>
              <View style={styles.rankBox}>
                <Text style={styles.rankValue}>{savedIds.has(title.id) ? "OK" : "8.0"}</Text>
              </View>
            </View>
            <Text numberOfLines={3} style={styles.resultBody}>
              {title.overview || "No overview available yet."}
            </Text>
            <Pressable
              disabled={savedIds.has(title.id)}
              onPress={() => void addToWatchlist(title.id)}
              style={({ pressed }) => [
                styles.secondaryButton,
                savedIds.has(title.id) && styles.secondaryButtonDisabled,
                pressed && !savedIds.has(title.id) && styles.secondaryButtonPressed,
              ]}
            >
              <Text style={styles.secondaryButtonLabel}>
                {savedIds.has(title.id) ? "Saved to My Picks" : "Add to My Picks"}
              </Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  heroEyebrow: {
    fontSize: 12,
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontWeight: "800",
  },
  heroTitle: {
    marginTop: 4,
    fontSize: 28,
    lineHeight: 30,
    color: colors.ink,
    fontWeight: "900",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroBadgeText: {
    color: colors.background,
    fontWeight: "800",
  },
  posterFrame: {
    minHeight: 170,
    justifyContent: "flex-end",
    borderRadius: radii.md,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: "#284566",
    overflow: "hidden",
  },
  posterFrameImage: {
    resizeMode: "cover",
  },
  posterFrameOverlay: {
    minHeight: 170,
    justifyContent: "flex-end",
    padding: spacing.lg,
    backgroundColor: "rgba(9, 16, 28, 0.44)",
  },
  posterTitle: {
    fontSize: 34,
    color: colors.accent,
    fontWeight: "900",
  },
  posterMeta: {
    color: colors.ink,
    marginTop: 6,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  quickAction: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: "rgba(27, 42, 68, 0.85)",
  },
  quickActionLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  ctaBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    backgroundColor: "#0f1b2d",
    borderWidth: 1,
    borderColor: colors.border,
  },
  ctaText: {
    flex: 1,
    color: colors.ink,
    fontWeight: "700",
  },
  searchCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.ink,
  },
  sectionMeta: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
  },
  primaryButton: {
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    paddingVertical: 14,
  },
  primaryButtonLabel: {
    textAlign: "center",
    color: colors.background,
    fontWeight: "800",
    fontSize: 15,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
  results: {
    gap: spacing.md,
    paddingBottom: 32,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  rowMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  resultCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  posterImage: {
    width: 56,
    height: 72,
    borderRadius: 16,
    backgroundColor: colors.backgroundElevated,
  },
  posterStub: {
    width: 56,
    height: 72,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.backgroundElevated,
  },
  posterStubType: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: "900",
  },
  resultCopy: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: colors.ink,
  },
  resultMeta: {
    textTransform: "capitalize",
    color: colors.accent,
    fontWeight: "700",
  },
  rankBox: {
    minWidth: 54,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: colors.accent,
    alignItems: "center",
  },
  rankValue: {
    color: colors.background,
    fontWeight: "900",
    fontSize: 18,
  },
  resultBody: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  resultGenres: {
    color: colors.muted,
    fontSize: 13,
  },
  secondaryButton: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: 12,
  },
  secondaryButtonPressed: {
    opacity: 0.85,
  },
  secondaryButtonDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
  },
  secondaryButtonLabel: {
    textAlign: "center",
    color: colors.ink,
    fontWeight: "800",
  },
});
