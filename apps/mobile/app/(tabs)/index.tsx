import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors, radii, spacing } from "@/constants/theme";
import { AddToTeamSheet } from "@/components/add-to-team-sheet";
import { SaveToListSheet } from "@/components/save-to-list-sheet";
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

type FeedEvent = {
  id: string;
  team_id?: string | null;
  created_at?: string;
  actor?: {
    user_id: string;
    display_name?: string | null;
    avatar_url?: string | null;
  };
  title?: Title | null;
  payload: Record<string, unknown>;
};

type RecommendationItem = {
  title: Title;
  reason: string;
  seed_title_id?: string | null;
};

type TrendingSeedItem = {
  id: string;
  title: string;
  type: "movie" | "show";
  tag: string;
  subtext: string;
  posterUrl?: string;
  backdropUrl?: string;
  genre: string;
  trendingScore: number;
};

type SmartRecommendationSeed = {
  id: string;
  title: string;
  mediaType: "movie" | "show";
  year: number;
  genre: string;
  description: string;
  reason: string;
};

type EditorialItem = {
  id: string;
  title: string;
  mediaType: "movie" | "show";
  year: number;
  genre: string;
  description: string;
};

type DoubleFeatureItem = {
  id: string;
  leftTitle: string;
  leftType: "movie" | "show";
  rightTitle: string;
  rightType: "movie" | "show";
  genre: string;
  description: string;
};

const TRENDING_SEED: TrendingSeedItem[] = [
  {
    id: "tr_succession",
    title: "Succession",
    type: "show",
    tag: "Trending",
    subtext: "Rated 9/10 by most users",
    posterUrl: "https://image.tmdb.org/t/p/w500/7HW47XbkNQ5fiwQFYGWdw9gs144.jpg",
    backdropUrl: "https://image.tmdb.org/t/p/w780/8u7W8H4Uk6n6Q0E8xY8Tz6kRXKu.jpg",
    genre: "Drama",
    trendingScore: 98,
  },
  {
    id: "tr_bear",
    title: "The Bear",
    type: "show",
    tag: "Buzzing Now",
    subtext: "Exploding with Scene Snap users this week",
    posterUrl: "https://image.tmdb.org/t/p/w500/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg",
    backdropUrl: "https://image.tmdb.org/t/p/w780/9s7f0M6D3k1vXfQ4f6x4k0R4YQJ.jpg",
    genre: "Drama",
    trendingScore: 96,
  },
  {
    id: "tr_saltburn",
    title: "Saltburn",
    type: "movie",
    tag: "Viral Pick",
    subtext: "One of the most saved films right now",
    posterUrl: "https://image.tmdb.org/t/p/w500/qjhahNLSZ705B5JP92YMEYPocPz.jpg",
    genre: "Thriller",
    trendingScore: 93,
  },
  {
    id: "tr_severance",
    title: "Severance",
    type: "show",
    tag: "Back in Rotation",
    subtext: "Added to watchlists all week",
    posterUrl: "https://image.tmdb.org/t/p/w500/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg",
    genre: "Sci-Fi",
    trendingScore: 92,
  },
  {
    id: "tr_past_lives",
    title: "Past Lives",
    type: "movie",
    tag: "Critic Favorite",
    subtext: "Quietly becoming a top-rated save",
    posterUrl: "https://image.tmdb.org/t/p/w500/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
    genre: "Romance",
    trendingScore: 90,
  },
  {
    id: "tr_girls",
    title: "Girls",
    type: "show",
    tag: "Rewatch Wave",
    subtext: "High engagement among recent users",
    posterUrl: "https://image.tmdb.org/t/p/w500/cTnQfNQ4qQ4u8YQ3Q9Bf4xQb3mI.jpg",
    genre: "Comedy",
    trendingScore: 89,
  },
];

