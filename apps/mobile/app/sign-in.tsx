import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/screen";
import { colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth";

export default function SignInScreen() {
  const { isLoading, signInWithGoogle } = useAuth();

  return (
    <Screen
      title="Welcome to SeenSnap"
      subtitle="Google auth is the first Milestone 2 login path. Apple auth will plug into the same app session flow next."
    >
      <View style={styles.panel}>
        <Image
          source={require("../assets/branding/seensnap-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.heading}>Sign in to continue</Text>
        <Text style={styles.body}>
          This flow exchanges a Google ID token for a SeenSnap API session token.
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={isLoading}
          onPress={signInWithGoogle}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonLabel}>{isLoading ? "Connecting..." : "Continue with Google"}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 12,
    padding: 20,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logo: {
    width: 180,
    height: 72,
    alignSelf: "center",
    marginBottom: 4,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
  button: {
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonLabel: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
});
