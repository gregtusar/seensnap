import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { Screen } from "@/components/screen";
import { colors, radii, spacing } from "@/constants/theme";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Profile = {
  user_id: string;
  email: string;
  username: string;
  display_name: string;
  favorite_genres: string[];
  country_code: string;
  avatar_url?: string | null;
  bio?: string | null;
};

type PublicPost = {
  id: string;
  title_name?: string | null;
  title_poster_url?: string | null;
  caption?: string | null;
  rating?: number | null;
  created_at: string;
};

export default function ProfileScreen() {
  const { sessionToken, user, updateSessionUser } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [draftUsername, setDraftUsername] = useState("");
  const [draftBio, setDraftBio] = useState("");
  const [draftAvatarUrl, setDraftAvatarUrl] = useState("");

  const bioCount = draftBio.length;
  const canSave = Boolean(draftDisplayName.trim() && draftUsername.trim().length >= 3 && bioCount <= 280);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        if (!sessionToken) {
          return;
        }
        setIsLoading(true);
        setError(null);
        try {
          const me = await apiRequest<Profile>("/me", { token: sessionToken });
          setProfile(me);
          const history = await apiRequest<PublicPost[]>(`/profiles/${me.user_id}/posts`, { token: sessionToken });
          setPosts(history);
        } catch (loadError) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load profile");
        } finally {
          setIsLoading(false);
        }
      }
      void load();
    }, [sessionToken])
  );

  const firstName = useMemo(() => profile?.display_name?.split(" ")[0] ?? "You", [profile?.display_name]);

  function openEditModal() {
    if (!profile) {
      return;
    }
    setDraftDisplayName(profile.display_name);
    setDraftUsername(profile.username);
    setDraftBio(profile.bio ?? "");
    setDraftAvatarUrl(profile.avatar_url ?? "");
    setShowEdit(true);
  }

  async function saveProfile() {
    if (!sessionToken || !profile || !canSave) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const updated = await apiRequest<Profile>("/me", {
        method: "PATCH",
        token: sessionToken,
        body: JSON.stringify({
          display_name: draftDisplayName.trim(),
          username: draftUsername.trim().toLowerCase(),
          bio: draftBio.trim() || null,
          avatar_url: draftAvatarUrl.trim() || null,
        }),
      });
      setProfile(updated);
      await updateSessionUser({
        display_name: updated.display_name,
        avatar_url: updated.avatar_url ?? null,
      });
      setShowEdit(false);
      setToast("Profile updated");
      setTimeout(() => setToast(null), 1800);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Screen title="My Profile" subtitle="Manage your identity and see your public posting history.">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {isLoading ? <ActivityIndicator color={colors.accent} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {profile ? (
          <>
            <View style={styles.card}>
              <Avatar uri={profile.avatar_url} label={profile.display_name} size={68} />
              <View style={styles.identity}>
                <Text style={styles.name}>{profile.display_name}</Text>
                <Text style={styles.username}>@{profile.username}</Text>
                <Text style={styles.email}>{profile.email}</Text>
              </View>
              <Pressable style={styles.editButton} onPress={openEditModal}>
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </Pressable>
            </View>

            <View style={styles.bioCard}>
              <Text style={styles.sectionLabel}>Bio</Text>
              <Text style={styles.bioText}>{profile.bio?.trim() ? profile.bio : "No bio yet."}</Text>
              <Text style={styles.bioMeta}>Welcome back, {firstName}.</Text>
            </View>

            <View style={styles.postsHeader}>
              <Text style={styles.sectionLabel}>Public Posts</Text>
              <Text style={styles.postsCount}>{posts.length}</Text>
            </View>
            {posts.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No public posts yet</Text>
                <Text style={styles.emptyBody}>Posts you share to your wall will appear here.</Text>
              </View>
            ) : (
              posts.map((post) => (
                <View key={post.id} style={styles.postCard}>
                  <Poster uri={post.title_poster_url} />
                  <View style={styles.postCopy}>
                    <Text style={styles.postTitle}>{post.title_name ?? "Freeform post"}</Text>
                    {post.caption ? <Text style={styles.postCaption}>{post.caption}</Text> : null}
                    <View style={styles.postMetaRow}>
                      {typeof post.rating === "number" ? <Text style={styles.postMeta}>{post.rating}/10</Text> : null}
                      <Text style={styles.postMeta}>{relativeTime(post.created_at)}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>

      <Modal visible={showEdit} transparent animationType="slide" onRequestClose={() => setShowEdit(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowEdit(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalBody}>
              <Text style={styles.inputLabel}>Display Name</Text>
              <TextInput
                style={styles.input}
                value={draftDisplayName}
                onChangeText={setDraftDisplayName}
                placeholder="Display name"
                placeholderTextColor={colors.muted}
                autoCapitalize="words"
              />
              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                style={styles.input}
                value={draftUsername}
                onChangeText={setDraftUsername}
                placeholder="username"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
              />
              <Text style={styles.inputLabel}>Avatar URL</Text>
              <TextInput
                style={styles.input}
                value={draftAvatarUrl}
                onChangeText={setDraftAvatarUrl}
                placeholder="https://..."
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
              />
              <Text style={styles.inputLabel}>Bio</Text>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={draftBio}
                onChangeText={setDraftBio}
                placeholder="Tell people what you watch"
                placeholderTextColor={colors.muted}
                multiline
                maxLength={280}
              />
              <Text style={styles.counter}>{bioCount}/280</Text>
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setShowEdit(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSave, (!canSave || isSaving) && styles.modalSaveDisabled]}
                disabled={!canSave || isSaving}
                onPress={() => void saveProfile()}
              >
                <Text style={styles.modalSaveText}>{isSaving ? "Saving..." : "Save Changes"}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </Screen>
  );
}

function Avatar({ uri, label, size }: { uri?: string | null; label: string; size: number }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceSoft }} />;
  }
  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name="person" color={colors.ink} size={Math.max(size * 0.42, 18)} />
    </View>
  );
}

function Poster({ uri }: { uri?: string | null }) {
  if (!uri) {
    return (
      <View style={styles.posterFallback}>
        <Ionicons name="film" size={16} color={colors.muted} />
      </View>
    );
  }
  return <Image source={{ uri }} style={styles.poster} />;
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
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  identity: {
    flex: 1,
  },
  name: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 18,
  },
  username: {
    marginTop: 2,
    color: colors.muted,
    fontWeight: "600",
  },
  email: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
  },
  editButton: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  editButtonText: {
    color: colors.accent,
    fontWeight: "800",
    fontSize: 12,
  },
  bioCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
    gap: 8,
  },
  sectionLabel: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 16,
  },
  bioText: {
    color: colors.ink,
    lineHeight: 20,
  },
  bioMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  postsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  postsCount: {
    color: colors.accent,
    fontWeight: "800",
    fontSize: 14,
  },
  postCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderColor: colors.border,
    borderWidth: 1,
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
  postCaption: {
    color: colors.ink,
    lineHeight: 19,
  },
  postMetaRow: {
    marginTop: 6,
    flexDirection: "row",
    gap: spacing.md,
  },
  postMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  empty: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.lg,
    gap: 8,
  },
  emptyTitle: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 16,
  },
  emptyBody: {
    color: colors.muted,
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(2, 6, 12, 0.72)",
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderColor: colors.border,
    borderTopWidth: 1,
    maxHeight: "88%",
    paddingTop: spacing.lg,
  },
  modalTitle: {
    color: colors.ink,
    fontWeight: "900",
    fontSize: 20,
    paddingHorizontal: spacing.lg,
  },
  modalBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: 8,
  },
  inputLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    color: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  bioInput: {
    minHeight: 92,
    textAlignVertical: "top",
  },
  counter: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "right",
  },
  modalActions: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: spacing.lg + (Platform.OS === "ios" ? 8 : 0),
  },
  modalCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCancelText: {
    color: colors.ink,
    fontWeight: "700",
  },
  modalSave: {
    flex: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalSaveDisabled: {
    opacity: 0.55,
  },
  modalSaveText: {
    color: colors.background,
    fontWeight: "900",
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
  },
  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    backgroundColor: colors.success,
    borderRadius: radii.pill,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  toastText: {
    color: colors.background,
    fontWeight: "800",
  },
});
