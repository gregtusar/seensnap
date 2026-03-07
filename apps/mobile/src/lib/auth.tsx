import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { useIdTokenAuthRequest } from "expo-auth-session/providers/google";
import { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";

WebBrowser.maybeCompleteAuthSession();

const SESSION_TOKEN_KEY = "session_token";

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
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [request, response, promptAsync] = useIdTokenAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
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
        signInWithGoogle,
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