const TV_SMART_PICKS: SmartRecommendationSeed[] = [
  {
    id: "tv_sharp_objects",
    title: "Sharp Objects",
    mediaType: "show",
    year: 2018,
    genre: "Psychological Mystery",
    description: "Psychological mystery anchored by grief, memory, and trauma.",
    reason: "Because you save dark character-driven dramas.",
  },
  {
    id: "tv_industry",
    title: "Industry",
    mediaType: "show",
    year: 2020,
    genre: "Drama",
    description: "Ambition and power collide inside elite finance culture.",
    reason: "Because you like Succession-style intensity.",
  },
  {
    id: "tv_normal_people",
    title: "Normal People",
    mediaType: "show",
    year: 2020,
    genre: "Romance",
    description: "Intimate, emotionally grounded story of love and timing.",
    reason: "Because you favor character-first storytelling.",
  },
  {
    id: "tv_mindhunter",
    title: "Mindhunter",
    mediaType: "show",
    year: 2017,
    genre: "Crime",
    description: "Meticulous psychological crime drama about criminal profiling.",
    reason: "Because you watch slow-burn prestige thrillers.",
  },
  {
    id: "tv_leftovers",
    title: "The Leftovers",
    mediaType: "show",
    year: 2014,
    genre: "Drama",
    description: "Existential drama exploring loss, belief, and meaning.",
    reason: "Because you save emotionally complex series.",
  },
  {
    id: "tv_fleabag",
    title: "Fleabag",
    mediaType: "show",
    year: 2016,
    genre: "Dark Comedy",
    description: "Sharp, dark comedy layered with emotional vulnerability.",
    reason: "Because you like smart, character-led writing.",
  },
  {
    id: "tv_severance",
    title: "Severance",
    mediaType: "show",
    year: 2022,
    genre: "Sci-Fi",
    description: "Surreal corporate thriller where identity is fractured.",
    reason: "Because you enjoy cerebral mystery.",
  },
  {
    id: "tv_night_of",
    title: "The Night Of",
    mediaType: "show",
    year: 2016,
    genre: "Legal Drama",
    description: "Tense legal drama exploring justice and moral ambiguity.",
    reason: "Because you watch procedural prestige dramas.",
  },
  {
    id: "tv_atlanta",
    title: "Atlanta",
    mediaType: "show",
    year: 2016,
    genre: "Comedy-Drama",
    description: "Surreal, stylish storytelling blending comedy and commentary.",
    reason: "Because you enjoy genre-bending series.",
  },
  {
    id: "tv_big_little_lies",
    title: "Big Little Lies",
    mediaType: "show",
    year: 2017,
    genre: "Prestige Drama",
    description: "Prestige ensemble drama built on secrets and performance.",
    reason: "Because you follow award-winning series.",
  },
];

const MOVIE_SMART_PICKS: SmartRecommendationSeed[] = [
  {
    id: "mv_aftersun",
    title: "Aftersun",
    mediaType: "movie",
    year: 2022,
    genre: "Drama",
    description: "Memory-driven emotional drama about love and distance.",
    reason: "Because you save reflective indie films.",
  },
  {
    id: "mv_past_lives",
    title: "Past Lives",
    mediaType: "movie",
    year: 2023,
    genre: "Romance",
    description: "Tender meditation on timing, connection, and fate.",
    reason: "Because you value quiet emotional storytelling.",
  },
  {
    id: "mv_prisoners",
    title: "Prisoners",
    mediaType: "movie",
    year: 2013,
    genre: "Thriller",
    description: "Dark investigative thriller driven by moral tension.",
    reason: "Because you watch intense character thrillers.",
  },
  {
    id: "mv_nightcrawler",
    title: "Nightcrawler",
    mediaType: "movie",
    year: 2014,
    genre: "Psychological Thriller",
    description: "Psychological descent into ambition and media ethics.",
    reason: "Because you like unsettling character studies.",
  },
  {
    id: "mv_portrait_lady_on_fire",
    title: "Portrait of a Lady on Fire",
    mediaType: "movie",
    year: 2019,
    genre: "Art-House Romance",
    description: "Romantic slow-burn built on visual storytelling and silence.",
    reason: "Because you save art-house romance.",
  },
  {
    id: "mv_zodiac",
    title: "Zodiac",
    mediaType: "movie",
    year: 2007,
    genre: "Crime",
    description: "Meticulous crime thriller about obsession and uncertainty.",
    reason: "Because you enjoy procedural tension.",
  },
  {
    id: "mv_call_me_by_your_name",
    title: "Call Me by Your Name",
    mediaType: "movie",
    year: 2017,
    genre: "Romance",
    description: "Sun-soaked coming-of-age romance full of longing.",
    reason: "Because you like intimate character stories.",
  },
  {
    id: "mv_whiplash",
    title: "Whiplash",
    mediaType: "movie",
    year: 2014,
    genre: "Drama",
    description: "High-intensity character drama about obsession and performance.",
    reason: "Because you watch driven psychological stories.",
  },
  {
    id: "mv_moonlight",
    title: "Moonlight",
    mediaType: "movie",
    year: 2016,
    genre: "Drama",
    description: "Visually poetic coming-of-age story told in quiet emotional beats.",
    reason: "Because you save intimate prestige films.",
  },
  {
    id: "mv_her",
    title: "Her",
    mediaType: "movie",
    year: 2013,
    genre: "Sci-Fi Romance",
    description: "Soft sci-fi romance exploring loneliness and connection.",
    reason: "Because you enjoy emotional speculative stories.",
  },
];

