import { Redirect, Stack, useSegments } from "expo-router";

import { AuthProvider, useAuth } from "@/lib/auth";

function AuthGate() {
  const { isLoading, sessionToken } = useAuth();
  const segments = useSegments();
  const inAuthRoute = segments[0] === "sign-in";

  if (isLoading) {
    return null;
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
