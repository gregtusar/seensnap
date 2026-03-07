import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/screen";
import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth";

export default function SignInScreen() {
  const { isExpoGo, isLoading, signInDemo, signInWithGoogle } = useAuth();

  return (
    <Screen
      title="Welcome to SeenSnap"
      subtitle={
        isExpoGo
          ? "Expo Go is limited to UI iteration. Use demo sign-in here, and use a native development build for real Google auth."
          : "Google auth is the first Milestone 2 login path. Apple auth will plug into the same app session flow next."
      }
    >
      <View style={styles.panel}>
        <Image
          source={require("../assets/branding/seensnap-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.heading}>Sign in to continue</Text>
        <Text style={styles.body}>
          {isExpoGo
            ? "This environment uses a mock session so you can iterate on the app without hitting unsupported OAuth behavior in Expo Go."
            : "This flow exchanges a Google ID token for a SeenSnap API session token."}
        </Text>
        <View style={styles.points}>
          <View style={styles.pointRow}>
            <Ionicons name="flash" color={colors.accent} size={16} />
            <Text style={styles.pointText}>Snap a scene, identify the title, and save it in one pass.</Text>
          </View>
          <View style={styles.pointRow}>
            <Ionicons name="people" color={colors.accent} size={16} />
            <Text style={styles.pointText}>Compare picks with your watch team in a shared social feed.</Text>
          </View>
        </View>
        {isExpoGo ? (
          <Pressable
            accessibilityRole="button"
            disabled={isLoading}
            onPress={signInDemo}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonLabel}>{isLoading ? "Loading..." : "Continue in Demo Mode"}</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={isLoading}
            onPress={signInWithGoogle}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonLabel}>
              {isLoading ? "Connecting..." : "Continue with Google"}
            </Text>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 16 },
  },
  logo: {
    width: 180,
    height: 72,
    alignSelf: "center",
    marginBottom: 4,
  },
  heading: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.ink,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
  points: {
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  pointRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  pointText: {
    flex: 1,
    color: colors.ink,
    lineHeight: 20,
  },
  button: {
    marginTop: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonLabel: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
});
