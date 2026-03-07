import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { PlaceholderCard } from "@/components/placeholder-card";
import { Screen } from "@/components/screen";
import { colors, radii, spacing } from "@/constants/theme";

export default function SettingsScreen() {
  return (
    <Screen
      title="Profile"
      subtitle="Preferences will cover notifications, connected services, and share defaults."
    >
      <View style={styles.accountCard}>
        <View style={styles.avatar}>
          <Ionicons name="person" color={colors.background} size={24} />
        </View>
        <View style={styles.accountCopy}>
          <Text style={styles.accountTitle}>Social-first profile</Text>
          <Text style={styles.accountBody}>Dark navy shell, gold action states, and compact utility rows from the guide.</Text>
        </View>
      </View>
      <PlaceholderCard
        eyebrow="Preferences"
        title="US-first configuration"
        body="This screen will manage notification permissions, connected streaming services, and the Instagram-first share defaults from the PRD."
      />
      <View style={styles.utilityGrid}>
        <View style={styles.utility}>
          <Text style={styles.utilityLabel}>Notifications</Text>
          <Text style={styles.utilityValue}>Enabled</Text>
        </View>
        <View style={styles.utility}>
          <Text style={styles.utilityLabel}>Streaming</Text>
          <Text style={styles.utilityValue}>Not linked</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  accountCard: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  accountCopy: {
    flex: 1,
  },
  accountTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  accountBody: {
    marginTop: 4,
    color: colors.muted,
    lineHeight: 20,
  },
  utilityGrid: {
    flexDirection: "row",
    gap: spacing.md,
  },
  utility: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  utilityLabel: {
    color: colors.muted,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  utilityValue: {
    marginTop: 6,
    color: colors.ink,
    fontWeight: "800",
    fontSize: 18,
  },
});
