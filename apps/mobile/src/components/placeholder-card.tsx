import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/theme";

type PlaceholderCardProps = {
  eyebrow: string;
  title: string;
  body: string;
  footer?: ReactNode;
};

export function PlaceholderCard({ eyebrow, title, body, footer }: PlaceholderCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.accent,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.ink,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
  footer: {
    marginTop: 8,
  },
});

