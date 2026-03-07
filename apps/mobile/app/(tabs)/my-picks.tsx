import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { Screen } from "@/components/screen";
import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";

type WatchlistItem = {
  id: string;
  content_title_id: string;
  added_via: string;
  created_at: string;
  title: {
    id: string;
    title: string;
    content_type: string;
    overview?: string | null;
    poster_url?: string | null;
    genres: string[];
  };
};

type WatchlistResponse = {
  id: string;
  name: string;
  items: WatchlistItem[];
};

type TeamSummary = {
  id: string;
  name: string;
  owner_user_id: string;
  invite_code: string;
  max_members: number;
  member_count: number;
};

export default function MyPicksScreen() {
  const { sessionToken } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchlistResponse | null>(null);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [sharedByItemId, setSharedByItemId] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? teams[0] ?? null;

  const loadData = useCallback(async () => {
    if (!sessionToken) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [watchlistData, teamData] = await Promise.all([
        apiRequest<WatchlistResponse>("/me/watchlist", { token: sessionToken }),
        apiRequest<TeamSummary[]>("/teams", { token: sessionToken }),
      ]);
      setWatchlist(watchlistData);
      setTeams(teamData);
      setSelectedTeamId((current) => {
        if (current && teamData.some((team) => team.id === current)) {
          return current;
        }
        return teamData[0]?.id ?? null;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load My Picks");
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  async function removeItem(itemId: string) {
    if (!sessionToken) {
      return;
    }
    try {
      const updated = await apiRequest<WatchlistResponse>(`/me/watchlist/items/${itemId}`, {
        method: "DELETE",
        token: sessionToken,
      });
      setWatchlist(updated);
      setSharedByItemId((current) => {
        const next = { ...current };
        delete next[itemId];
        return next;
      });
    } catch (watchlistError) {
      setError(watchlistError instanceof Error ? watchlistError.message : "Failed to remove item");
    }
  }

  async function shareItem(item: WatchlistItem) {
    if (!sessionToken || !selectedTeam) {
      setError("Join or create a team before sharing");
      return;
    }

    try {
      await apiRequest(`/shares/teams/${selectedTeam.id}`, {
        method: "POST",
        token: sessionToken,
        body: JSON.stringify({ content_title_id: item.content_title_id }),
      });
      setSharedByItemId((current) => ({ ...current, [item.id]: selectedTeam.id }));
      setError(null);
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : "Failed to share title");
    }
  }

  return (
    <Screen
      title="My Picks"
      subtitle="Save titles for yourself, then explicitly push the best ones into one of your watch teams."
    >
      <ScrollView contentContainerStyle={styles.list}>
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryEyebrow}>Watch Team Top 10</Text>
            <Text style={styles.summaryTitle}>{watchlist?.items.length ?? 0} titles in rotation</Text>
          </View>
          <View style={styles.summaryScore}>
            <Text style={styles.summaryScoreValue}>{Math.min((watchlist?.items.length ?? 0) + 7, 10)}.0</Text>
          </View>
        </View>

        <View style={styles.shareCard}>
          <View style={styles.shareHeader}>
            <Text style={styles.shareTitle}>Share target</Text>
            <Text style={styles.shareMeta}>
              {selectedTeam ? `${selectedTeam.member_count}/${selectedTeam.max_members} members` : "No team selected"}
            </Text>
          </View>
          {teams.length === 0 ? (
            <Text style={styles.shareEmpty}>Create or join a team from the Teams tab to share picks into the feed.</Text>
          ) : (
            <View style={styles.teamChipRow}>
              {teams.map((team) => (
                <Pressable
                  key={team.id}
                  onPress={() => setSelectedTeamId(team.id)}
                  style={[styles.teamChip, selectedTeam?.id === team.id && styles.teamChipSelected]}
                >
                  <Text style={[styles.teamChipLabel, selectedTeam?.id === team.id && styles.teamChipLabelSelected]}>
                    {team.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {isLoading ? <ActivityIndicator color={colors.accent} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!isLoading && watchlist?.items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyBody}>Search from the Home tab and add a few titles to build out My Picks.</Text>
          </View>
        ) : null}
        {watchlist?.items.map((item) => {
          const wasSharedToSelectedTeam = selectedTeam && sharedByItemId[item.id] === selectedTeam.id;

          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                {item.title.poster_url ? (
                  <Image source={{ uri: item.title.poster_url }} style={styles.posterImage} />
                ) : (
                  <View style={styles.posterStub}>
                    <Ionicons name="film" color={colors.accent} size={18} />
                  </View>
                )}
                <View style={styles.cardCopy}>
                  <Text style={styles.title}>{item.title.title}</Text>
                  <Text style={styles.meta}>{item.title.content_type}</Text>
                </View>
                <View style={styles.rankBox}>
                  <Text style={styles.rankValue}>{9.5 - Math.min(item.title.title.length % 3, 2)}</Text>
                </View>
              </View>
              <Text numberOfLines={3} style={styles.body}>
                {item.title.overview || "No overview available yet."}
              </Text>
              <Text style={styles.tagline}>#{item.added_via} watch team pick</Text>
              <View style={styles.actionStack}>
                <Pressable
                  disabled={!selectedTeam || wasSharedToSelectedTeam}
                  onPress={() => void shareItem(item)}
                  style={[
                    styles.shareButton,
                    (!selectedTeam || wasSharedToSelectedTeam) && styles.shareButtonDisabled,
                  ]}
                >
                  <Text style={styles.shareButtonLabel}>
                    {!selectedTeam
                      ? "Create or join a team to share"
                      : wasSharedToSelectedTeam
                        ? `Shared to ${selectedTeam.name}`
                        : `Share to ${selectedTeam.name}`}
                  </Text>
                </Pressable>
                <Pressable onPress={() => void removeItem(item.id)} style={styles.removeButton}>
                  <Text style={styles.removeButtonLabel}>Remove</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryEyebrow: {
    color: colors.accent,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontWeight: "800",
  },
  summaryTitle: {
    marginTop: 4,
    fontSize: 24,
    color: colors.ink,
    fontWeight: "900",
  },
  summaryScore: {
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  summaryScoreValue: {
    color: colors.background,
    fontSize: 24,
    fontWeight: "900",
  },
  shareCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  shareTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  shareMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  shareEmpty: {
    color: colors.muted,
    lineHeight: 22,
  },
  teamChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  teamChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.backgroundElevated,
  },
  teamChipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceMuted,
  },
  teamChipLabel: {
    color: colors.ink,
    fontWeight: "700",
  },
  teamChipLabelSelected: {
    color: colors.accent,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
  emptyState: {
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.ink,
  },
  emptyBody: {
    color: colors.muted,
    lineHeight: 22,
  },
  list: {
    gap: spacing.md,
    paddingBottom: 32,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  posterImage: {
    width: 52,
    height: 70,
    borderRadius: 14,
    backgroundColor: colors.backgroundElevated,
  },
  posterStub: {
    width: 52,
    height: 70,
    borderRadius: 14,
    backgroundColor: colors.backgroundElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  cardCopy: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.ink,
  },
  meta: {
    textTransform: "capitalize",
    color: colors.accent,
    fontWeight: "700",
  },
  rankBox: {
    borderRadius: 16,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  rankValue: {
    color: colors.background,
    fontWeight: "900",
    fontSize: 18,
  },
  body: {
    color: colors.muted,
    lineHeight: 22,
  },
  tagline: {
    color: colors.accent,
    fontWeight: "700",
  },
  actionStack: {
    gap: spacing.sm,
  },
  shareButton: {
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    paddingVertical: 12,
  },
  shareButtonDisabled: {
    opacity: 0.55,
  },
  shareButtonLabel: {
    textAlign: "center",
    color: colors.background,
    fontWeight: "800",
  },
  removeButton: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 12,
  },
  removeButtonLabel: {
    textAlign: "center",
    color: colors.danger,
    fontWeight: "800",
  },
});
