import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing } from "@/constants/theme";
import { resolveMediaUrl } from "@/lib/api";
import type { UniversalTitle } from "@/lib/universal-title";

type Props = {
  visible: boolean;
  loading: boolean;
  title: UniversalTitle | null;
  isSaved?: boolean;
  onClose: () => void;
  onSave: () => void;
  onPost: () => void;
  onAddToTeam?: (() => void) | null;
};

export function UniversalTitleModal({
  visible,
  loading,
  title,
  isSaved = false,
  onClose,
  onSave,
  onPost,
  onAddToTeam,
}: Props) {
  const posterOrBackdrop =
    resolveMediaUrl(title?.backdropUrl ?? null) ??
    resolveMediaUrl(title?.posterUrl ?? null) ??
    resolveMediaUrl("/media/brand/title_placeholder.png");
  const metaParts: string[] = [];
  if (typeof title?.ratingTmdb === "number") {
    metaParts.push(`⭐ ${title.ratingTmdb.toFixed(1)} TMDB`);
  }
  if (title?.mediaType === "movie" && typeof title.runtimeMinutes === "number") {
    metaParts.push(`⏱ ${title.runtimeMinutes}m`);
  }
  if (title?.mediaType === "tv" && typeof title.seasons === "number") {
    metaParts.push(`📺 ${title.seasons} Seasons`);
  }
  if (title?.mediaType === "tv" && typeof title.episodeRuntimeMinutes === "number") {
    metaParts.push(`⏱ ${title.episodeRuntimeMinutes}m`);
  }
  if (title?.genres?.length) {
    metaParts.push(`🎭 ${title.genres.slice(0, 3).join(", ")}`);
  }
  if (title?.language) {
    metaParts.push(`🌎 ${title.language}`);
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator>
            {loading ? <Text style={styles.meta}>Loading details...</Text> : null}
            {!loading && posterOrBackdrop ? (
              <Image source={{ uri: posterOrBackdrop }} style={styles.hero} resizeMode="cover" />
            ) : (
              <View style={styles.heroFallback}><Text style={styles.heroFallbackText}>No image</Text></View>
            )}
            <Text style={styles.title}>{title?.title ?? "Title"}</Text>
            <Text style={styles.meta}>
              {(title?.year ?? "-") + " • " + (title?.mediaType === "movie" ? "Movie" : "TV Series")}
            </Text>
            {metaParts.length ? <Text style={styles.meta}>{metaParts.join(" • ")}</Text> : null}
            <Text style={styles.body}>{title?.description ?? "Full details are unavailable right now."}</Text>
            {(title?.credits.creator.length || title?.credits.director.length || title?.credits.cast.length) ? (
              <Text style={styles.credits}>
                {title?.credits.creator.length ? `Creator: ${title.credits.creator.join(", ")}\n` : ""}
                {title?.credits.director.length ? `Director: ${title.credits.director.join(", ")}\n` : ""}
                {title?.credits.cast.length ? `Cast: ${title.credits.cast.slice(0, 5).join(", ")}` : ""}
              </Text>
            ) : null}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable style={[styles.primary, isSaved && styles.primarySaved]} onPress={onSave}>
              <Text style={[styles.primaryText, isSaved && styles.primaryTextSaved]}>
                {isSaved ? "✓ Saved" : "⭐ Save to My Picks"}
              </Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={onPost}><Text style={styles.secondaryText}>📤 Post to Social Feed</Text></Pressable>
            {onAddToTeam ? (
              <Pressable style={styles.secondary} onPress={onAddToTeam}>
                <Text style={styles.secondaryText}>👥 Add to Watch Team</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.close} onPress={onClose}><Text style={styles.closeText}>Close</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 11, 20, 0.74)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
    maxHeight: "92%",
  },
  scrollBody: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  hero: {
    width: "100%",
    height: 172,
    borderRadius: 12,
    backgroundColor: colors.backgroundElevated,
  },
  heroFallback: {
    width: "100%",
    height: 172,
    borderRadius: 12,
    backgroundColor: colors.backgroundElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  heroFallbackText: {
    color: colors.muted,
    fontWeight: "700",
  },
  title: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: "900",
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  body: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 21,
  },
  credits: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  actions: {
    gap: 8,
    marginTop: 2,
  },
  primary: {
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    paddingVertical: 10,
    alignItems: "center",
  },
  primarySaved: {
    backgroundColor: colors.success,
  },
  primaryText: {
    color: colors.background,
    fontWeight: "800",
    fontSize: 13,
  },
  primaryTextSaved: {
    color: colors.background,
  },
  secondary: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryText: {
    color: colors.ink,
    fontWeight: "700",
    fontSize: 13,
  },
  close: {
    alignSelf: "center",
    padding: 6,
  },
  closeText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
});
