import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { SaveToListSheet } from "@/components/save-to-list-sheet";
import { UniversalTitleModal } from "@/components/universal-title-modal";
import { colors, radii, spacing } from "@/constants/theme";
import { apiRequest, resolveMediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fetchUniversalTitle, type UniversalTitle } from "@/lib/universal-title";

type PublicProfile = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  bio?: string | null;
  follower_count: number;
  following_count: number;
  post_count: number;
  is_following: boolean;
  can_follow: boolean;
};

type PublicPost = {
  id: string;
  title_id?: string | null;
  title_name?: string | null;
  title_poster_url?: string | null;
  caption?: string | null;
  rating?: number | null;
  created_at: string;
};

export default function PublicProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { sessionToken } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

  const [showDetails, setShowDetails] = useState(false);
  const [detailTitle, setDetailTitle] = useState<UniversalTitle | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [saveTitleId, setSaveTitleId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        if (!sessionToken || !userId) {
          return;
        }
        setIsLoading(true);
        setError(null);
        try {
          const [p, feed] = await Promise.all([
            apiRequest<PublicProfile>(`/profiles/${userId}`, { token: sessionToken }),
            apiRequest<PublicPost[]>(`/profiles/${userId}/posts`, { token: sessionToken }),
          ]);
          setProfile(p);
          setPosts(feed);
        } catch (loadError) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load profile");
        } finally {
          setIsLoading(false);
        }
      }
      void load();
    }, [sessionToken, userId])
  );

  async function openDetails(post: PublicPost) {
    if (!sessionToken || !post.title_id) {
      return;
    }
    setShowDetails(true);
    setDetailLoading(true);
    try {
      const title = await fetchUniversalTitle(sessionToken, post.title_id, {
        id: post.title_id,
        title: post.title_name ?? "Untitled",
        content_type: "movie",
        poster_url: post.title_poster_url,
        overview: post.caption,
      });
      setDetailTitle(title);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Could not load title details");
      setDetailTitle(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function toggleFollow() {
    if (!sessionToken || !profile || !profile.can_follow || followBusy) {
      return;
    }
    const currentlyFollowing = profile.is_following;
    setFollowBusy(true);
    try {
      await apiRequest<void>(`/profiles/${profile.user_id}/follow`, {
        method: currentlyFollowing ? "DELETE" : "POST",
        token: sessionToken,
      });
      setProfile((current) =>
        current
          ? {
              ...current,
              is_following: !currentlyFollowing,
              follower_count: Math.max(current.follower_count + (currentlyFollowing ? -1 : 1), 0),
            }
          : current
      );
    } catch (followError) {
      setError(followError instanceof Error ? followError.message : "Could not update follow");
    } finally {
      setFollowBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.nav}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <Ionicons name="chevron-back" size={18} color={colors.ink} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>

        {isLoading ? <ActivityIndicator color={colors.accent} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {profile ? (
          <>
            <View style={styles.headerCard}>
              <Avatar uri={profile.avatar_url} label={profile.display_name} size={76} />
              <Text style={styles.name}>{profile.display_name}</Text>
              <Text style={styles.username}>@{profile.username}</Text>
              <Text style={styles.bio}>{profile.bio?.trim() ? profile.bio : "No bio yet."}</Text>
              <View style={styles.countRow}>
                <Text style={styles.countText}>{profile.follower_count} followers</Text>
                <Text style={styles.countText}>{profile.following_count} following</Text>
                <Text style={styles.countText}>{profile.post_count} posts</Text>
              </View>
              {profile.can_follow ? (
                <Pressable
                  style={[styles.followButton, profile.is_following && styles.followingButton, followBusy && styles.followDisabled]}
                  onPress={() => void toggleFollow()}
                  disabled={followBusy}
                >
                  <Text style={[styles.followButtonText, profile.is_following && styles.followingButtonText]}>
                    {followBusy ? "..." : profile.is_following ? "Following" : "Follow"}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.postsHeader}>
              <Text style={styles.sectionTitle}>Public Posts</Text>
              <Text style={styles.postsCount}>{posts.length}</Text>
            </View>
            {posts.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No public posts yet</Text>
              </View>
            ) : (
              posts.map((post) => (
                <View key={post.id} style={styles.postCard}>
                  <Pressable onPress={() => void openDetails(post)}>
                    <Poster uri={post.title_poster_url} />
                  </Pressable>
                  <View style={styles.postCopy}>
                    <Pressable onPress={() => void openDetails(post)} disabled={!post.title_id}>
                      <Text style={styles.postTitle}>{post.title_name ?? "Freeform post"}</Text>
                    </Pressable>
                    {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
                    <View style={styles.metaRow}>
                      {typeof post.rating === "number" ? <Text style={styles.meta}>{post.rating}/10</Text> : null}
                      <Text style={styles.meta}>{relativeTime(post.created_at)}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </>
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
        source="profile"
        onClose={() => {
          setShowSaveSheet(false);
          setSaveTitleId(null);
        }}
        onError={(message) => setError(message)}
      />
    </SafeAreaView>
  );
}

function Avatar({ uri, label, size }: { uri?: string | null; label: string; size: number }) {
  const resolved = resolveMediaUrl(uri);
  if (resolved) {
    return <Image source={{ uri: resolved }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceSoft }} />;
  }
  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.avatarFallbackText}>{label.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

function Poster({ uri }: { uri?: string | null }) {
  const resolved = resolveMediaUrl(uri);
  if (!resolved) {
    return (
      <View style={styles.posterFallback}>
        <Ionicons name="film" size={16} color={colors.muted} />
      </View>
    );
  }
  return <Image source={{ uri: resolved }} style={styles.poster} />;
}

function relativeTime(dateString: string) {
  const now = Date.now();
  const ts = new Date(dateString).getTime();
  if (Number.isNaN(ts)) {
    return "now";
  }
  const diff = Math.max(now - ts, 0);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backText: {
    color: colors.ink,
    fontWeight: "700",
    fontSize: 12,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  headerCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    alignItems: "center",
    padding: spacing.lg,
    gap: 6,
  },
  name: {
    color: colors.ink,
    fontWeight: "900",
    fontSize: 22,
    marginTop: 6,
  },
  username: {
    color: colors.muted,
    fontWeight: "700",
  },
  bio: {
    color: colors.ink,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 4,
  },
  countRow: {
    marginTop: 6,
    flexDirection: "row",
    gap: spacing.md,
  },
  countText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  followButton: {
    marginTop: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  followingButton: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  followButtonText: {
    color: colors.background,
    fontWeight: "900",
    fontSize: 12,
  },
  followingButtonText: {
    color: colors.accent,
  },
  followDisabled: {
    opacity: 0.55,
  },
  postsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
  },
  postsCount: {
    color: colors.accent,
    fontWeight: "900",
  },
  empty: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.lg,
  },
  emptyTitle: {
    color: colors.muted,
  },
  postCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
  },
  poster: {
    width: 58,
    height: 87,
    borderRadius: 10,
    backgroundColor: colors.surfaceSoft,
  },
  posterFallback: {
    width: 58,
    height: 87,
    borderRadius: 10,
    backgroundColor: colors.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  postCopy: {
    flex: 1,
    gap: 4,
  },
  postTitle: {
    color: colors.accent,
    fontWeight: "800",
    fontSize: 15,
  },
  caption: {
    color: colors.ink,
    lineHeight: 19,
  },
  metaRow: {
    marginTop: 6,
    flexDirection: "row",
    gap: spacing.md,
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
  },
  avatarFallbackText: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 20,
  },
});
