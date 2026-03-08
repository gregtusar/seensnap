import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors, radii, spacing } from "@/constants/theme";
import { AddToTeamSheet } from "@/components/add-to-team-sheet";
import { UniversalTitleModal } from "@/components/universal-title-modal";
import { fetchUniversalTitle, type UniversalTitle } from "@/lib/universal-title";

type Title = {
  id: string;
  tmdb_id: number;
  content_type: string;
  title: string;
  overview?: string | null;
  poster_url?: string | null;
  backdrop_url?: string | null;
  genres: string[];
  release_date?: string | null;
  runtime_minutes?: number | null;
  season_count?: number | null;
  tmdb_rating?: number | null;
  language?: string | null;
  director?: string | null;
  top_cast?: string[];
  wikipedia_url?: string | null;
  metadata_source?: string;
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

type FeedEvent = {
  id: string;
  title?: Title | null;
  payload: Record<string, unknown>;
};

const SAVE_LISTS = ["My Picks", "Favorites", "Watch Soon", "Date Night", "Sci-Fi", "New List"] as const;

export default function HomeScreen() {
  const { sessionToken, user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Title[]>([]);
  const [recommendedSource, setRecommendedSource] = useState<FeedEvent[]>([]);
  const [recommendedVisibleCount, setRecommendedVisibleCount] = useState(8);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [selectedTitle, setSelectedTitle] = useState<Title | null>(null);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [showPostComposer, setShowPostComposer] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [universalTitle, setUniversalTitle] = useState<UniversalTitle | null>(null);
  const [showAddToTeam, setShowAddToTeam] = useState(false);
  const [addToTeamTitle, setAddToTeamTitle] = useState<{ id: string; title: string } | null>(null);
  const [composeCaption, setComposeCaption] = useState("");
  const [composeRating, setComposeRating] = useState("");
  const [shareToTeam, setShareToTeam] = useState(false);
  const [composerViewportHeight, setComposerViewportHeight] = useState<number | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  const rootScrollRef = useRef<ScrollView>(null);
  const composerScrollRef = useRef<ScrollView>(null);
  const searchPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(searchPulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(searchPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [searchPulse]);

  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }
    const win = globalThis as any;
    const vv = win.visualViewport;
    if (!vv) {
      return;
    }
    const handleResize = () => setComposerViewportHeight(vv.height);
    setComposerViewportHeight(vv.height);
    vv.addEventListener("resize", handleResize);
    return () => vv.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    async function loadHome() {
      if (!sessionToken) {
        return;
      }
      setError(null);
      try {
        const [watchlist, forYou] = await Promise.all([
          apiRequest<WatchlistResponse>("/me/watchlist", { token: sessionToken }),
          apiRequest<FeedEvent[]>("/feed/for-you?limit=100", { token: sessionToken }),
        ]);
        setSavedIds(new Set(watchlist.items.map((item) => item.content_title_id)));
        setRecommendedSource(forYou);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load home");
      }
    }
    void loadHome();
  }, [sessionToken]);

  useEffect(() => {
    if (!sessionToken) {
      return;
    }
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      try {
        const data = await apiRequest<Title[]>(`/titles/search?q=${encodeURIComponent(query.trim())}`, {
          token: sessionToken,
        });
        setResults(data);
      } catch (searchError) {
        setError(searchError instanceof Error ? searchError.message : "Search failed");
      } finally {
        setIsSearching(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, sessionToken]);

  async function quickSave(title: Title, listName = "My Picks") {
    if (!sessionToken) {
      return;
    }
    try {
      const watchlist = await apiRequest<WatchlistResponse>("/me/watchlist/items", {
        method: "POST",
        token: sessionToken,
        body: JSON.stringify({ content_title_id: title.id, added_via: "home_v2" }),
      });
      setSavedIds(new Set(watchlist.items.map((item) => item.content_title_id)));
      setToast(listName === "My Picks" ? "Saved to My Picks" : `Saved to ${listName}`);
      setShowSaveSheet(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed");
    }
  }

  async function openDetails(title: Title) {
    if (!sessionToken) {
      return;
    }
    setSelectedTitle(title);
    setShowDetails(true);
    setDetailLoading(true);
    try {
      const universal = await fetchUniversalTitle(sessionToken, title.id, title);
      setUniversalTitle(universal);
    } catch (detailError) {
      setUniversalTitle(null);
      setError(detailError instanceof Error ? detailError.message : "Failed to load full details");
    } finally {
      setDetailLoading(false);
    }
  }

  function openComposer(title: Title) {
    setSelectedTitle(title);
    setComposeCaption("");
    setComposeRating(title.tmdb_rating ? `${Math.round(title.tmdb_rating)}` : "");
    setShareToTeam(false);
    setShowPostComposer(true);
  }

  function openAddToTeam(title: Title) {
    setAddToTeamTitle({ id: title.id, title: title.title });
    setShowAddToTeam(true);
  }

  async function postToSocialWall() {
    if (!sessionToken || !selectedTitle || isPosting) {
      return;
    }
    setIsPosting(true);
    try {
      const event = await apiRequest<FeedEvent>("/feed/wall-posts", {
        method: "POST",
        token: sessionToken,
        body: JSON.stringify({
          content_title_id: selectedTitle.id,
          caption: composeCaption.trim() || null,
          rating: composeRating ? Number(composeRating) : null,
          share_to_team_id: null,
        }),
      });
      setRecommendedSource((prev) => [event, ...prev]);
      setShowPostComposer(false);
      setToast("Posted to your Social Wall");
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : "Post failed");
    } finally {
      setIsPosting(false);
    }
  }

  const recommendedTitles = useMemo(() => {
    const deduped = new Map<string, Title>();
    for (const event of recommendedSource) {
      if (event.title && !deduped.has(event.title.id)) {
        deduped.set(event.title.id, event.title);
      }
    }
    return Array.from(deduped.values()).slice(0, recommendedVisibleCount);
  }, [recommendedSource, recommendedVisibleCount]);

  const showSearchPrompt = query.trim().length < 3;
  const showNoResults = query.trim().length >= 3 && !isSearching && results.length === 0;
  const composerMaxHeight = composerViewportHeight ? Math.floor(composerViewportHeight * 0.88) : undefined;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.pageGlow} />
      <ScrollView
        ref={rootScrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View style={styles.hero}>
          <View style={styles.logoGlow} />
          <Image source={require("../../assets/branding/seensnap-logo.png")} style={styles.logo} resizeMode="contain" />
          <Pressable style={styles.bellButton}>
            <Ionicons name="notifications-outline" size={19} color={colors.ink} />
          </Pressable>
          <Text style={styles.heroTitle}>{`Welcome back, ${user?.display_name?.split(" ")[0] ?? "Elizabeth"}.`}</Text>
          <Text style={styles.heroSubtitle}>Your next favorite show is one tap away.</Text>
        </View>

        <View style={styles.searchModule}>
          <View style={styles.searchBar}>
            <Animated.View style={{ transform: [{ scale: searchPulse }] }}>
              <Ionicons name="search" size={18} color={colors.muted} />
            </Animated.View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onFocus={() => {
                rootScrollRef.current?.scrollTo({ y: 220, animated: true });
                if (Platform.OS === "web") {
                  const el = globalThis.document?.activeElement as HTMLElement | null;
                  el?.scrollIntoView?.({ block: "center", behavior: "smooth" });
                }
              }}
              autoCapitalize="words"
              placeholder="Search for a movie or show"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
            />
          </View>
          <Text style={styles.searchSubtext}>Powered by TMDB</Text>
        </View>

        {showSearchPrompt ? (
          <View style={styles.promptCard}>
            <Ionicons name="film-outline" size={17} color={colors.muted} />
            <Text style={styles.promptText}>Start by searching for a title you love.</Text>
          </View>
        ) : null}
        {showNoResults ? <Text style={styles.infoText}>No exact matches found. Try another title.</Text> : null}
        {isSearching ? <Text style={styles.infoText}>Searching...</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {results.map((title) => (
          <View key={title.id} style={styles.resultCard}>
            {title.poster_url ? (
              <Image source={{ uri: title.poster_url }} style={styles.resultPoster} />
            ) : (
              <View style={styles.resultPosterFallback} />
            )}
            <View style={styles.resultBody}>
              <Text style={styles.resultTitle}>{title.title}</Text>
              <Text style={styles.resultMeta}>
                {(title.release_date ? `${new Date(title.release_date).getFullYear()} · ` : "") +
                  (title.genres[0] ? `${title.genres[0]} · ` : "") +
                  (title.content_type === "movie"
                    ? `${title.runtime_minutes ?? "—"} min`
                    : `${title.season_count ?? "—"} seasons`)}
              </Text>
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => void quickSave(title)}
                  onLongPress={() => {
                    setSelectedTitle(title);
                    setShowSaveSheet(true);
                  }}
                  style={({ pressed }) => [
                    styles.actionPill,
                    savedIds.has(title.id) && styles.actionPillSaved,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={savedIds.has(title.id) ? "bookmark" : "bookmark-outline"}
                    size={14}
                    color={savedIds.has(title.id) ? colors.accent : colors.ink}
                  />
                  <Text style={styles.actionLabel}>Save</Text>
                </Pressable>
                <Pressable onPress={() => openComposer(title)} style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]}>
                  <Ionicons name="share-social-outline" size={14} color={colors.ink} />
                  <Text style={styles.actionLabel}>Post</Text>
                </Pressable>
                <Pressable onPress={() => openAddToTeam(title)} style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]}>
                  <Ionicons name="people-outline" size={14} color={colors.ink} />
                  <Text style={styles.actionLabel}>Team</Text>
                </Pressable>
                <Pressable onPress={() => void openDetails(title)} style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]}>
                  <Ionicons name="information-circle-outline" size={14} color={colors.ink} />
                  <Text style={styles.actionLabel}>Details</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recommended for You</Text>
          <Text style={styles.sectionSub}>Based on your saved picks and lists.</Text>
        </View>
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recommendationRow}
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            if (layoutMeasurement.width + contentOffset.x >= contentSize.width - 60) {
              setRecommendedVisibleCount((prev) => Math.min(prev + 6, 60));
            }
          }}
          scrollEventThrottle={16}
        >
          {recommendedTitles.map((title) => (
            <View key={title.id} style={styles.recommendationCard}>
              {title.poster_url ? (
                <Image source={{ uri: title.poster_url }} style={styles.recommendationPoster} />
              ) : (
                <View style={styles.recommendationPosterFallback} />
              )}
              <Text numberOfLines={1} style={styles.recommendationTitle}>{title.title}</Text>
              <Text numberOfLines={2} style={styles.recommendationMeta}>
                {(title.release_date ? `${new Date(title.release_date).getFullYear()} · ` : "") +
                  (title.genres[0] ? `${title.genres[0]} · ` : "") +
                  (title.content_type === "movie"
                    ? `${title.runtime_minutes ?? "—"} min`
                    : `${title.season_count ?? "—"} seasons`)}
              </Text>
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => void quickSave(title)}
                  onLongPress={() => {
                    setSelectedTitle(title);
                    setShowSaveSheet(true);
                  }}
                  style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]}
                >
                  <Ionicons name="bookmark-outline" size={14} color={colors.ink} />
                  <Text style={styles.actionLabel}>Save</Text>
                </Pressable>
                <Pressable onPress={() => openComposer(title)} style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]}>
                  <Ionicons name="share-social-outline" size={14} color={colors.ink} />
                  <Text style={styles.actionLabel}>Share</Text>
                </Pressable>
                <Pressable onPress={() => openAddToTeam(title)} style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]}>
                  <Ionicons name="people-outline" size={14} color={colors.ink} />
                  <Text style={styles.actionLabel}>Team</Text>
                </Pressable>
                <Pressable onPress={() => void openDetails(title)} style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]}>
                  <Ionicons name="information-circle-outline" size={14} color={colors.ink} />
                  <Text style={styles.actionLabel}>Details</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      </ScrollView>

      <Modal transparent visible={showSaveSheet} animationType="slide" onRequestClose={() => setShowSaveSheet(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowSaveSheet(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Save to a List</Text>
          {SAVE_LISTS.map((name) => (
            <Pressable key={name} style={styles.sheetButton} onPress={() => selectedTitle && void quickSave(selectedTitle, name)}>
              <Text style={styles.sheetButtonLabel}>{name}</Text>
            </Pressable>
          ))}
        </View>
      </Modal>

      <Modal transparent visible={showPostComposer} animationType="slide" onRequestClose={() => setShowPostComposer(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowPostComposer(false)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
          style={styles.composerWrap}
        >
          <View style={[styles.sheet, composerMaxHeight ? { maxHeight: composerMaxHeight } : null]}>
            <Text style={styles.sheetTitle}>Post to Social Wall</Text>
            <ScrollView
              ref={composerScrollRef}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.composerScroll}
            >
              {selectedTitle?.poster_url ? (
                <Image source={{ uri: selectedTitle.poster_url }} style={styles.composePoster} />
              ) : null}
              <Text style={styles.sheetSubTitle}>{selectedTitle?.title}</Text>
              <Text style={styles.sheetSubTitle}>TMDB: {selectedTitle?.tmdb_rating ?? "—"}</Text>
              <TextInput
                value={composeCaption}
                onChangeText={setComposeCaption}
                onFocus={() => composerScrollRef.current?.scrollToEnd({ animated: true })}
                placeholder="Add caption (optional)"
                placeholderTextColor={colors.muted}
                style={styles.textInput}
                multiline
              />
              <TextInput
                value={composeRating}
                onChangeText={setComposeRating}
                onFocus={() => composerScrollRef.current?.scrollToEnd({ animated: true })}
                placeholder="Add rating (optional)"
                keyboardType="numeric"
                placeholderTextColor={colors.muted}
                style={styles.textInput}
              />
              <View style={styles.switchRow}>
                <Text style={styles.sheetButtonLabel}>Also share to Watch Team</Text>
                <Switch value={shareToTeam} onValueChange={setShareToTeam} trackColor={{ true: colors.accent }} />
              </View>
            </ScrollView>
            <View style={styles.composerFooter}>
              <Pressable onPress={() => setShowPostComposer(false)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonLabel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={() => void postToSocialWall()} style={styles.primaryButton}>
                <Text style={styles.primaryButtonLabel}>{isPosting ? "Posting..." : "Post"}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <UniversalTitleModal
        visible={showDetails}
        loading={detailLoading}
        title={universalTitle}
        onClose={() => setShowDetails(false)}
        onSave={() => {
          if (selectedTitle) {
            void quickSave(selectedTitle);
          }
        }}
        onPost={() => {
          if (selectedTitle) {
            openComposer(selectedTitle);
          }
        }}
        onAddToTeam={() => {
          if (selectedTitle) {
            openAddToTeam(selectedTitle);
          }
        }}
      />

      <AddToTeamSheet
        visible={showAddToTeam}
        token={sessionToken}
        title={addToTeamTitle}
        onClose={() => setShowAddToTeam(false)}
        onAdded={(teamName) => setToast(`Added to ${teamName}`)}
        onError={(message) => setError(message)}
      />

      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastLabel}>{toast}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  pageGlow: {
    position: "absolute",
    top: -120,
    left: -40,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#1b3d67",
    opacity: 0.22,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 120,
    gap: spacing.md,
  },
  hero: {
    borderRadius: 22,
    padding: spacing.lg,
    alignItems: "center",
    backgroundColor: "rgba(11, 20, 36, 0.58)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoGlow: {
    position: "absolute",
    top: 12,
    width: 220,
    height: 84,
    borderRadius: 84,
    backgroundColor: "rgba(244, 196, 48, 0.14)",
  },
  logo: { width: 182, height: 56 },
  bellButton: {
    position: "absolute",
    right: 14,
    top: 14,
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heroTitle: { marginTop: 10, color: colors.ink, fontSize: 28, fontWeight: "900", textAlign: "center" },
  heroSubtitle: { marginTop: 6, color: colors.muted, lineHeight: 21, textAlign: "center" },
  searchModule: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#3a4f6b",
    backgroundColor: "#111f35",
    paddingHorizontal: 14,
    paddingVertical: 15,
    minHeight: 54,
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: 16 },
  searchSubtext: { color: colors.muted, fontSize: 12 },
  promptCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  promptText: { color: colors.muted },
  infoText: { color: colors.muted, fontSize: 12 },
  errorText: { color: colors.danger, fontSize: 12 },
  resultCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    flexDirection: "row",
    gap: spacing.sm,
  },
  resultPoster: { width: 88, height: 132, borderRadius: 11, backgroundColor: colors.backgroundElevated },
  resultPosterFallback: { width: 88, height: 132, borderRadius: 11, backgroundColor: colors.backgroundElevated },
  resultBody: { flex: 1, gap: 6 },
  resultTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  resultMeta: { color: colors.muted, fontSize: 12 },
  actionRow: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionPill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    paddingVertical: 7,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionPillSaved: { borderColor: colors.success },
  actionLabel: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  sectionHeader: { marginTop: spacing.sm, gap: 4 },
  sectionTitle: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  sectionSub: { color: colors.muted, fontSize: 13 },
  recommendationRow: { gap: spacing.sm, paddingBottom: spacing.sm },
  recommendationCard: {
    width: 180,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  recommendationPoster: { width: "100%", aspectRatio: 2 / 3, borderRadius: 11, backgroundColor: colors.backgroundElevated },
  recommendationPosterFallback: { width: "100%", aspectRatio: 2 / 3, borderRadius: 11, backgroundColor: colors.backgroundElevated },
  recommendationTitle: { color: colors.ink, fontWeight: "800", marginTop: 8 },
  recommendationMeta: { color: colors.muted, fontSize: 12, marginTop: 3, minHeight: 34 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(4, 9, 17, 0.72)" },
  composerWrap: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    marginTop: "auto",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
  },
  detailsSheet: { maxHeight: "88%" },
  sheetTitle: { color: colors.ink, fontSize: 21, fontWeight: "900" },
  sheetSubTitle: { color: colors.muted, fontSize: 13 },
  sheetButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  sheetButtonLabel: { color: colors.ink, fontWeight: "700" },
  composePoster: { width: 72, height: 108, borderRadius: 10, backgroundColor: colors.backgroundElevated },
  composerScroll: { gap: spacing.sm, paddingBottom: spacing.md },
  textInput: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    color: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  composerFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  detailBackdrop: { width: "100%", aspectRatio: 16 / 9, borderRadius: 14, marginBottom: spacing.sm },
  detailMeta: { color: colors.muted, lineHeight: 20 },
  detailCopy: { color: colors.ink, marginTop: 6, lineHeight: 21 },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonLabel: { color: colors.background, fontWeight: "800" },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonLabel: { color: colors.accent, fontWeight: "800" },
  tertiaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    paddingVertical: 12,
    alignItems: "center",
  },
  tertiaryButtonLabel: { color: colors.ink, fontWeight: "700" },
  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 88,
    borderRadius: 14,
    backgroundColor: "rgba(46, 196, 182, 0.96)",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  toastLabel: { color: colors.background, textAlign: "center", fontWeight: "800" },
});