const AWARDS_SEASON_ITEMS: EditorialItem[] = [
  { id: "aw_oppenheimer", title: "Oppenheimer", mediaType: "movie", year: 2023, genre: "Drama", description: "Awards frontrunner for direction, performance, and technical scale." },
  { id: "aw_poor_things", title: "Poor Things", mediaType: "movie", year: 2023, genre: "Surreal Prestige", description: "Surreal prestige cinema driven by bold performances and design." },
  { id: "aw_anatomy_of_a_fall", title: "Anatomy of a Fall", mediaType: "movie", year: 2023, genre: "Courtroom Drama", description: "Courtroom drama with critical acclaim and standout acting." },
  { id: "aw_holdovers", title: "The Holdovers", mediaType: "movie", year: 2023, genre: "Period Drama", description: "Character-driven period drama fueled by performance and writing." },
  { id: "aw_past_lives", title: "Past Lives", mediaType: "movie", year: 2023, genre: "Drama", description: "Emotional indie drama anchored by subtle, powerful performances." },
  { id: "aw_killers", title: "Killers of the Flower Moon", mediaType: "movie", year: 2023, genre: "Historical Crime", description: "Epic historical crime drama with heavyweight performances." },
  { id: "aw_maestro", title: "Maestro", mediaType: "movie", year: 2023, genre: "Biographical Drama", description: "Intimate biographical drama focused on artistic legacy." },
  { id: "aw_barbie", title: "Barbie", mediaType: "movie", year: 2023, genre: "Satire", description: "Blockbuster satire recognized for cultural impact and design." },
  { id: "aw_zone_of_interest", title: "The Zone of Interest", mediaType: "movie", year: 2023, genre: "Historical Drama", description: "Experimental historical drama praised for formal innovation." },
  { id: "aw_american_fiction", title: "American Fiction", mediaType: "movie", year: 2023, genre: "Satire", description: "Sharp social satire driven by performance and commentary." },
];

const DOUBLE_FEATURE_ITEMS: DoubleFeatureItem[] = [
  { id: "df_black_swan", leftTitle: "Black Swan", leftType: "movie", rightTitle: "Perfect Blue", rightType: "movie", genre: "Psychological", description: "Psychological identity spirals through performance and pressure." },
  { id: "df_past_lives", leftTitle: "Past Lives", leftType: "movie", rightTitle: "Before Sunrise", rightType: "movie", genre: "Romance", description: "Intimate romantic conversations shaped by timing and place." },
  { id: "df_succession_industry", leftTitle: "Succession", leftType: "show", rightTitle: "Industry", rightType: "show", genre: "Prestige Drama", description: "Power, ambition, and moral compromise inside elite systems." },
  { id: "df_social_network", leftTitle: "The Social Network", leftType: "movie", rightTitle: "Steve Jobs", rightType: "movie", genre: "Biographical", description: "Fast-talking portraits of visionary ambition and ego." },
  { id: "df_hereditary_witch", leftTitle: "Hereditary", leftType: "movie", rightTitle: "The Witch", rightType: "movie", genre: "Horror", description: "Atmospheric horror driven by dread, isolation, and slow tension." },
  { id: "df_ladybird_frances", leftTitle: "Lady Bird", leftType: "movie", rightTitle: "Frances Ha", rightType: "movie", genre: "Coming of Age", description: "Restless coming-of-age stories about identity and direction." },
  { id: "df_dune_blade_runner", leftTitle: "Dune", leftType: "movie", rightTitle: "Blade Runner 2049", rightType: "movie", genre: "Sci-Fi", description: "Epic sci-fi worlds defined by scale, design, and philosophy." },
  { id: "df_moonlight_call_me", leftTitle: "Moonlight", leftType: "movie", rightTitle: "Call Me by Your Name", rightType: "movie", genre: "Drama", description: "Tender, visually rich stories of identity and longing." },
  { id: "df_zodiac_mindhunter", leftTitle: "Zodiac", leftType: "movie", rightTitle: "Mindhunter", rightType: "show", genre: "Crime", description: "Obsessive procedural investigations into criminal psychology." },
  { id: "df_lost_in_translation", leftTitle: "Lost in Translation", leftType: "movie", rightTitle: "In the Mood for Love", rightType: "movie", genre: "Romance", description: "Quiet longing expressed through atmosphere and restraint." },
];

