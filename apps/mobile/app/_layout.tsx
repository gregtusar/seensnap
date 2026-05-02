import { Redirect, Stack, useSegments } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { colors } from "@/constants/theme";
import { AuthProvider, useAuth } from "@/lib/auth";

function BootScreen() {
  return (
    <View style={styles.boot}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

function AuthGate() {
  const { isLoading, sessionToken } = useAuth();
  const segments = useSegments();
  const inAuthRoute = segments[0] === "sign-in";

  if (isLoading) {
    return <BootScreen />;
  }

  if (!sessionToken && !inAuthRoute) {
    return <Redirect href="/sign-in" />;
  }

  if (sessionToken && inAuthRoute) {
    return <Redirect href="/(tabs)" />;
  }

    return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile/[userId]" />
      <Stack.Screen name="what-next" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
