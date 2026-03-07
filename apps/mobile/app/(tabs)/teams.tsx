import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { Screen } from "@/components/screen";
import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";

type TeamSummary = {
  id: string;
  name: string;
  owner_user_id: string;
  invite_code: string;
  max_members: number;
  member_count: number;
};

type TeamMember = {
  user_id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  role: string;
  status: string;
  joined_at: string;
};

type TeamResponse = TeamSummary & {
  members: TeamMember[];
};

type TeamActivity = {
  id: string;
  activity_type: string;
  actor_user_id: string;
  actor_display_name?: string | null;
  actor_avatar_url?: string | null;
  content_title_id?: string | null;
  entity_id?: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export default function TeamsScreen() {
  const { sessionToken, user } = useAuth();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<TeamResponse | null>(null);
  const [activity, setActivity] = useState<TeamActivity[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTeamSummary = teams.find((team) => team.id === selectedTeamId) ?? teams[0] ?? null;
  const currentMembership = useMemo(
    () => selectedTeam?.members.find((member) => member.user_id === user?.user_id) ?? null,
    [selectedTeam, user?.user_id]
  );
  const isOwner = currentMembership?.role === "owner";

  const loadTeams = useCallback(async () => {
    if (!sessionToken) {
      return [];
    }

    const data = await apiRequest<TeamSummary[]>("/teams", { token: sessionToken });
    setTeams(data);
    setSelectedTeamId((current) => {
      if (current && data.some((team) => team.id === current)) {
        return current;
      }
      return data[0]?.id ?? null;
    });
    return data;
  }, [sessionToken]);

  const loadSelectedTeam = useCallback(
    async (teamId: string) => {
      if (!sessionToken) {
        return;
      }

      const [team, feed] = await Promise.all([
        apiRequest<TeamResponse>(`/teams/${teamId}`, { token: sessionToken }),
        apiRequest<TeamActivity[]>(`/teams/${teamId}/activity`, { token: sessionToken }),
      ]);
      setSelectedTeam(team);
      setActivity(feed);
    },
    [sessionToken]
  );

  useFocusEffect(
    useCallback(() => {
      async function refresh() {
        if (!sessionToken) {
          return;
        }
        setError(null);
        try {
          const loaded = await loadTeams();
          if (!selectedTeamId && loaded[0]?.id) {
            await loadSelectedTeam(loaded[0].id);
          }
        } catch (loadError) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load teams");
        }
      }

      void refresh();
    }, [loadSelectedTeam, loadTeams, selectedTeamId, sessionToken])
  );

  useEffect(() => {
    async function refreshSelectedTeam() {
      if (!selectedTeamId) {
        setSelectedTeam(null);
        setActivity([]);
        return;
      }

      setError(null);
      try {
        await loadSelectedTeam(selectedTeamId);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load team details");
      }
    }

    void refreshSelectedTeam();
  }, [loadSelectedTeam, selectedTeamId]);

  async function createTeam() {
    if (!sessionToken || !newTeamName.trim()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const created = await apiRequest<TeamResponse>("/teams", {
        method: "POST",
        token: sessionToken,
        body: JSON.stringify({ name: newTeamName.trim(), max_members: 5 }),
      });
      setNewTeamName("");
      await loadTeams();
      setSelectedTeamId(created.id);
      await loadSelectedTeam(created.id);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create team");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function joinTeam() {
    if (!sessionToken || !inviteCode.trim()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const joined = await apiRequest<TeamResponse>("/teams/join", {
        method: "POST",
        token: sessionToken,
        body: JSON.stringify({ invite_code: inviteCode.trim() }),
      });
      setInviteCode("");
      await loadTeams();
      setSelectedTeamId(joined.id);
      await loadSelectedTeam(joined.id);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Failed to join team");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function leaveTeam() {
    if (!sessionToken || !selectedTeam) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await apiRequest<void>(`/teams/${selectedTeam.id}/leave`, {
        method: "POST",
        token: sessionToken,
      });
      setSelectedTeam(null);
      setActivity([]);
      const loaded = await loadTeams();
      setSelectedTeamId(loaded[0]?.id ?? null);
    } catch (leaveError) {
      setError(leaveError instanceof Error ? leaveError.message : "Failed to leave team");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function removeMember(memberUserId: string) {
    if (!sessionToken || !selectedTeam) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await apiRequest<TeamResponse>(`/teams/${selectedTeam.id}/members/${memberUserId}`, {
        method: "DELETE",
        token: sessionToken,
      });
      setSelectedTeam(updated);
      await loadTeams();
      await loadSelectedTeam(updated.id);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to remove member");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen
      title="Teams"
      subtitle="Manage invite-only watch teams, see the member roster, and keep activity anchored to the group."
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Watch teams</Text>
          <Text style={styles.heroTitle}>
            {teams.length ? `${teams.length} active teams` : "Start your first team"}
          </Text>
          <Text style={styles.heroBody}>
            {selectedTeamSummary
              ? `Invite code ${selectedTeamSummary.invite_code.toUpperCase()} • ${selectedTeamSummary.member_count}/${selectedTeamSummary.max_members} members`
              : "Create a team for your group or join an existing one with an invite code."}
          </Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.formBlock}>
            <Text style={styles.formLabel}>Create a team</Text>
            <TextInput
              onChangeText={setNewTeamName}
              placeholder="Friday horror crew"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={newTeamName}
            />
            <Pressable disabled={isSubmitting} onPress={() => void createTeam()} style={styles.primaryButton}>
              <Text style={styles.primaryButtonLabel}>{isSubmitting ? "Working..." : "Create team"}</Text>
            </Pressable>
          </View>

          <View style={styles.formBlock}>
            <Text style={styles.formLabel}>Join by invite code</Text>
            <TextInput
              autoCapitalize="characters"
              onChangeText={setInviteCode}
              placeholder="AB12CD34"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={inviteCode}
            />
            <Pressable disabled={isSubmitting} onPress={() => void joinTeam()} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>Join team</Text>
            </Pressable>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My teams</Text>
          <Text style={styles.sectionMeta}>{user?.display_name ?? "SeenSnap user"}</Text>
        </View>

        {teams.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No teams yet</Text>
            <Text style={styles.emptyBody}>Create one above or join with a code to start the social layer.</Text>
          </View>
        ) : (
          teams.map((team) => (
            <Pressable
              key={team.id}
              onPress={() => setSelectedTeamId(team.id)}
              style={[styles.teamCard, selectedTeamSummary?.id === team.id && styles.teamCardSelected]}
            >
              <View style={styles.teamHeader}>
                <View>
                  <Text style={styles.teamName}>{team.name}</Text>
                  <Text style={styles.teamMeta}>
                    Invite {team.invite_code.toUpperCase()} • {team.member_count}/{team.max_members}
                  </Text>
                </View>
                <View style={styles.teamBadge}>
                  <Ionicons name="people" color={colors.background} size={16} />
                </View>
              </View>
            </Pressable>
          ))
        )}

        {selectedTeam ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Members</Text>
              <Text style={styles.sectionMeta}>{selectedTeam.name}</Text>
            </View>

            <View style={styles.membersCard}>
              {selectedTeam.members.map((member) => (
                <View key={`${member.user_id}-${member.status}`} style={styles.memberRow}>
                  <View style={styles.memberAvatar}>
                    <Ionicons name="person" color={colors.background} size={16} />
                  </View>
                  <View style={styles.memberCopy}>
                    <Text style={styles.memberName}>{member.display_name ?? "SeenSnap User"}</Text>
                    <Text style={styles.memberMeta}>
                      {member.role} • {member.status}
                    </Text>
                  </View>
                  {isOwner && member.status === "active" && member.user_id !== selectedTeam.owner_user_id ? (
                    <Pressable onPress={() => void removeMember(member.user_id)} style={styles.memberAction}>
                      <Text style={styles.memberActionLabel}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>

            <View style={styles.actionRow}>
              <Pressable disabled={isSubmitting} onPress={() => void leaveTeam()} style={styles.leaveButton}>
                <Text style={styles.leaveButtonLabel}>{isSubmitting ? "Working..." : "Leave team"}</Text>
              </Pressable>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Team feed</Text>
              <Text style={styles.sectionMeta}>{selectedTeam.name}</Text>
            </View>

            {activity.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No activity yet</Text>
                <Text style={styles.emptyBody}>Creation, joins, removals, and ownership changes will appear here.</Text>
              </View>
            ) : null}

            {activity.map((item) => (
              <View key={item.id} style={styles.feedItem}>
                <View style={styles.feedIcon}>
                  <Ionicons name={activityIcon(item.activity_type)} color={colors.background} size={16} />
                </View>
                <View style={styles.feedCopy}>
                  <Text style={styles.feedTitle}>{labelActivity(item, selectedTeam.name)}</Text>
                  <Text style={styles.feedBody}>{formatTimestamp(item.created_at)}</Text>
                </View>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function activityIcon(type: string) {
  switch (type) {
    case "title_shared":
      return "send";
    case "member_joined":
      return "person-add";
    case "member_left":
      return "log-out";
    case "member_removed":
      return "remove-circle";
    case "ownership_transferred":
      return "swap-horizontal";
    case "team_archived":
      return "archive";
    default:
      return "sparkles";
  }
}

function labelActivity(item: TeamActivity, teamName: string) {
  const actor = item.actor_display_name ?? "A member";
  switch (item.activity_type) {
    case "title_shared":
      return `${actor} shared ${String(item.payload.title_name ?? "a title")} with ${teamName}`;
    case "member_joined":
      return `${actor} joined ${teamName}`;
    case "member_left":
      return `${actor} left ${teamName}`;
    case "member_removed":
      return `${actor} removed a member`;
    case "ownership_transferred":
      return `${actor} is now the team owner`;
    case "team_archived":
      return `${teamName} was archived`;
    case "team_created":
      return `${teamName} was created`;
    default:
      return item.activity_type;
  }
}

function formatTimestamp(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: 32,
  },
  heroCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroEyebrow: {
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontWeight: "800",
  },
  heroTitle: {
    fontSize: 26,
    color: colors.ink,
    fontWeight: "900",
  },
  heroBody: {
    color: colors.muted,
    lineHeight: 22,
  },
  formCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formBlock: {
    gap: spacing.sm,
  },
  formLabel: {
    color: colors.ink,
    fontWeight: "800",
  },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    color: colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 14,
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
  },
  secondaryButton: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: 14,
  },
  secondaryButtonLabel: {
    textAlign: "center",
    color: colors.accent,
    fontWeight: "800",
  },
  error: {
    color: colors.danger,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "800",
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  emptyCard: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  emptyBody: {
    color: colors.muted,
    lineHeight: 22,
  },
  teamCard: {
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  teamCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceMuted,
  },
  teamHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  teamName: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  teamMeta: {
    marginTop: 4,
    color: colors.muted,
  },
  teamBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  membersCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  memberCopy: {
    flex: 1,
  },
  memberName: {
    color: colors.ink,
    fontWeight: "800",
  },
  memberMeta: {
    marginTop: 2,
    color: colors.muted,
    textTransform: "capitalize",
  },
  memberAction: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  memberActionLabel: {
    color: colors.danger,
    fontWeight: "800",
  },
  actionRow: {
    flexDirection: "row",
  },
  leaveButton: {
    flex: 1,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 14,
  },
  leaveButtonLabel: {
    textAlign: "center",
    color: colors.danger,
    fontWeight: "800",
  },
  feedItem: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feedIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  feedCopy: {
    flex: 1,
  },
  feedTitle: {
    color: colors.ink,
    fontWeight: "800",
  },
  feedBody: {
    marginTop: 4,
    color: colors.muted,
  },
});