export default function HomeScreen() {
  const { sessionToken, user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Title[]>([]);
  const [recommendedItems, setRecommendedItems] = useState<RecommendationItem[]>([]);
  const [recommendedVisibleCount, setRecommendedVisibleCount] = useState(10);
  const [genres, setGenres] = useState<string[]>([
    "Drama",
    "Comedy",
    "Thriller",
    "Horror",
    "Romance",
    "Documentary",
    "Sci-Fi",
    "Fantasy",
    "Action",
    "Mystery",
    "Animation",
    "Crime",
  ]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [genreMediaType, setGenreMediaType] = useState<"all" | "movie" | "show">("all");
  const [genreResults, setGenreResults] = useState<Title[]>([]);
  const [genreLoading, setGenreLoading] = useState(false);
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
  const [composerViewportHeight, setComposerViewportHeight] = useState<number | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [quickPickType, setQuickPickType] = useState<"movie" | "show" | null>(null);
  const [quickPickLoading, setQuickPickLoading] = useState(false);
  const [quickPick, setQuickPick] = useState<RecommendationItem | null>(null);
  const [resolvedTitleMap, setResolvedTitleMap] = useState<Record<string, Title>>({});
  const [tvQueue, setTvQueue] = useState<number[]>([]);
  const [movieQueue, setMovieQueue] = useState<number[]>([]);

  const rootScrollRef = useRef<ScrollView>(null);
  const composerScrollRef = useRef<ScrollView>(null);
  const searchPulse = useRef(new Animated.Value(1)).current;
  const heroDrift = useRef(new Animated.Value(0)).current;

  async function refreshRecommendations() {
    if (!sessionToken) {
      return;
    }
    try {
      const recommendations = await apiRequest<RecommendationItem[]>("/titles/recommendations/for-me?limit=36", {
        token: sessionToken,
      });
      setRecommendedItems(recommendations);
    } catch {
      // Keep existing recommendations when refresh fails.
    }
  }

  function shuffleIndices(length: number) {
    const values = Array.from({ length }, (_, idx) => idx);
    for (let i = values.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  }

  function titleKey(name: string, type: "movie" | "show") {
    return `${name.toLowerCase()}::${type}`;
  }

  async function resolveTitleByName(name: string, preferredType: "movie" | "show") {
    const key = titleKey(name, preferredType);
    const cached = resolvedTitleMap[key];
    if (cached) {
      return cached;
    }
    if (!sessionToken) {
      return null;
    }
    try {
      const found = await apiRequest<Title[]>(`/titles/search?q=${encodeURIComponent(name)}`, { token: sessionToken });
      const picked =
        found.find((item) => {
          const normalizedType = item.content_type === "tv" ? "show" : item.content_type;
          return normalizedType === preferredType && item.title.toLowerCase() === name.toLowerCase();
        }) ??
        found.find((item) => {
          const normalizedType = item.content_type === "tv" ? "show" : item.content_type;
          return normalizedType === preferredType;
        }) ??
        found[0];
      if (!picked) {
        return null;
      }
      setResolvedTitleMap((current) => ({ ...current, [key]: picked }));
      return picked;
    } catch {
      return null;
    }
  }

  async function openDetailsByName(name: string, preferredType: "movie" | "show") {
    const resolved = await resolveTitleByName(name, preferredType);
    if (!resolved) {
      setToast("Title details unavailable right now");
      return;
    }
    void openDetails(resolved);
  }

  async function addToListByName(name: string, preferredType: "movie" | "show") {
    const resolved = await resolveTitleByName(name, preferredType);
    if (!resolved) {
      setToast("Unable to save this title right now");
      return;
    }
    openSaveSheet(resolved);
  }

  async function loadGenreResults(nextGenre: string, nextMediaType: "all" | "movie" | "show") {
    if (!sessionToken) {
      return;
    }
    setGenreLoading(true);
    setError(null);
    try {
      const discovered = await apiRequest<Title[]>(
        `/titles/discover?genre=${encodeURIComponent(nextGenre)}&media_type=${nextMediaType}&limit=30`,
        { token: sessionToken }
      );
      setGenreResults(discovered);
    } catch (discoverError) {
      setError(discoverError instanceof Error ? discoverError.message : "Failed to load genre results");
      setGenreResults([]);
    } finally {
      setGenreLoading(false);
    }
  }

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(searchPulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(searchPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [searchPulse]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(heroDrift, { toValue: 1, duration: 12000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(heroDrift, { toValue: 0, duration: 12000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, [heroDrift]);

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
    setTvQueue(shuffleIndices(TV_SMART_PICKS.length));
    setMovieQueue(shuffleIndices(MOVIE_SMART_PICKS.length));
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
        const [savedTitleIds, recommendations] = await Promise.all([
          apiRequest<string[]>("/me/watchlist/title-ids", { token: sessionToken }),
          apiRequest<RecommendationItem[]>("/titles/recommendations/for-me?limit=36", { token: sessionToken }),
        ]);
        setSavedIds(new Set(savedTitleIds));
        setRecommendedItems(recommendations);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load home");
      }
    }
    void loadHome();
  }, [sessionToken]);

  useEffect(() => {
    async function loadGenres() {
      if (!sessionToken) {
        return;
      }
      try {
        const values = await apiRequest<string[]>("/titles/genres", { token: sessionToken });
        if (values.length) {
          setGenres(values);
        }
      } catch {
        // Keep seeded fallback list.
      }
    }
    void loadGenres();
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

  function openSaveSheet(title: Title) {
    setSelectedTitle(title);
    setShowSaveSheet(true);
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
      void event;
      setShowPostComposer(false);
      setToast("Posted to your Social Wall");
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : "Post failed");
    } finally {
      setIsPosting(false);
    }
  }

  async function requestSmartRecommendation(type: "movie" | "show") {
    if (quickPickLoading) {
      return;
    }
    setQuickPickType(type);
    setQuickPickLoading(true);
    setQuickPick(null);
    try {
      const source = type === "movie" ? MOVIE_SMART_PICKS : TV_SMART_PICKS;
      const queue = type === "movie" ? movieQueue : tvQueue;
      const nextQueue = queue.length ? queue : shuffleIndices(source.length);
      const nextIndex = nextQueue[0];
      const seed = source[nextIndex];
      const remaining = nextQueue.slice(1);
      if (type === "movie") {
        setMovieQueue(remaining.length ? remaining : shuffleIndices(source.length));
      } else {
        setTvQueue(remaining.length ? remaining : shuffleIndices(source.length));
      }
      const resolved = await resolveTitleByName(seed.title, seed.mediaType);
      if (!resolved) {
        setToast("No recommendation available yet");
        return;
      }
      setQuickPick({
        title: {
          ...resolved,
          overview: seed.description || resolved.overview,
          release_date: resolved.release_date ?? `${seed.year}-01-01`,
          genres: resolved.genres.length ? resolved.genres : [seed.genre],
        },
        reason: seed.reason,
      });
    } finally {
      setQuickPickLoading(false);
    }
  }

  const recommendedTitles = useMemo(
    () => recommendedItems.slice(0, recommendedVisibleCount),
    [recommendedItems, recommendedVisibleCount]
  );

  const becauseYouSaved = useMemo(() => {
    const grouped = new Map<string, RecommendationItem[]>();
    for (const item of recommendedItems) {
      const key = item.reason || "Inspired by your picks";
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    }
    return Array.from(grouped.entries()).slice(0, 3);
  }, [recommendedItems]);

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
          <Animated.View
            style={[
              styles.heroNoise,
              {
                transform: [
                  {
                    translateX: heroDrift.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-14, 14],
                    }),
                  },
                ],
              },
            ]}
          />
          <Image source={require("../../assets/branding/seensnap-logo.png")} style={styles.logo} resizeMode="contain" />
          <Pressable style={styles.bellButton}>
            <Ionicons name="notifications-outline" size={19} color={colors.ink} />
          </Pressable>
          <Text style={styles.heroTitle}>{`Welcome back, ${user?.display_name?.split(" ")[0] ?? "Elizabeth"}.`}</Text>
          <Text style={styles.heroSubtitle}>Find the scene. Save the feeling.</Text>
          <Text style={styles.heroMicro}>Track what you love. Discover what's next.</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trending</Text>
          <Text style={styles.sectionSub}>What Scene Snap users are buzzing about right now.</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingRow}>
          {TRENDING_SEED.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [styles.trendingCard, pressed && styles.pressed]}
              onPress={() => void openDetailsByName(item.title, item.type)}
            >
              {item.posterUrl ? (
                <Image source={{ uri: item.posterUrl }} style={styles.trendingPoster} />
              ) : (
                <View style={styles.trendingPosterFallback} />
              )}
              <View style={styles.trendingBody}>
                <Text style={styles.trendingTag}>{item.tag}</Text>
                <Text style={styles.trendingTitle}>{item.title}</Text>
                <Text numberOfLines={2} style={styles.trendingSubtext}>{item.subtext}</Text>
                <Text style={styles.trendingMeta}>
                  {item.type === "movie" ? "Movie" : "Show"} · {item.genre}
                </Text>
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => void addToListByName(item.title, item.type)}
                    style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]}
                  >
                    <Ionicons name="bookmark-outline" size={14} color={colors.ink} />
                    <Text style={styles.actionLabel}>Add to List</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void openDetailsByName(item.title, item.type)}
                    style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]}
                  >
                    <Ionicons name="information-circle-outline" size={14} color={colors.ink} />
                    <Text style={styles.actionLabel}>Details</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.searchModule}>
          <Text style={styles.searchPrompt}>Start by searching for a title you love, or browse by genre.</Text>
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
          <View style={styles.genreHeaderRow}>
            <Text style={styles.genreLabel}>Browse by Genre</Text>
            {selectedGenre ? (
              <Pressable
                onPress={() => {
                  setSelectedGenre(null);
                  setGenreResults([]);
                  setGenreMediaType("all");
                }}
              >
                <Text style={styles.genreClear}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genreRow}>
            {genres.map((genre) => (
              <Pressable
                key={genre}
                style={[styles.genreChip, selectedGenre === genre && styles.genreChipActive]}
                onPress={() => {
                  setSelectedGenre(genre);
                  void loadGenreResults(genre, genreMediaType);
                }}
              >
                <Text style={[styles.genreChipText, selectedGenre === genre && styles.genreChipTextActive]}>{genre}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {selectedGenre ? (
          <View style={styles.genreResultsModule}>
            <View style={styles.genreResultsHeader}>
              <Text style={styles.genreResultsTitle}>{selectedGenre}</Text>
              <View style={styles.mediaSegmentRow}>
                {(["all", "movie", "show"] as const).map((segment) => (
                  <Pressable
                    key={segment}
                    style={[styles.mediaSegment, genreMediaType === segment && styles.mediaSegmentActive]}
                    onPress={() => {
                      setGenreMediaType(segment);
                      void loadGenreResults(selectedGenre, segment);
                    }}
                  >
                    <Text style={[styles.mediaSegmentText, genreMediaType === segment && styles.mediaSegmentTextActive]}>
                      {segment === "all" ? "All" : segment === "movie" ? "Movies" : "Shows"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {genreLoading ? <Text style={styles.infoText}>Loading {selectedGenre}...</Text> : null}
            {!genreLoading && genreResults.length === 0 ? (
              <Text style={styles.infoText}>No titles found for this genre yet.</Text>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.posterStrip}>
              {genreResults.slice(0, 14).map((title) => (
                <Pressable key={`genre-${title.id}`} onPress={() => void openDetails(title)}>
                  {title.poster_url ? (
                    <Image source={{ uri: title.poster_url }} style={styles.stripPoster} />
                  ) : (
                    <View style={styles.stripPosterFallback} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.smartActions}>
          <Pressable
            style={[styles.smartButton, quickPickType === "show" && styles.smartButtonActive]}
            onPress={() => void requestSmartRecommendation("show")}
          >
            <Ionicons name="tv-outline" size={16} color={colors.ink} />
            <Text style={styles.smartButtonText}>Recommend me a TV show</Text>
          </Pressable>
          <Pressable
            style={[styles.smartButton, quickPickType === "movie" && styles.smartButtonActive]}
            onPress={() => void requestSmartRecommendation("movie")}
          >
            <Ionicons name="videocam-outline" size={16} color={colors.ink} />
            <Text style={styles.smartButtonText}>Recommend me a movie</Text>
          </Pressable>
        </View>

        {quickPickLoading ? (
          <View style={styles.quickPickLoading}>
            <Text style={styles.sectionSub}>Finding something great for you...</Text>
          </View>
        ) : null}
        {quickPick ? (
          <View style={styles.quickPickCard}>
            {quickPick.title.poster_url ? (
              <Image source={{ uri: quickPick.title.poster_url }} style={styles.quickPickPoster} />
            ) : (
              <View style={styles.quickPickPosterFallback} />
            )}
            <View style={styles.quickPickCopy}>
              <Text style={styles.quickPickTitle}>{quickPick.title.title}</Text>
              <Text style={styles.quickPickMeta}>
                {(quickPick.title.release_date ? `${new Date(quickPick.title.release_date).getFullYear()} · ` : "") +
                  `${quickPick.title.content_type === "movie" ? "Movie" : "Show"} · ` +
                  `${quickPick.title.genres[0] ?? "Featured"}`}
              </Text>
              <Text style={styles.quickPickDescription} numberOfLines={3}>
                {quickPick.title.overview ?? "A strong match based on your recent activity."}
              </Text>
              <Text style={styles.quickPickReason}>{quickPick.reason}</Text>
              <View style={styles.actionRow}>
                <Pressable onPress={() => openSaveSheet(quickPick.title)} style={styles.actionPill}>
                  <Ionicons name="bookmark-outline" size={14} color={colors.ink} />
                  <Text style={styles.actionLabel}>Add to List</Text>
                </Pressable>
                <Pressable onPress={() => void openDetails(quickPick.title)} style={styles.actionPill}>
                  <Ionicons name="information-circle-outline" size={14} color={colors.ink} />
                  <Text style={styles.actionLabel}>Details</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

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
                  onPress={() => openSaveSheet(title)}
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
          <Text style={styles.sectionSub}>Based on what you already saved.</Text>
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
          {recommendedTitles.map((item) => (
            <View key={item.title.id} style={styles.recommendationCard}>
              {item.title.poster_url ? (
                <Image source={{ uri: item.title.poster_url }} style={styles.recommendationPoster} />
              ) : (
                <View style={styles.recommendationPosterFallback} />
              )}
              <Text numberOfLines={1} style={styles.recommendationTitle}>{item.title.title}</Text>
              <Text numberOfLines={1} style={styles.recommendationMeta}>
                {(item.title.release_date ? `${new Date(item.title.release_date).getFullYear()} · ` : "") +
                  `${item.title.content_type === "movie" ? "Movie" : "Show"} · ` +
                  (item.title.genres[0] ? `${item.title.genres[0]} · ` : "") +
                  (item.title.content_type === "movie"
                    ? `${item.title.runtime_minutes ?? "—"} min`
                    : `${item.title.season_count ?? "—"} seasons`)}
              </Text>
              <Text numberOfLines={2} style={styles.recommendationDescription}>
                {item.title.overview ?? "A tailored pick based on your recent saves and activity."}
              </Text>
              <Text numberOfLines={2} style={styles.reasonLine}>{item.reason}</Text>
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => openSaveSheet(item.title)}
                  style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]}
                >
                  <Ionicons name="bookmark-outline" size={14} color={colors.ink} />
                  <Text style={styles.actionLabel}>Add to List</Text>
                </Pressable>
                <Pressable onPress={() => void openDetails(item.title)} style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]}>
                  <Ionicons name="information-circle-outline" size={14} color={colors.ink} />
                  <Text style={styles.actionLabel}>Details</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>

        {becauseYouSaved.map(([reason, items]) => (
          <View key={reason} style={styles.subsection}>
            <Text style={styles.subsectionTitle}>{reason}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendationRow}>
              {items.slice(0, 8).map((item) => (
                <View key={`${reason}-${item.title.id}`} style={styles.miniEditorialCard}>
                  <Pressable onPress={() => void openDetails(item.title)}>
                    {item.title.poster_url ? (
                      <Image source={{ uri: item.title.poster_url }} style={styles.stripPoster} />
                    ) : (
                      <View style={styles.stripPosterFallback} />
                    )}
                  </Pressable>
                  <Text numberOfLines={1} style={styles.miniEditorialTitle}>{item.title.title}</Text>
                  <Pressable
                    onPress={() => openSaveSheet(item.title)}
                    style={({ pressed }) => [styles.actionPillCompact, pressed && styles.pressed]}
                  >
                    <Ionicons name="bookmark-outline" size={12} color={colors.ink} />
                    <Text style={styles.actionLabelCompact}>Add to List</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        ))}

        <View style={styles.subsection}>
          <Text style={styles.sectionTitle}>Awards Season</Text>
          <Text style={styles.sectionSub}>
            The year's most talked-about films and performances dominating awards conversation.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendationRow}>
            {AWARDS_SEASON_ITEMS.map((item) => (
              <View key={item.id} style={styles.editorialCard}>
                <Pressable onPress={() => void openDetailsByName(item.title, item.mediaType)}>
                  {resolvedTitleMap[titleKey(item.title, item.mediaType)]?.poster_url ? (
                    <Image
                      source={{ uri: resolvedTitleMap[titleKey(item.title, item.mediaType)]?.poster_url ?? "" }}
                      style={styles.editorialPoster}
                    />
                  ) : (
                    <View style={styles.editorialPosterFallback} />
                  )}
                </Pressable>
                <Text style={styles.editorialTitle}>{item.title}</Text>
                <Text style={styles.editorialMeta}>
                  {item.year} · {item.mediaType === "movie" ? "Movie" : "Show"} · {item.genre}
                </Text>
                <Text numberOfLines={3} style={styles.editorialDescription}>{item.description}</Text>
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => void addToListByName(item.title, item.mediaType)}
                    style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]}
                  >
                    <Ionicons name="bookmark-outline" size={14} color={colors.ink} />
                    <Text style={styles.actionLabel}>Add to List</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void openDetailsByName(item.title, item.mediaType)}
                    style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]}
                  >
                    <Ionicons name="information-circle-outline" size={14} color={colors.ink} />
                    <Text style={styles.actionLabel}>Details</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.subsection}>
          <Text style={styles.sectionTitle}>Double Feature</Text>
          <Text style={styles.sectionSub}>
            Curated title pairings that complement each other in tone, theme, or style.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendationRow}>
            {DOUBLE_FEATURE_ITEMS.map((item) => (
              <View key={item.id} style={styles.editorialCardWide}>
                <Text style={styles.doubleFeatureTitle}>{item.leftTitle} + {item.rightTitle}</Text>
                <Text style={styles.editorialMeta}>{item.genre}</Text>
                <Text numberOfLines={3} style={styles.editorialDescription}>{item.description}</Text>
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => void addToListByName(item.leftTitle, item.leftType)}
                    style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]}
                  >
                    <Ionicons name="bookmark-outline" size={14} color={colors.ink} />
                    <Text style={styles.actionLabel}>Add {item.leftTitle}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void addToListByName(item.rightTitle, item.rightType)}
                    style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]}
                  >
                    <Ionicons name="bookmark-outline" size={14} color={colors.ink} />
                    <Text style={styles.actionLabel}>Add {item.rightTitle}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void openDetailsByName(item.leftTitle, item.leftType)}
                    style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]}
                  >
                    <Ionicons name="information-circle-outline" size={14} color={colors.ink} />
                    <Text style={styles.actionLabel}>Open</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      <SaveToListSheet
        visible={showSaveSheet}
        token={sessionToken}
        titleId={selectedTitle?.id ?? null}
        source="home"
        onClose={() => setShowSaveSheet(false)}
        onSaved={(listName, alreadySaved) => {
          if (selectedTitle) {
            setSavedIds((current) => new Set(current).add(selectedTitle.id));
          }
          void refreshRecommendations();
          setToast(alreadySaved ? `Already in ${listName}` : `Saved to ${listName}`);
        }}
        onError={(message) => setError(message)}
      />

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
            openSaveSheet(selectedTitle);
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: "center",
    backgroundColor: "rgba(11, 20, 36, 0.58)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoGlow: {
    position: "absolute",
    top: 24,
    width: 320,
    height: 120,
    borderRadius: 120,
    backgroundColor: "rgba(244, 196, 48, 0.14)",
  },
  heroNoise: {
    position: "absolute",
    bottom: -40,
    left: -20,
    right: -20,
    height: 110,
    borderRadius: 100,
    backgroundColor: "rgba(32, 53, 82, 0.45)",
  },
  logo: { width: 272, height: 92 },
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
  heroTitle: { marginTop: 16, color: colors.ink, fontSize: 30, fontWeight: "900", textAlign: "center" },
  heroSubtitle: { marginTop: 6, color: colors.muted, lineHeight: 21, textAlign: "center" },
  heroMicro: { marginTop: 4, color: colors.ink, opacity: 0.72, textAlign: "center", fontSize: 13 },
  trendingRow: { gap: 12, paddingBottom: 4 },
  trendingCard: {
    width: 248,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  trendingPoster: {
    width: "100%",
    height: 142,
    backgroundColor: colors.backgroundElevated,
  },
  trendingPosterFallback: {
    width: "100%",
    height: 142,
    backgroundColor: colors.backgroundElevated,
  },
  trendingBody: {
    padding: spacing.sm,
    gap: 4,
  },
  trendingTag: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  trendingTitle: {
    color: colors.ink,
    fontWeight: "900",
    fontSize: 17,
  },
  trendingSubtext: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  trendingMeta: {
    color: colors.ink,
    opacity: 0.82,
    fontSize: 11,
    fontWeight: "700",
  },
  searchModule: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: 8,
  },
  searchPrompt: {
    color: colors.ink,
    opacity: 0.86,
    fontSize: 13,
    lineHeight: 18,
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
  genreHeaderRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  genreLabel: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 13,
  },
  genreClear: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: 12,
  },
  genreRow: { gap: 8, paddingTop: 6, paddingBottom: 2 },
  genreChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  genreChipActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(244, 196, 48, 0.14)",
  },
  genreChipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  genreChipTextActive: {
    color: colors.accent,
  },
  genreResultsModule: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: 8,
  },
  genreResultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  genreResultsTitle: {
    color: colors.ink,
    fontWeight: "900",
    fontSize: 16,
  },
  mediaSegmentRow: {
    flexDirection: "row",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    padding: 2,
    gap: 2,
  },
  mediaSegment: {
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  mediaSegmentActive: {
    backgroundColor: colors.accent,
  },
  mediaSegmentText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  mediaSegmentTextActive: {
    color: colors.background,
  },
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
  smartActions: {
    flexDirection: "row",
    gap: 8,
  },
  smartButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  smartButtonActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(244, 196, 48, 0.12)",
  },
  smartButtonText: { color: colors.ink, fontWeight: "800", fontSize: 12 },
  quickPickLoading: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  quickPickCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    flexDirection: "row",
    gap: spacing.sm,
  },
  quickPickPoster: { width: 88, height: 132, borderRadius: 10, backgroundColor: colors.backgroundElevated },
  quickPickPosterFallback: { width: 88, height: 132, borderRadius: 10, backgroundColor: colors.backgroundElevated },
  quickPickCopy: { flex: 1, gap: 6 },
  quickPickTitle: { color: colors.accent, fontWeight: "900", fontSize: 17 },
  quickPickMeta: { color: colors.ink, opacity: 0.84, fontSize: 12, fontWeight: "700" },
  quickPickDescription: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  quickPickReason: { color: colors.muted, fontSize: 12, lineHeight: 18 },
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
  recommendationDescription: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4, minHeight: 48 },
  reasonLine: { color: colors.accent, fontSize: 11, marginTop: 4, fontWeight: "700" },
  subsection: { gap: 8 },
  subsectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  posterStrip: { gap: 10, paddingBottom: 4 },
  stripPoster: {
    width: 82,
    height: 122,
    borderRadius: 10,
    backgroundColor: colors.backgroundElevated,
  },
  stripPosterFallback: {
    width: 82,
    height: 122,
    borderRadius: 10,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  miniEditorialCard: {
    width: 110,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 8,
    gap: 6,
  },
  miniEditorialTitle: {
    color: colors.ink,
    fontWeight: "700",
    fontSize: 11,
  },
  actionPillCompact: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    paddingVertical: 5,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionLabelCompact: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: "700",
  },
  editorialCard: {
    width: 226,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  editorialPoster: {
    width: "100%",
    height: 150,
    borderRadius: 10,
    backgroundColor: colors.backgroundElevated,
  },
  editorialPosterFallback: {
    width: "100%",
    height: 150,
    borderRadius: 10,
    backgroundColor: colors.backgroundElevated,
  },
  editorialTitle: {
    marginTop: 8,
    color: colors.accent,
    fontSize: 16,
    fontWeight: "900",
  },
  editorialMeta: {
    marginTop: 4,
    color: colors.ink,
    opacity: 0.84,
    fontSize: 12,
    fontWeight: "700",
  },
  editorialDescription: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  editorialCardWide: {
    width: 320,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  doubleFeatureTitle: {
    color: colors.accent,
    fontWeight: "900",
    fontSize: 17,
  },
  pulseCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: 4,
  },
  pulseCardFeatured: {
    backgroundColor: colors.surfaceSoft,
  },
  pulseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  teamBadge: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  teamBadgeText: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: 11,
  },
  pulseTime: { color: colors.muted, fontSize: 11 },
  pulseTitle: { color: colors.ink, fontWeight: "700", fontSize: 12 },
  pulseBody: { color: colors.muted, fontSize: 12 },
  pulseFooter: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pulseAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseAvatarText: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 10,
  },
  pulseMeta: { color: colors.muted, fontSize: 11 },
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
