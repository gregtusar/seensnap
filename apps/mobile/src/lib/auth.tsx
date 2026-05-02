import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { useIdTokenAuthRequest } from "expo-auth-session/providers/google";
import { Platform } from "react-native";
import { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";

WebBrowser.maybeCompleteAuthSession();

const SESSION_TOKEN_KEY = "session_token";
const SESSION_USER_KEY = "session_user";
const EXPO_PROXY_REDIRECT_URI = "https://auth.expo.io/@gregtusar/seensnap";
const DEMO_EMAILS = new Set(["demo@seensnap.app", "seensnap.demo@demo.seensnap.local"]);
const DEMO_SESSION_TOKEN = "expo-go-demo-session";

type SessionUser = {
  user_id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
};

type SessionResponse = {
  access_token: string;
  token_type: "bearer";
  user: SessionUser;
};

const EXPO_GO_FALLBACK_USER: SessionUser = {
  user_id: "expo-demo",
  email: "seensnap.demo@demo.seensnap.local",
  display_name: "SeenSnap Demo",
  avatar_url: null,
};

type AuthContextValue = {
  isLoading: boolean;
  sessionToken: string | null;
  user: SessionUser | null;
  isExpoGo: boolean;
  signInWithGoogle: () => Promise<void>;
  signInDemo: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSessionUser: () => Promise<void>;
  updateSessionUser: (next: Partial<SessionUser>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const isExpoGo = Constants.appOwnership === "expo";
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const hasGoogleConfig = Boolean(
    webClientId &&
      (isExpoGo ||
        (Platform.OS === "ios" && (iosClientId || webClientId)) ||
        (Platform.OS === "android" && (androidClientId || webClientId)))
  );
  const [, response, promptAsync] = useIdTokenAuthRequest({
    clientId: isExpoGo ? (webClientId ?? "dev-placeholder") : undefined,
    redirectUri: isExpoGo ? EXPO_PROXY_REDIRECT_URI : undefined,
    iosClientId: isExpoGo ? undefined : (iosClientId ?? webClientId ?? "dev-placeholder"),
    androidClientId: isExpoGo ? undefined : (androidClientId ?? webClientId ?? "dev-placeholder"),
    webClientId: webClientId ?? "dev-placeholder",
  });

  async function requestDemoSession(): Promise<SessionResponse> {
    const user = await apiRequest<SessionUser>("/auth/me", { token: DEMO_SESSION_TOKEN });
    return {
      access_token: DEMO_SESSION_TOKEN,
      token_type: "bearer",
      user,
    };
  }

  async function persistSession(session: SessionResponse) {
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, session.access_token);
    await SecureStore.setItemAsync(SESSION_USER_KEY, JSON.stringify(session.user));
  }

  useEffect(() => {
    async function loadSession() {
      try {
        if (isExpoGo) {
          setSessionToken(DEMO_SESSION_TOKEN);
          setUser(EXPO_GO_FALLBACK_USER);
          await persistSession({
            access_token: DEMO_SESSION_TOKEN,
            token_type: "bearer",
            user: EXPO_GO_FALLBACK_USER,
          });
          try {
            const session = await requestDemoSession();
            setSessionToken(session.access_token);
            setUser(session.user);
            await persistSession(session);
          } catch {
            // Keep the built-in demo token and fallback identity so Expo Go can still enter the app.
          }
          return;
        }
        const [storedTokenRaw, storedUserJson] = await Promise.all([
          SecureStore.getItemAsync(SESSION_TOKEN_KEY),
          SecureStore.getItemAsync(SESSION_USER_KEY),
        ]);
        let storedToken = storedTokenRaw;
        let storedUser: SessionUser | null = null;
        if (storedUserJson) {
          try {
            storedUser = JSON.parse(storedUserJson) as SessionUser;
          } catch {
            storedUser = null;
          }
        }
        if (storedUser?.email && DEMO_EMAILS.has(storedUser.email)) {
          try {
            const session = await requestDemoSession();
            await persistSession(session);
            storedToken = session.access_token;
            storedUser = session.user;
          } catch {
            // Keep existing session if migration fails.
          }
        }
        if (storedToken) {
          try {
            const verifiedUser = await apiRequest<SessionUser>("/auth/me", { token: storedToken });
            storedUser = verifiedUser;
            await SecureStore.setItemAsync(SESSION_USER_KEY, JSON.stringify(storedUser));
          } catch {
            if (storedUser?.email && DEMO_EMAILS.has(storedUser.email)) {
              try {
                const session = await requestDemoSession();
                await persistSession(session);
                storedToken = session.access_token;
                storedUser = session.user;
              } catch {
                storedToken = null;
                storedUser = null;
                await Promise.all([
                  SecureStore.deleteItemAsync(SESSION_TOKEN_KEY),
                  SecureStore.deleteItemAsync(SESSION_USER_KEY),
                ]);
              }
            } else {
              storedToken = null;
              storedUser = null;
              await Promise.all([
                SecureStore.deleteItemAsync(SESSION_TOKEN_KEY),
                SecureStore.deleteItemAsync(SESSION_USER_KEY),
              ]);
            }
          }
        }
        setSessionToken(storedToken);
        setUser(storedUser);
      } catch {
        await Promise.allSettled([
          SecureStore.deleteItemAsync(SESSION_TOKEN_KEY),
          SecureStore.deleteItemAsync(SESSION_USER_KEY),
        ]);
        setSessionToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    void loadSession();
  }, [isExpoGo]);

  useEffect(() => {
    async function exchangeToken() {
      const idToken = response?.type === "success" ? response.params.id_token : null;
      if (!idToken) {
        return;
      }

      setIsLoading(true);
      try {
        const session = await apiRequest<SessionResponse>("/auth/google", {
          method: "POST",
          body: JSON.stringify({ id_token: idToken }),
        });
        await SecureStore.setItemAsync(SESSION_TOKEN_KEY, session.access_token);
        await SecureStore.setItemAsync(SESSION_USER_KEY, JSON.stringify(session.user));
        setSessionToken(session.access_token);
        setUser(session.user);
      } finally {
        setIsLoading(false);
      }
    }

    void exchangeToken();
  }, [response]);

  const signInWithGoogle = async () => {
    setIsLoading(true);
    try {
      if (!hasGoogleConfig) {
        const session = await apiRequest<SessionResponse>("/auth/dev", {
          method: "POST",
          body: JSON.stringify({ email: "dev@seensnap.local", display_name: "Local Dev" }),
        });
        await SecureStore.setItemAsync(SESSION_TOKEN_KEY, session.access_token);
        await SecureStore.setItemAsync(SESSION_USER_KEY, JSON.stringify(session.user));
        setSessionToken(session.access_token);
        setUser(session.user);
        return;
      }
      await promptAsync();
    } finally {
      setIsLoading(false);
    }
  };

  const signInDemo = async () => {
    setIsLoading(true);
    try {
      const session = await requestDemoSession();
      setSessionToken(session.access_token);
      setUser(session.user);
      await persistSession(session);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(SESSION_TOKEN_KEY),
      SecureStore.deleteItemAsync(SESSION_USER_KEY),
    ]);
    setSessionToken(null);
    setUser(null);
  };

  const refreshSessionUser = async () => {
    if (!sessionToken) {
      return;
    }
    try {
      const nextUser = await apiRequest<SessionUser>("/auth/me", { token: sessionToken });
      await SecureStore.setItemAsync(SESSION_USER_KEY, JSON.stringify(nextUser));
      setUser(nextUser);
    } catch {
      await Promise.all([
        SecureStore.deleteItemAsync(SESSION_TOKEN_KEY),
        SecureStore.deleteItemAsync(SESSION_USER_KEY),
      ]);
      setSessionToken(null);
      setUser(null);
    }
  };

  const updateSessionUser = async (next: Partial<SessionUser>) => {
    setUser((current) => {
      if (!current) {
        return current;
      }
      const merged = { ...current, ...next };
      void SecureStore.setItemAsync(SESSION_USER_KEY, JSON.stringify(merged));
      return merged;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        sessionToken,
        user,
        isExpoGo,
        signInWithGoogle,
        signInDemo,
        signOut,
        refreshSessionUser,
        updateSessionUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
