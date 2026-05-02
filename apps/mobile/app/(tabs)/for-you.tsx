import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SaveToListSheet } from "@/components/save-to-list-sheet";
import { UniversalTitleModal } from "@/components/universal-title-modal";
import { colors, radii, spacing } from "@/constants/theme";
import { apiRequest, resolveMediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fetchUniversalTitle, type UniversalTitle } from "@/lib/universal-title";

type MeProfile = {
  user_id: string;
  email: string;
  username: string;
  display_name: string;
  favorite_genres: string[];
  country_code: string;
  avatar_url?: string | null;
  bio?: string | null;
};

type TasteGenreScore = {
  genre: string;
  score: number;
};

type TasteLabel = {
  label: string;
  confidence: number;
};

type TasteTitle = {
  title_id?: string | null;
  title_name: string;
  poster_url?: string | null;
};

type TasteProfile = {
  user_id: string;
  top_genres: TasteGenreScore[];
  top_themes: string[];
  top_platforms: string[];
  favorite_eras: string[];
  taste_labels: TasteLabel[];
  profile_summary?: string | null;
  current_obsessions: TasteTitle[];
  top_posters: string[];
  most_saved_genre?: string | null;
  updated_at?: string | null;
};

type RecommendationItem = {
  title: {
    id: string;
    title: string;
    content_type: string;
    poster_url?: string | null;
    backdrop_url?: string | null;
    overview?: string | null;
    release_date?: string | null;
    genres?: string[];
  };
  reason: string;
  seed_title_id?: string | null;
};

type TeamSummary = {
  id: string;
  name: string;
  description?: string | null;
  member_count: number;
};

type TeamAnalytics = {
  team_id: string;
  average_compatibility: number;
  most_aligned_members: {
    compatibility: number;
    summary?: string | null;
    members: Array<{
      user_id: string;
      display_name?: string | null;
      avatar_url?: string | null;
      score?: number | null;
      detail?: string | null;
    }>;
  };
  most_divisive_member?: {
    user_id: string;
    display_name?: string | null;
    avatar_url?: string | null;
    score?: number | null;
    detail?: string | null;
  } | null;
  taste_mvp?: {
    user_id: string;
    display_name?: string | null;
    avatar_url?: string | null;
    score?: number | null;
    detail?: string | null;
  } | null;
  most_loved_title?: TasteTitle | null;
  most_divisive_title?: TasteTitle | null;
  genre_breakdown: Array<{ genre: string; percent: number }>;
};

const HERO_FALLBACK = [
  "This is your lane.",
  "Your taste is getting sharper, moodier, and more specific.",
];

