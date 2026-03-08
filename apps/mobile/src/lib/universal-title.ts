import { apiRequest } from "@/lib/api";

export type TitleSeed = {
  id: string;
  title: string;
  content_type?: string;
  poster_url?: string | null;
  backdrop_url?: string | null;
  overview?: string | null;
};

type TitleResponse = {
  id: string;
  content_type: string;
  title: string;
  overview?: string | null;
  poster_url?: string | null;
  backdrop_url?: string | null;
  genres?: string[];
  release_date?: string | null;
  runtime_minutes?: number | null;
  season_count?: number | null;
  episode_count?: number | null;
  tmdb_rating?: number | null;
  language?: string | null;
  country?: string | null;
  creator?: string | null;
  director?: string | null;
  top_cast?: string[];
  wikipedia_url?: string | null;
  metadata_source?: string;
};

export type UniversalTitle = {
  id: string;
  title: string;
  mediaType: "movie" | "tv";
  year: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  description: string;
  genres: string[];
  runtimeMinutes: number | null;
  episodeRuntimeMinutes: number | null;
  seasons: number | null;
  episodes: number | null;
  language: string | null;
  country: string | null;
  ratingTmdb: number | null;
  wikipediaUrl: string | null;
  credits: {
    creator: string[];
    director: string[];
    cast: string[];
  };
  metadataSource: string;
};

function normalizeFromApi(data: TitleResponse): UniversalTitle {
  const mediaType = data.content_type === "movie" ? "movie" : "tv";
  const year = data.release_date ? Number(String(data.release_date).slice(0, 4)) : null;
  return {
    id: data.id,
    title: data.title,
    mediaType,
    year: Number.isFinite(year) ? year : null,
    posterUrl: data.poster_url ?? null,
    backdropUrl: data.backdrop_url ?? data.poster_url ?? null,
    description: data.overview || "Full details are unavailable right now.",
    genres: data.genres ?? [],
    runtimeMinutes: mediaType === "movie" ? data.runtime_minutes ?? null : null,
    episodeRuntimeMinutes: mediaType === "tv" ? data.runtime_minutes ?? null : null,
    seasons: mediaType === "tv" ? data.season_count ?? null : null,
    episodes: mediaType === "tv" ? data.episode_count ?? null : null,
    language: data.language ?? null,
    country: data.country ?? null,
    ratingTmdb: data.tmdb_rating ?? null,
    wikipediaUrl: data.wikipedia_url ?? null,
    credits: {
      creator: data.creator ? [data.creator] : [],
      director: data.director ? [data.director] : [],
      cast: data.top_cast ?? [],
    },
    metadataSource: data.metadata_source ?? "tmdb_fallback",
  };
}

function normalizeFromSeed(seed: TitleSeed): UniversalTitle {
  const mediaType = seed.content_type === "movie" ? "movie" : "tv";
  return {
    id: seed.id,
    title: seed.title,
    mediaType,
    year: null,
    posterUrl: seed.poster_url ?? null,
    backdropUrl: seed.backdrop_url ?? seed.poster_url ?? null,
    description: seed.overview || "Full details are unavailable right now.",
    genres: [],
    runtimeMinutes: null,
    episodeRuntimeMinutes: null,
    seasons: null,
    episodes: null,
    language: null,
    country: null,
    ratingTmdb: null,
    wikipediaUrl: null,
    credits: {
      creator: [],
      director: [],
      cast: [],
    },
    metadataSource: "fallback",
  };
}

export async function fetchUniversalTitle(
  token: string,
  titleId: string,
  seed?: TitleSeed | null
): Promise<UniversalTitle> {
  try {
    const data = await apiRequest<TitleResponse>(`/titles/${titleId}`, { token });
    return normalizeFromApi(data);
  } catch {
    if (seed) {
      return normalizeFromSeed(seed);
    }
    throw new Error("Unable to load title details");
  }
}
