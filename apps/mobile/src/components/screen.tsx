import { PropsWithChildren } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing } from "@/constants/theme";

type ScreenProps = PropsWithChildren<{
  title: string;
  subtitle: string;
}>;

export function Screen({ title, subtitle, children }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>SeenSnap</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={styles.body}>{children}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  glowTop: {
    position: "absolute",
    top: -120,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "#18385f",
    opacity: 0.45,
  },
  glowBottom: {
    position: "absolute",
    bottom: -140,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#0f233a",
    opacity: 0.75,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: "rgba(11, 20, 36, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(46, 64, 87, 0.8)",
  },
  kicker: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.accent,
  },
  title: {
    marginTop: spacing.sm,
    fontSize: 36,
    fontWeight: "900",
    color: colors.ink,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 22,
    color: colors.muted,
  },
  body: {
    flex: 1,
    marginTop: spacing.lg,
    gap: spacing.md,
  },
});