export default function ForYouScreen() {
  const router = useRouter();
  const { sessionToken } = useAuth();
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [taste, setTaste] = useState<TasteProfile | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [teamAnalytics, setTeamAnalytics] = useState<TeamAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailTitle, setDetailTitle] = useState<UniversalTitle | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [saveTitleId, setSaveTitleId] = useState<string | null>(null);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const motion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    async function load() {
      if (!sessionToken) {
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const me = await apiRequest<MeProfile>("/me", { token: sessionToken });
        setProfile(me);
        const [tasteProfile, recs, teamList] = await Promise.all([
          apiRequest<TasteProfile>(`/profiles/${me.user_id}/taste`, { token: sessionToken }),
          apiRequest<RecommendationItem[]>("/titles/recommendations/for-me?limit=18", { token: sessionToken }),
          apiRequest<TeamSummary[]>("/teams", { token: sessionToken }),
        ]);
        setTaste(tasteProfile);
        setRecommendations(recs);
        setTeams(teamList);
        if (teamList.length > 0) {
          try {
            const analytics = await apiRequest<TeamAnalytics>(`/teams/${teamList[0].id}/analytics`, { token: sessionToken });
            setTeamAnalytics(analytics);
          } catch {
            setTeamAnalytics(null);
          }
        } else {
          setTeamAnalytics(null);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load For You");
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [sessionToken]);

  useEffect(() => {
    motion.setValue(0);
    Animated.timing(motion, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [motion, taste, recommendations.length, teamAnalytics?.team_id]);

  async function openDetails(item: RecommendationItem | TasteTitle) {
    if (!sessionToken) {
      return;
    }
    const titleId = "title" in item ? item.title.id : item.title_id;
    if (!titleId) {
      return;
    }
    setShowDetails(true);
    setDetailLoading(true);
    try {
      const seed =
        "title" in item
          ? {
              id: item.title.id,
              title: item.title.title,
              content_type: item.title.content_type,
              poster_url: item.title.poster_url,
              backdrop_url: item.title.backdrop_url,
              overview: item.title.overview,
            }
          : {
              id: titleId,
              title: item.title_name,
              content_type: "movie",
              poster_url: item.poster_url,
            };
      const full = await fetchUniversalTitle(sessionToken, titleId, seed);
      setDetailTitle(full);
    } catch (detailError) {
      setDetailTitle(null);
      setError(detailError instanceof Error ? detailError.message : "Could not load title details");
    } finally {
      setDetailLoading(false);
    }
  }

  const heroBackdrop = useMemo(() => {
    const candidates = [
      ...(taste?.top_posters ?? []),
      ...(taste?.current_obsessions.map((item) => item.poster_url ?? "") ?? []),
      ...recommendations.flatMap((item) => [item.title.backdrop_url ?? "", item.title.poster_url ?? ""]),
    ]
      .map((item) => resolveMediaUrl(item))
      .filter((item): item is string => Boolean(item));
    return candidates.slice(0, 3);
  }, [recommendations, taste]);

  const heroIntro = useMemo(() => {
    return buildHeroIntro(profile?.display_name, taste);
  }, [profile?.display_name, taste]);

  const heroSummary = useMemo(() => {
    return buildHeroSummary(taste);
  }, [taste]);

  const eraCopy = useMemo(() => {
    return buildEraCopy(taste);
  }, [taste]);

  const patternCards = useMemo(() => {
    return buildPatternCards(taste);
  }, [taste]);

  const groupedRecommendations = useMemo(() => {
    return groupRecommendations(recommendations);
  }, [recommendations]);

  const pulseHeadline = useMemo(() => {
    return buildPulseHeadline(teams[0], teamAnalytics);
  }, [teamAnalytics, teams]);

  const stagger = (index: number) => ({
    opacity: motion,
    transform: [
      {
        translateY: motion.interpolate({
          inputRange: [0, 1],
          outputRange: [18 + index * 4, 0],
        }),
      },
    ],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.hero, stagger(0)]}>
          <View style={styles.heroBackdropWrap}>
            {heroBackdrop.length > 0 ? (
              heroBackdrop.map((uri, index) => (
                <Image
                  key={`${uri}-${index}`}
                  source={{ uri }}
                  style={[
                    styles.heroBackdropImage,
                    index === 0 ? styles.heroBackdropPrimary : null,
                    index === 1 ? styles.heroBackdropSecondary : null,
                    index === 2 ? styles.heroBackdropTertiary : null,
                  ]}
                  resizeMode="cover"
                />
              ))
            ) : (
              <View style={styles.heroBackdropFallback} />
            )}
            <View style={styles.heroBackdropShade} />
            <View style={styles.heroGlowOne} />
            <View style={styles.heroGlowTwo} />
          </View>
          <View style={styles.heroCopy}>
            <View style={styles.heroTopRow}>
              <Text style={styles.heroKicker}>For You</Text>
              <View style={styles.heroLivePill}>
                <View style={styles.heroLiveDot} />
                <Text style={styles.heroLiveText}>Always evolving</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>{heroIntro}</Text>
            <Text style={styles.heroBody}>{heroSummary}</Text>
            <View style={styles.heroChipRow}>
              <HeroChip icon="sparkles" label={taste?.taste_labels[0]?.label ?? "Your taste profile"} />
              <HeroChip icon="flame" label={taste?.most_saved_genre ?? "Finding your next fixation"} />
              <HeroChip icon="tv" label={taste?.top_platforms[0] ?? "Your next streaming phase"} />
            </View>
            <View style={styles.heroActionRow}>
              <Pressable style={styles.heroPrimaryAction} onPress={() => router.push("/what-next")}>
                <Ionicons name="sparkles" size={16} color={colors.background} />
                <Text style={styles.heroPrimaryActionText}>Find Your Next Watch</Text>
              </Pressable>
              <Pressable style={styles.heroSecondaryAction} onPress={() => router.push("/what-next")}>
                <Text style={styles.heroSecondaryActionText}>Not sure what to watch?</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>

        {isLoading ? <ActivityIndicator color={colors.accent} style={styles.loading} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {taste ? (
          <>
            <Animated.View style={stagger(1)}>
              <Section
                title="Your Taste Profile"
                subtitle="The genres, moods, and storytelling styles you keep drifting back to."
              >
                <View style={styles.labelGrid}>
                  {taste.taste_labels.length > 0 ? (
                    taste.taste_labels.map((item, index) => (
                      <View key={item.label} style={[styles.labelCard, index === 0 ? styles.labelCardFeatured : null]}>
                        <Text style={styles.labelTitle}>{item.label}</Text>
                        <Text style={styles.labelCaption}>{buildLabelCaption(item.label)}</Text>
                        <Text style={styles.labelConfidence}>{item.confidence}% match</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>Keep saving and rating. Your taste profile is still coming into focus.</Text>
                  )}
                </View>
              </Section>
            </Animated.View>

            <Animated.View style={stagger(2)}>
              <Section title="Your Patterns" subtitle="What you keep coming back to lately.">
                <View style={styles.patternGrid}>
                  {patternCards.map((item) => (
                    <View key={item.title} style={styles.patternCard}>
                      <Text style={styles.patternTitle}>{item.title}</Text>
                      <Text style={styles.patternValue}>{item.value}</Text>
                      <Text style={styles.patternBody}>{item.body}</Text>
                    </View>
                  ))}
                </View>
              </Section>
            </Animated.View>

            <Animated.View style={stagger(3)}>
              <View style={styles.eraCard}>
                <Text style={styles.eraEyebrow}>Your era right now</Text>
                <Text style={styles.eraTitle}>{eraCopy.title}</Text>
                <Text style={styles.eraBody}>{eraCopy.body}</Text>
              </View>
            </Animated.View>

            <Animated.View style={stagger(4)}>
              <Section title="Currently Obsessing Over" subtitle="The titles and moods taking up space in your head right now.">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
                  {taste.current_obsessions.length > 0 ? (
                    taste.current_obsessions.map((item, index) => (
                      <Pressable key={`${item.title_id}-${item.title_name}`} style={[styles.obsessionCard, index === 0 ? styles.obsessionCardFeatured : null]} onPress={() => void openDetails(item)}>
                        <Poster uri={item.poster_url} style={styles.obsessionPoster} iconSize={22} />
                        <View style={styles.obsessionCopy}>
                          <Text style={styles.obsessionTag}>{index === 0 ? "Top obsession" : "In rotation"}</Text>
                          <Text style={styles.obsessionTitle} numberOfLines={2}>{item.title_name}</Text>
                        </View>
                      </Pressable>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>Nothing is taking over your watchlist just yet.</Text>
                  )}
                </ScrollView>
              </Section>
            </Animated.View>
          </>
        ) : null}

        <Animated.View style={stagger(5)}>
          <Section title="Picked For Tonight" subtitle="Recommendations that feel a little too on-brand for you.">
            <View style={styles.recommendationSectionList}>
              {groupedRecommendations.length > 0 ? (
                groupedRecommendations.map((group) => (
                  <View key={group.title} style={styles.recommendationGroup}>
                    <View style={styles.recommendationGroupHeader}>
                      <Text style={styles.recommendationGroupTitle}>{group.title}</Text>
                      <Text style={styles.recommendationGroupSubtitle}>{group.subtitle}</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendationRow}>
                      {group.items.map((item) => (
                        <Pressable key={item.title.id} style={styles.recommendationCard} onPress={() => void openDetails(item)}>
                          <Poster uri={item.title.poster_url} style={styles.recommendationPoster} iconSize={20} />
                          <View style={styles.recommendationOverlay}>
                            <Text style={styles.recommendationReason}>{humanizeReason(item.reason)}</Text>
                            <Text style={styles.recommendationTitle} numberOfLines={2}>{item.title.title}</Text>
                            <Text style={styles.recommendationMeta} numberOfLines={2}>
                              {item.title.overview || buildRecommendationMeta(item)}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => {
                              setSaveTitleId(item.title.id);
                              setShowSaveSheet(true);
                            }}
                            style={styles.saveButton}
                          >
                            <Ionicons name="bookmark-outline" size={18} color={colors.ink} />
                          </Pressable>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>We are still pulling together a sharper set of picks for you.</Text>
              )}
            </View>
          </Section>
        </Animated.View>

        {teams.length > 0 ? (
          <Animated.View style={stagger(6)}>
            <Section title="Your Team Pulse" subtitle="A quick read on the mood inside your watch circle.">
              <View style={styles.teamCard}>
                <View style={styles.teamTopRow}>
                  <View style={styles.teamHeading}>
                    <Text style={styles.teamName}>{teams[0].name}</Text>
                    <Text style={styles.teamMeta}>{teams[0].member_count} members</Text>
                  </View>
                  <View style={styles.compatibilityBadge}>
                    <Text style={styles.compatibilityValue}>{teamAnalytics?.average_compatibility ?? 0}%</Text>
                    <Text style={styles.compatibilityLabel}>in sync</Text>
                  </View>
                </View>
                <Text style={styles.teamHeadline}>{pulseHeadline}</Text>
                <View style={styles.teamInsightGrid}>
                  <MiniInsight label="Taste MVP" value={teamAnalytics?.taste_mvp?.display_name ?? "Still shaking out"} />
                  <MiniInsight label="Most loved" value={teamAnalytics?.most_loved_title?.title_name ?? "Still shaking out"} />
                  <MiniInsight label="Most divisive" value={teamAnalytics?.most_divisive_title?.title_name ?? "Still shaking out"} />
                  <MiniInsight label="Biggest vibe" value={teamAnalytics?.genre_breakdown?.[0]?.genre ?? "Still shaking out"} />
                </View>
              </View>
            </Section>
          </Animated.View>
        ) : null}
      </ScrollView>

      <UniversalTitleModal
        visible={showDetails}
        loading={detailLoading}
        title={detailTitle}
        onClose={() => setShowDetails(false)}
        onSaveTitle={(detail) => {
          setSaveTitleId(detail.id);
          setShowSaveSheet(true);
        }}
        onPost={() => {}}
      />
      <SaveToListSheet
        visible={showSaveSheet}
        token={sessionToken}
        titleId={saveTitleId}
        source="for_you"
        onClose={() => {
          setShowSaveSheet(false);
          setSaveTitleId(null);
        }}
        onError={(message) => setError(message)}
      />
    </SafeAreaView>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      {children}
    </View>
  );
}

function HeroChip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.heroChip}>
      <Ionicons name={icon} size={14} color={colors.accent} />
      <Text style={styles.heroChipText}>{label}</Text>
    </View>
  );
}

function MiniInsight({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniInsight}>
      <Text style={styles.miniInsightLabel}>{label}</Text>
      <Text style={styles.miniInsightValue}>{value}</Text>
    </View>
  );
}

function Poster({
  uri,
  style,
  iconSize,
}: {
  uri?: string | null;
  style: any;
  iconSize: number;
}) {
  const resolved = resolveMediaUrl(uri);
  if (resolved) {
    return <Image source={{ uri: resolved }} style={style} resizeMode="cover" />;
  }
  return (
    <View style={[style, styles.posterFallback]}>
      <Ionicons name="film-outline" size={iconSize} color={colors.muted} />
    </View>
  );
}

function buildHeroIntro(name?: string | null, taste?: TasteProfile | null) {
  if (taste?.taste_labels?.length) {
    const top = taste.taste_labels.slice(0, 2).map((item) => item.label.toLowerCase());
    if (name) {
      return `${name}, this is your lane.`;
    }
    return `This is your ${top.join(" and ")} era.`;
  }
  return name ? `${name}, this is your lane.` : HERO_FALLBACK[0];
}

function buildHeroSummary(taste?: TasteProfile | null) {
  if (taste?.profile_summary) {
    const platform = taste.top_platforms[0];
    if (platform) {
      return `${taste.profile_summary} Lately, ${platform} has clearly been part of the plan.`;
    }
    return taste.profile_summary;
  }

  const genres = taste?.top_genres.slice(0, 3).map((item) => item.genre) ?? [];
  if (genres.length > 0) {
    return `Your feed is leaning into ${joinHumanList(genres.map((item) => item.toLowerCase()))}, with a soft spot for stories that know how to leave a mark.`;
  }

  return HERO_FALLBACK[1];
}

function buildEraCopy(taste?: TasteProfile | null) {
  const leadLabel = taste?.taste_labels[0]?.label;
  const leadGenre = taste?.top_genres[0]?.genre;
  const leadPlatform = taste?.top_platforms[0];
  const theme = taste?.top_themes[0];

  if (leadLabel && leadPlatform) {
    return {
      title: `${leadLabel} with a ${leadPlatform} habit`,
      body: `Right now you are leaning into ${leadLabel.toLowerCase()} picks, especially the kind with ${theme?.toLowerCase() ?? "real emotional tension"}.`,
    };
  }

  if (leadGenre) {
    return {
      title: `Deep in your ${leadGenre.toLowerCase()} phase`,
      body: `The titles you save and revisit keep circling back to ${leadGenre.toLowerCase()} stories that feel a little richer, darker, or more obsessive than average.`,
    };
  }

  return {
    title: "Your taste is still taking shape",
    body: "A few more saves, rankings, and reactions will make this page feel even more personal.",
  };
}

function buildPatternCards(taste?: TasteProfile | null) {
  const topGenre = taste?.top_genres[0]?.genre ?? "prestige drama";
  const nextGenre = taste?.top_genres[1]?.genre ?? taste?.most_saved_genre ?? "psychological thriller";
  const platform = taste?.top_platforms[0] ?? "your queue";
  const theme = taste?.top_themes[0] ?? "character-driven storytelling";
  const era = taste?.favorite_eras[0] ?? "modern prestige TV";

  return [
    {
      title: "You rate with your feelings",
      value: topGenre,
      body: `Your highest marks keep clustering around ${topGenre.toLowerCase()} stories with real emotional weight.`,
    },
    {
      title: "Your comfort zone is not calm",
      value: nextGenre,
      body: `You save more ${nextGenre.toLowerCase()} picks than almost anything else when you want something immediate.`,
    },
    {
      title: "Your home platform",
      value: platform,
      body: `${platform} is where your current taste profile is hitting hardest.`,
    },
    {
      title: "The vibe you chase",
      value: theme,
      body: `You keep coming back to titles that feel ${theme.toLowerCase()} and hard to shake.`,
    },
    {
      title: "Your strongest era",
      value: era,
      body: `A lot of your recent saves point back to ${era.toLowerCase()} energy.`,
    },
  ];
}

function buildLabelCaption(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes("drama")) {
    return "You like your stories emotionally loaded and impossible to casually watch.";
  }
  if (lower.includes("crime") || lower.includes("thriller")) {
    return "You reliably fall for tension, danger, and deeply questionable decisions.";
  }
  if (lower.includes("comedy")) {
    return "You go back to sharp writing, comfort rewatches, and chaotic charm.";
  }
  if (lower.includes("sci")) {
    return "You like big ideas, eerie worlds, and stories that bend reality a little.";
  }
  if (lower.includes("horror")) {
    return "You are clearly not here for calm, emotionally regulated entertainment.";
  }
  return "One of the strongest patterns shaping your taste right now.";
}

function groupRecommendations(items: RecommendationItem[]) {
  const social: RecommendationItem[] = [];
  const vibe: RecommendationItem[] = [];
  const platform: RecommendationItem[] = [];

  for (const item of items) {
    const reason = item.reason.toLowerCase();
    if (reason.includes("team") || reason.includes("people") || reason.includes("users")) {
      social.push(item);
    } else if (reason.includes("max") || reason.includes("netflix") || reason.includes("platform") || reason.includes("stream")) {
      platform.push(item);
    } else {
      vibe.push(item);
    }
  }

  const groups = [
    {
      title: "People with taste like yours",
      subtitle: "What your taste neighbors are clearly into right now.",
      items: social.slice(0, 6),
    },
    {
      title: "Very on-brand for you",
      subtitle: "The kind of pick that fits your current mood a little too well.",
      items: vibe.slice(0, 6),
    },
    {
      title: "Worth opening your queue for",
      subtitle: "Streaming-ready picks that match the phase you are in.",
      items: platform.slice(0, 6),
    },
  ].filter((group) => group.items.length > 0);

  if (groups.length > 0) {
    return groups;
  }

  return [
    {
      title: "Picked for you",
      subtitle: "A sharper watchlist is forming here.",
      items: items.slice(0, 8),
    },
  ].filter((group) => group.items.length > 0);
}

function humanizeReason(reason: string) {
  const normalized = reason.replace(/^because\s+/i, "");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function buildRecommendationMeta(item: RecommendationItem) {
  const genres = item.title.genres?.slice(0, 2) ?? [];
  if (genres.length > 0) {
    return genres.join(" • ");
  }
  return item.title.content_type;
}

function buildPulseHeadline(team?: TeamSummary | null, analytics?: TeamAnalytics | null) {
  if (!team) {
    return "Your circle has not started making noise yet.";
  }

  const aligned = analytics?.most_aligned_members?.summary;
  if (aligned) {
    return aligned;
  }

  const loved = analytics?.most_loved_title?.title_name;
  const divisive = analytics?.most_divisive_title?.title_name;
  if (loved && divisive) {
    return `${team.name} is rallying around ${loved}, while ${divisive} is doing its best to start arguments.`;
  }

  return `${team.name} is still warming up, but the group taste is starting to come into focus.`;
}

function joinHumanList(items: string[]) {
  if (items.length === 0) {
    return "";
  }
  if (items.length === 1) {
    return items[0];
  }
  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  hero: {
    minHeight: 360,
    borderRadius: 34,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#121e31",
    shadowColor: colors.shadow,
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
  },
  heroBackdropWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  heroBackdropImage: {
    position: "absolute",
    borderRadius: 28,
    opacity: 0.28,
  },
  heroBackdropPrimary: {
    top: -10,
    right: -30,
    width: 240,
    height: 330,
    transform: [{ rotate: "7deg" }],
  },
  heroBackdropSecondary: {
    top: 70,
    left: -20,
    width: 170,
    height: 250,
    transform: [{ rotate: "-8deg" }],
  },
  heroBackdropTertiary: {
    bottom: -10,
    right: 90,
    width: 130,
    height: 190,
    transform: [{ rotate: "4deg" }],
  },
  heroBackdropFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#182945",
  },
  heroBackdropShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6, 11, 19, 0.68)",
  },
  heroGlowOne: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(244, 196, 48, 0.18)",
  },
  heroGlowTwo: {
    position: "absolute",
    bottom: -70,
    left: -30,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(46, 196, 182, 0.14)",
  },
  heroCopy: {
    padding: spacing.xl,
    gap: spacing.md,
    justifyContent: "flex-end",
    minHeight: 360,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroKicker: {
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: "800",
  },
  heroLivePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: "rgba(11, 20, 36, 0.54)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  heroLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  heroLiveText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    maxWidth: "86%",
  },
  heroBody: {
    color: "rgba(242,244,248,0.86)",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: "92%",
  },
  heroChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  heroActionRow: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: "rgba(10, 18, 33, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  heroChipText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  heroPrimaryAction: {
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  heroPrimaryActionText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: "900",
  },
  heroSecondaryAction: {
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  heroSecondaryActionText: {
    color: "rgba(242,244,248,0.72)",
    fontSize: 13,
    fontWeight: "700",
  },
  loading: {
    marginTop: spacing.sm,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    gap: 6,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
    maxWidth: "92%",
  },
  labelGrid: {
    gap: spacing.sm,
  },
  labelCard: {
    borderRadius: 24,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  labelCardFeatured: {
    backgroundColor: "#243456",
    borderColor: "rgba(244, 196, 48, 0.35)",
  },
  labelTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
  },
  labelCaption: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  labelConfidence: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "800",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  patternGrid: {
    gap: spacing.sm,
  },
  patternCard: {
    borderRadius: 24,
    padding: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  patternTitle: {
    color: "rgba(242,244,248,0.68)",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontWeight: "800",
  },
  patternValue: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
  },
  patternBody: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  eraCard: {
    borderRadius: 30,
    padding: spacing.xl,
    backgroundColor: "#221d35",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: spacing.sm,
  },
  eraEyebrow: {
    color: colors.accent,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontWeight: "800",
  },
  eraTitle: {
    color: colors.ink,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "900",
  },
  eraBody: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  horizontalRow: {
    gap: spacing.md,
    paddingRight: spacing.sm,
  },
  obsessionCard: {
    width: 148,
    borderRadius: 24,
    backgroundColor: colors.surface,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  obsessionCardFeatured: {
    width: 176,
  },
  obsessionPoster: {
    width: "100%",
    height: 220,
    backgroundColor: colors.surfaceSoft,
  },
  obsessionCopy: {
    padding: spacing.md,
    gap: 8,
  },
  obsessionTag: {
    color: colors.accent,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "800",
  },
  obsessionTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  recommendationSectionList: {
    gap: spacing.lg,
  },
  recommendationGroup: {
    gap: spacing.sm,
  },
  recommendationGroupHeader: {
    gap: 4,
  },
  recommendationGroupTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  recommendationGroupSubtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 19,
  },
  recommendationRow: {
    gap: spacing.md,
    paddingRight: spacing.sm,
  },
  recommendationCard: {
    width: 220,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recommendationPoster: {
    width: "100%",
    height: 290,
    backgroundColor: colors.surfaceSoft,
  },
  recommendationOverlay: {
    padding: spacing.md,
    gap: 6,
    minHeight: 132,
  },
  recommendationReason: {
    color: colors.accent,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
  },
  recommendationTitle: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
  },
  recommendationMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  saveButton: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    padding: 10,
    borderRadius: radii.pill,
    backgroundColor: "rgba(11, 20, 36, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  teamCard: {
    borderRadius: 30,
    padding: spacing.xl,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  teamTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  teamHeading: {
    flex: 1,
  },
  teamName: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
  },
  teamMeta: {
    color: colors.muted,
    marginTop: 4,
    fontSize: 14,
  },
  compatibilityBadge: {
    alignItems: "center",
    justifyContent: "center",
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compatibilityValue: {
    color: colors.accent,
    fontSize: 26,
    fontWeight: "900",
  },
  compatibilityLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  teamHeadline: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  teamInsightGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  miniInsight: {
    width: "48%",
    borderRadius: 20,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  miniInsightLabel: {
    color: colors.muted,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "800",
  },
  miniInsightValue: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  posterFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
});
