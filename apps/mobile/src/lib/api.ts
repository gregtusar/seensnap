import Constants from "expo-constants";

function resolveApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configured && !configured.includes("127.0.0.1") && !configured.includes("localhost")) {
    return configured;
  }

  const expoManifest = Constants as typeof Constants & {
    manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
  };
  const hostUri = Constants.expoConfig?.hostUri ?? expoManifest.manifest2?.extra?.expoClient?.hostUri;
  const host = hostUri?.split(":")[0];
  if (host) {
    return `http://${host}:8000/api/v1`;
  }

  return configured ?? "http://127.0.0.1:8000/api/v1";
}

const apiBaseUrl = resolveApiBaseUrl();

type ApiRequestOptions = RequestInit & {
  token?: string | null;
};

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
