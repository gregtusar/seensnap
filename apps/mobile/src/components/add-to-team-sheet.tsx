import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { colors, radii, spacing } from "@/constants/theme";
import { apiRequest } from "@/lib/api";

type TeamSummary = {
  id: string;
  name: string;
};

type AddTarget = {
  id: string;
  title: string;
};

type Props = {
  visible: boolean;
  token: string | null;
  title: AddTarget | null;
  onClose: () => void;
  onAdded?: (teamName: string) => void;
  onError?: (message: string) => void;
};

export function AddToTeamSheet({ visible, token, title, onClose, onAdded, onError }: Props) {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [alsoPost, setAlsoPost] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTeams() {
      if (!visible || !token) {
        return;
      }
      setLocalError(null);
      try {
        const data = await apiRequest<TeamSummary[]>("/teams", { token });
        setTeams(data);
        setSelectedTeamId(data[0]?.id ?? null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load teams";
        setLocalError(message);
        onError?.(message);
      }
    }
    void loadTeams();
  }, [onError, token, visible]);

  const selectedTeam = useMemo(() => teams.find((team) => team.id === selectedTeamId) ?? null, [selectedTeamId, teams]);

  async function submit() {
    if (!token || !title || !selectedTeamId || busy) {
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      await apiRequest(`/teams/${selectedTeamId}/titles`, {
        method: "POST",
        token,
        body: JSON.stringify({
          content_title_id: title.id,
          note: note.trim() || null,
          also_post_to_feed: alsoPost,
        }),
      });
      const teamName = selectedTeam?.name ?? "team";
      setNote("");
      setAlsoPost(false);
      onAdded?.(teamName);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add to team";
      setLocalError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Add to Watch Team</Text>
          <Text style={styles.subtitle}>{title?.title ?? "Select a title"}</Text>
          <Text style={styles.label}>Choose a team</Text>
          <ScrollView style={{ maxHeight: 180 }} contentContainerStyle={{ gap: 6 }}>
            {teams.map((team) => (
              <Pressable
                key={team.id}
                style={[styles.teamRow, selectedTeamId === team.id && styles.teamRowSelected]}
                onPress={() => setSelectedTeamId(team.id)}
              >
                <Text style={[styles.teamText, selectedTeamId === team.id && styles.teamTextSelected]}>{team.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Why are you adding this?"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Also post to team feed</Text>
            <Switch value={alsoPost} onValueChange={setAlsoPost} trackColor={{ true: colors.accent }} />
          </View>
          {localError ? <Text style={styles.error}>{localError}</Text> : null}
          <Pressable style={[styles.submit, (!selectedTeamId || busy) && styles.submitDisabled]} disabled={!selectedTeamId || busy} onPress={() => void submit()}>
            <Text style={styles.submitText}>{busy ? "Adding..." : "Add"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(6, 12, 20, 0.74)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
    maxHeight: "86%",
  },
  title: {
    color: colors.ink,
    fontWeight: "900",
    fontSize: 20,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
  },
  label: {
    color: colors.ink,
    fontWeight: "700",
    fontSize: 13,
  },
  teamRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  teamRowSelected: {
    borderColor: colors.accent,
    backgroundColor: "rgba(244,196,48,0.12)",
  },
  teamText: {
    color: colors.muted,
    fontWeight: "700",
    fontSize: 13,
  },
  teamTextSelected: {
    color: colors.accent,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.backgroundElevated,
    color: colors.ink,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchLabel: {
    color: colors.muted,
    fontSize: 12,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
  },
  submit: {
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    paddingVertical: 10,
    alignItems: "center",
  },
  submitDisabled: {
    opacity: 0.45,
  },
  submitText: {
    color: colors.background,
    fontWeight: "800",
    fontSize: 13,
  },
});
