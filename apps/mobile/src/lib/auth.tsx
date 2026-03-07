import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { useIdTokenAuthRequest } from "expo-auth-session/providers/google";
import { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";

WebBrowser.maybeCompleteAuthSession();

const SESSION_TOKEN_KEY = "session_token";
const EXPO_PROXY_REDIRECT_URI = "https://auth.expo.io/@gregtusar/seensnap";

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

type AuthContextValue = {
  isLoading: boolean;
  sessionToken: string | null;
  user: SessionUser | null;
  isExpoGo: boolean;
  signInWithGoogle: () => Promise<void>;
  signInDemo: () => Promise<void>;
  signOut: () => Promise<void>;
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
  const [request, response, promptAsync] = useIdTokenAuthRequest({
    clientId: isExpoGo ? webClientId : undefined,
    redirectUri: isExpoGo ? EXPO_PROXY_REDIRECT_URI : undefined,
    iosClientId: isExpoGo ? undefined : iosClientId,
    androidClientId: isExpoGo ? undefined : androidClientId,
    webClientId: webClientId,
  });

  useEffect(() => {
    async function loadSession() {
      const storedToken = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
      setSessionToken(storedToken);
      setIsLoading(false);
    }

    void loadSession();
  }, []);

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
      await promptAsync();
    } finally {
      setIsLoading(false);
    }
  };

  const signInDemo = async () => {
    const demoUser = {
      user_id: "00000000-0000-0000-0000-000000000001",
      email: "demo@seensnap.app",
      display_name: "SeenSnap Demo",
      avatar_url: null,
    };
    const demoToken = "expo-go-demo-session";
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, demoToken);
    setSessionToken(demoToken);
    setUser(demoUser);
  };

  const signOut = async () => {
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
    setSessionToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isLoading: isLoading || !request,
        sessionToken,
        user,
        isExpoGo,
        signInWithGoogle,
        signInDemo,
        signOut,
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
