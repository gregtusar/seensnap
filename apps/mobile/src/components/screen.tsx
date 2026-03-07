import { PropsWithChildren } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/theme";

type ScreenProps = PropsWithChildren<{
  title: string;
  subtitle: string;
}>;

export function Screen({ title, subtitle, children }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
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
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
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
    marginTop: 24,
    gap: 16,
  },
});

