import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";

import { SaveToListSheet } from "@/components/save-to-list-sheet";
import { colors, radii, spacing } from "@/constants/theme";
import { apiRequest, resolveMediaUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/lib/auth";
import {
  getStreamingServiceMeta,
  type StreamingAvailability,
  type StreamingServiceMeta,
} from "@/lib/streaming";
import { fetchUniversalTitle, type UniversalTitle } from "@/lib/universal-title";

type Props = {
  visible: boolean;
  loading: boolean;
  title: UniversalTitle | null;
  isSaved?: boolean;
  onClose: () => void;
  onSaveTitle?: ((title: UniversalTitle) => void) | null;
  onSave?: () => void;
  onPost: (title: UniversalTitle) => void;
  onAddToTeam?: ((title: UniversalTitle) => void) | null;
};

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const HERO_HEIGHT = Math.min(460, Math.max(360, screenHeight * 0.48));

export function UniversalTitleModal({
  visible,
  loading,
  title,
  isSaved = false,
  onClose,
  onSaveTitle,
  onSave,
  onPost,
  onAddToTeam,
}: Props) {
  const { sessionToken, user } = useAuth();
  const [preferredServices, setPreferredServices] = useState<string[]>([]);
  const [expandedDescription, setExpandedDescription] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [rendered, setRendered] = useState(visible);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [activeTitle, setActiveTitle] = useState<UniversalTitle | null>(title);
  const [internalLoading, setInternalLoading] = useState(false);
  const [savedState, setSavedState] = useState(isSaved);
  const [savedTitleIds, setSavedTitleIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const heroScrollRef = useRef<ScrollView | null>(null);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(screenHeight)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(22)).current;
  const actionsOpacity = useRef(new Animated.Value(0)).current;
  const actionsTranslateY = useRef(new Animated.Value(26)).current;
  const saveScale = useRef(new Animated.Value(1)).current;
  const toastTranslateY = useRef(new Animated.Value(30)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setActiveTitle(title);
    setExpandedDescription(false);
    setActiveImageIndex(0);
  }, [title]);

  useEffect(() => {
    setSavedState(Boolean(activeTitle?.id && savedTitleIds.has(activeTitle.id)) || isSaved);
  }, [activeTitle?.id, isSaved, savedTitleIds]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    toastOpacity.setValue(0);
    toastTranslateY.setValue(24);
    Animated.parallel([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(toastTranslateY, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(toastTranslateY, { toValue: 24, duration: 180, useNativeDriver: true }),
      ]).start(() => setToast(null));
    }, 1800);
    return () => clearTimeout(timeout);
  }, [toast, toastOpacity, toastTranslateY]);

  useEffect(() => {
    let isMounted = true;

    async function loadPreferences() {
      if (!sessionToken || !visible) {
        if (isMounted) {
          setPreferredServices([]);
        }
        return;
      }
      try {
        const preferences = await apiRequest<{ connected_streaming_services: string[] }>("/me/preferences", {
          token: sessionToken,
        });
        if (isMounted) {
          setPreferredServices(preferences.connected_streaming_services ?? []);
        }
      } catch {
        if (isMounted) {
          setPreferredServices([]);
        }
      }
    }

    void loadPreferences();
    return () => {
      isMounted = false;
    };
  }, [sessionToken, visible]);

  useEffect(() => {
    let isMounted = true;

    async function loadSavedTitles() {
      if (!sessionToken || !visible) {
        return;
      }
      try {
        const ids = await apiRequest<string[]>("/me/watchlist/title-ids", { token: sessionToken });
        if (isMounted) {
          setSavedTitleIds(new Set(ids));
        }
      } catch {
        if (isMounted) {
          setSavedTitleIds(new Set());
        }
      }
    }

    void loadSavedTitles();
    return () => {
      isMounted = false;
    };
  }, [sessionToken, visible]);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      overlayOpacity.setValue(0);
      sheetTranslateY.setValue(screenHeight);
      heroOpacity.setValue(0);
      contentOpacity.setValue(0);
      contentTranslateY.setValue(22);
      actionsOpacity.setValue(0);
      actionsTranslateY.setValue(26);

      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          damping: 20,
          mass: 0.95,
          stiffness: 170,
          useNativeDriver: true,
        }),
      ]).start(() => {
        Animated.sequence([
          Animated.timing(heroOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(contentOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
            Animated.timing(contentTranslateY, { toValue: 0, duration: 260, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(actionsOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
            Animated.timing(actionsTranslateY, { toValue: 0, duration: 220, useNativeDriver: true }),
          ]),
        ]).start();
      });
      return;
    }

    Animated.parallel([
      Animated.timing(actionsOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(contentOpacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(heroOpacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: screenHeight, duration: 240, useNativeDriver: true }),
    ]).start(() => setRendered(false));
  }, [
    actionsOpacity,
    actionsTranslateY,
    contentOpacity,
    contentTranslateY,
    heroOpacity,
    overlayOpacity,
    sheetTranslateY,
    visible,
  ]);

  const currentTitle = activeTitle;
  const isBusy = loading || internalLoading;

  const galleryImages = useMemo(() => {
    const entries = currentTitle?.imageGallery ?? [];
    const deduped = entries.reduce<Array<{ url: string; kind: string }>>((acc, item) => {
      const resolved = resolveMediaUrl(item.url);
      if (!resolved || acc.some((entry) => entry.url === resolved)) {
        return acc;
      }
      acc.push({ url: resolved, kind: item.kind });
      return acc;
    }, []);
    if (!deduped.length) {
      const fallback = [
        currentTitle?.backdropUrl ? { url: resolveMediaUrl(currentTitle.backdropUrl), kind: "backdrop" } : null,
        currentTitle?.posterUrl ? { url: resolveMediaUrl(currentTitle.posterUrl), kind: "poster" } : null,
      ].filter((entry): entry is { url: string; kind: string } => Boolean(entry?.url));
      return fallback;
    }
    return deduped;
  }, [currentTitle?.backdropUrl, currentTitle?.imageGallery, currentTitle?.posterUrl]);

  const posterImage = resolveMediaUrl(currentTitle?.posterUrl ?? null);

  const metadataChips = useMemo(() => {
    const entries: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string }> = [];
    if (typeof currentTitle?.ratingTmdb === "number") {
      entries.push({ icon: "star", label: `${currentTitle.ratingTmdb.toFixed(1)} TMDB` });
    }
    if (currentTitle?.mediaType === "movie" && typeof currentTitle.runtimeMinutes === "number") {
      entries.push({ icon: "time", label: `${currentTitle.runtimeMinutes}m` });
    }
    if (currentTitle?.mediaType === "tv" && typeof currentTitle.seasons === "number") {
      entries.push({ icon: "tv", label: `${currentTitle.seasons} Seasons` });
    }
    if (currentTitle?.genres?.length) {
      entries.push({ icon: "pricetag", label: currentTitle.genres.slice(0, 3).join(", ") });
    }
    if (currentTitle?.language) {
      entries.push({ icon: "globe-outline", label: currentTitle.language });
    }
    return entries;
  }, [
    currentTitle?.genres,
    currentTitle?.language,
    currentTitle?.mediaType,
    currentTitle?.ratingTmdb,
    currentTitle?.runtimeMinutes,
    currentTitle?.seasons,
  ]);

  const sortedStreamingOptions = useMemo(() => {
    const entries = currentTitle?.streamingAvailability ?? [];
    return [...entries].sort((left, right) => {
      const leftPriority = preferredServices.includes(left.service) ? 0 : 1;
      const rightPriority = preferredServices.includes(right.service) ? 0 : 1;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      return left.serviceName.localeCompare(right.serviceName);
    });
  }, [currentTitle?.streamingAvailability, preferredServices]);

  const matchingStreamingOptions = sortedStreamingOptions.filter((entry) =>
    preferredServices.includes(entry.service)
  );
  const primaryStreamingOption = matchingStreamingOptions.length === 1 ? matchingStreamingOptions[0] : null;
  const hasLongDescription = Boolean((currentTitle?.description ?? "").length > 220);

  function handleImageScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / Math.max(screenWidth, 1));
    if (nextIndex !== activeImageIndex) {
      setActiveImageIndex(nextIndex);
    }
  }

  async function openStreamingOption(service: { service: string; serviceName: string; appUrl?: string | null; webUrl?: string | null }) {
    const appUrl = service.appUrl?.trim() || null;
    const webUrl = service.webUrl?.trim() || null;
    if (appUrl) {
      const supported = await Linking.canOpenURL(appUrl).catch(() => false);
      if (supported) {
        await Linking.openURL(appUrl);
        trackEvent("stream_now_clicked", {
          titleId: currentTitle?.id ?? null,
          service: service.service,
          userId: user?.user_id ?? null,
          destination: "app",
        });
        return;
      }
    }
    if (webUrl) {
      await Linking.openURL(webUrl);
      trackEvent("stream_now_clicked", {
        titleId: currentTitle?.id ?? null,
        service: service.service,
        userId: user?.user_id ?? null,
        destination: "web",
      });
    }
  }

  function openSaveFlow() {
    if (!sessionToken || !currentTitle?.id) {
      setToast("Sign in to save titles");
      return;
    }
    Animated.sequence([
      Animated.timing(saveScale, { toValue: 1.08, duration: 120, useNativeDriver: true }),
      Animated.spring(saveScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    if (currentTitle && onSaveTitle) {
      onSaveTitle(currentTitle);
      onSave?.();
      return;
    }
    setShowSaveSheet(true);
    onSave?.();
  }

  async function openRelatedTitle(titleId: string) {
    if (!sessionToken || !titleId || currentTitle?.id === titleId) {
      return;
    }
    setInternalLoading(true);
    setExpandedDescription(false);
    setActiveImageIndex(0);
    try {
      const nextTitle = await fetchUniversalTitle(sessionToken, titleId);
      setActiveTitle(nextTitle);
      heroScrollRef.current?.scrollTo({ x: 0, animated: false });
    } catch {
      setToast("Unable to open title");
    } finally {
      setInternalLoading(false);
    }
  }

  if (!rendered) {
    return null;
  }

  return (
    <>
      <Modal transparent animationType="none" visible={rendered} onRequestClose={onClose} statusBarTranslucent>
        <View style={styles.root}>
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

          <Animated.View style={[styles.shell, { transform: [{ translateY: sheetTranslateY }] }]}>
            <View style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>

            <Pressable style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={18} color={colors.ink} />
            </Pressable>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <Animated.View style={[styles.heroCard, { opacity: heroOpacity }]}>
                <ScrollView
                  ref={heroScrollRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={handleImageScroll}
                  scrollEventThrottle={16}
                >
                  {(galleryImages.length ? galleryImages : [{ url: "", kind: "backdrop" }]).map((image, index) => (
                    <View key={`${image.url}-${index}`} style={styles.heroSlide}>
                      {image.url ? <Image source={{ uri: image.url }} style={styles.heroImage} resizeMode="cover" /> : <View style={styles.heroFallback} />}
                      <View style={styles.heroShadeStrong} />
                      <View style={styles.heroShadeSoft} />
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.heroContent}>
                  <View style={styles.heroTopRow}>
                    <View />
                    {galleryImages.length > 1 ? (
                      <Text style={styles.galleryCount}>{activeImageIndex + 1}/{galleryImages.length}</Text>
                    ) : null}
                  </View>

                  <View style={styles.heroBottomRow}>
                    <View style={styles.posterWrap}>
                      {posterImage ? (
                        <Image source={{ uri: posterImage }} style={styles.poster} resizeMode="cover" />
                      ) : (
                        <View style={styles.posterFallback}>
                          <Ionicons name="film-outline" size={28} color={colors.ink} />
                        </View>
                      )}
                    </View>

                    <View style={styles.heroCopy}>
                      <Text style={styles.title}>{currentTitle?.title ?? "Title"}</Text>
                      <Text style={styles.subtitle}>
                        {currentTitle?.year ?? "Unknown"} • {currentTitle?.mediaType === "movie" ? "Movie" : "TV Series"}
                      </Text>
                      <View style={styles.paginationRow}>
                        {galleryImages.slice(0, 8).map((image, index) => (
                          <View key={`${image.url}-dot`} style={[styles.paginationDot, index === activeImageIndex && styles.paginationDotActive]} />
                        ))}
                      </View>
                    </View>
                  </View>
                </View>
              </Animated.View>

              <Animated.View style={[styles.bodyWrap, { opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] }]}>
                <View style={styles.section}>
                  <View style={styles.metaWrap}>
                    {metadataChips.map((item) => (
                      <View key={`${item.icon}-${item.label}`} style={styles.metaChip}>
                        <Ionicons name={item.icon} size={13} color={colors.accent} />
                        <Text style={styles.metaChipText}>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Overview</Text>
                  <Text style={styles.description} numberOfLines={expandedDescription ? undefined : 5}>
                    {currentTitle?.description ?? "Full details are unavailable right now."}
                  </Text>
                  {hasLongDescription ? (
                    <Pressable onPress={() => setExpandedDescription((current) => !current)} style={styles.readMore}>
                      <Text style={styles.readMoreText}>{expandedDescription ? "Show less" : "Read more"}</Text>
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Cast & Creators</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleRail}>
                    {[...(currentTitle?.creators ?? []).slice(0, 3), ...(currentTitle?.cast ?? []).slice(0, 5)].map((person, index) => (
                      <PersonCard key={`${person.name}-${person.role}-${index}`} name={person.name} role={person.role} headshotUrl={person.headshotUrl} />
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Where to Watch</Text>
                  {primaryStreamingOption ? (
                    <Pressable
                      style={[styles.streamCta, { backgroundColor: getStreamingServiceMeta(primaryStreamingOption.service)?.color ?? colors.accent }]}
                      onPress={() => void openStreamingOption(primaryStreamingOption)}
                    >
                      <Text style={styles.streamCtaLabel}>Stream Now on {primaryStreamingOption.serviceName}</Text>
                      <Ionicons name="play" size={16} color="#fff" />
                    </Pressable>
                  ) : null}
                  {sortedStreamingOptions.length ? (
                    <>
                      {!primaryStreamingOption ? (
                        <Text style={styles.watchLabel}>{matchingStreamingOptions.length > 1 ? "Watch On" : "Available On"}</Text>
                      ) : null}
                      <View style={styles.streamingList}>
                        {sortedStreamingOptions.map((service) => {
                          const meta = getStreamingServiceMeta(service.service);
                          const subscribed = preferredServices.includes(service.service);
                          return (
                            <ProviderRow
                              key={`${service.service}-${service.webUrl}-${service.appUrl}`}
                              service={service}
                              subscribed={subscribed}
                              meta={meta}
                              onPress={() => void openStreamingOption(service)}
                            />
                          );
                        })}
                      </View>
                    </>
                  ) : (
                    <Text style={styles.emptyText}>Not currently available for streaming.</Text>
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>More Like This</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedRail}>
                    {(currentTitle?.relatedTitles ?? []).map((related) => (
                      <Pressable key={related.id} style={styles.relatedCard} onPress={() => void openRelatedTitle(related.id)}>
                        {related.posterUrl ? (
                          <Image source={{ uri: resolveMediaUrl(related.posterUrl) ?? related.posterUrl }} style={styles.relatedPoster} />
                        ) : (
                          <View style={styles.relatedPosterFallback}>
                            <Ionicons name="film" size={18} color={colors.muted} />
                          </View>
                        )}
                        <Text style={styles.relatedTitle} numberOfLines={2}>{related.title}</Text>
                        <Text style={styles.relatedMeta}>
                          {[related.year ?? "—", related.mediaType === "movie" ? "Movie" : "TV"].join(" • ")}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </Animated.View>
            </ScrollView>

            <Animated.View style={[styles.actionTray, { opacity: actionsOpacity, transform: [{ translateY: actionsTranslateY }] }]}>
              <Animated.View style={{ transform: [{ scale: saveScale }] }}>
                <ActionCard
                  icon={savedState ? "checkmark" : "star"}
                  title={savedState ? "Saved" : "Save to My Picks"}
                  subtitle={savedState ? "Saved to one of your lists." : "Choose a list and save it instantly."}
                  accent="#f4c430"
                  onPress={openSaveFlow}
                  highlighted
                />
              </Animated.View>
              <ActionCard
                icon="paper-plane"
                title="Post to Social Feed"
                subtitle="Open composer with this title attached."
                accent="#5fa8ff"
                onPress={() => currentTitle && onPost(currentTitle)}
              />
              {onAddToTeam ? (
                <ActionCard
                  icon="people"
                  title="Add to Watch Team"
                  subtitle="Pick a team and add it to the conversation."
                  accent="#2ec4b6"
                  onPress={() => currentTitle && onAddToTeam(currentTitle)}
                />
              ) : null}
            </Animated.View>

            {toast ? (
              <Animated.View style={[styles.toast, { opacity: toastOpacity, transform: [{ translateY: toastTranslateY }] }]}>
                <Text style={styles.toastText}>{toast}</Text>
              </Animated.View>
            ) : null}
          </Animated.View>
        </View>
      </Modal>

      <SaveToListSheet
        visible={showSaveSheet}
        token={sessionToken}
        titleId={currentTitle?.id ?? null}
        source="details"
        onClose={() => setShowSaveSheet(false)}
        onSaved={(listName, alreadySaved) => {
          if (currentTitle?.id) {
            setSavedTitleIds((current) => new Set(current).add(currentTitle.id));
          }
          setToast(alreadySaved ? `Already in ${listName}` : `Saved to ${listName}`);
        }}
        onError={(message) => setToast(message)}
      />
    </>
  );
}

function ActionCard({
  icon,
  title,
  subtitle,
  accent,
  onPress,
  highlighted = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  accent: string;
  onPress: () => void;
  highlighted?: boolean;
}) {
  return (
    <Pressable style={[styles.actionCard, highlighted && styles.actionCardHighlighted]} onPress={onPress}>
      <View style={[styles.actionIconWrap, { backgroundColor: accent }]}>
        <Ionicons name={icon} size={17} color="#fff" />
      </View>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

function ProviderRow({
  service,
  subscribed,
  meta,
  onPress,
}: {
  service: StreamingAvailability;
  subscribed: boolean;
  meta: StreamingServiceMeta | null;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.providerRow, subscribed && styles.providerRowSubscribed]} onPress={onPress}>
      <View style={styles.providerRowLeft}>
        <View
          style={[
            styles.providerLogoBadge,
            { backgroundColor: meta?.color ?? colors.accentSoft, borderColor: meta?.color ?? colors.accentSoft },
          ]}
        >
          <Text style={[styles.providerLogoText, { color: meta?.textColor ?? "#fff" }]} numberOfLines={1}>
            {meta?.logoText ?? service.serviceName}
          </Text>
        </View>
        <View style={styles.providerCopy}>
          <Text style={styles.providerName}>{meta?.name ?? service.serviceName}</Text>
          <Text style={styles.providerHint}>{subscribed ? "Included in your subscriptions" : "Available to stream"}</Text>
        </View>
      </View>
      <View style={styles.providerCta}>
        <Text style={styles.providerCtaText}>Stream Now</Text>
      </View>
    </Pressable>
  );
}

function PersonCard({
  name,
  role,
  headshotUrl,
}: {
  name: string;
  role: string;
  headshotUrl: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const resolved = resolveMediaUrl(headshotUrl) ?? headshotUrl;
  const showImage = Boolean(resolved && !failed);

  return (
    <View style={styles.personCard}>
      <View style={styles.personImageWrap}>
        {showImage ? (
          <Image
            source={{ uri: resolved ?? undefined }}
            style={[styles.personHeadshot, !loaded && styles.personHeadshotHidden]}
            onError={() => setFailed(true)}
            onLoad={() => setLoaded(true)}
          />
        ) : null}
        {!showImage || !loaded ? (
          <View style={styles.personFallback}>
            <Ionicons name="person" size={22} color={colors.ink} />
          </View>
        ) : null}
      </View>
      <Text style={styles.personName} numberOfLines={1}>{name}</Text>
      <Text style={styles.personRole} numberOfLines={2}>{role}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(4, 10, 18, 0.78)" },
  shell: {
    height: screenHeight,
    backgroundColor: colors.background,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  handleWrap: { position: "absolute", top: 10, width: "100%", alignItems: "center", zIndex: 30 },
  handle: { width: 44, height: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.25)" },
  closeButton: {
    position: "absolute",
    top: 18,
    right: 16,
    zIndex: 40,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(6, 16, 29, 0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 240 },
  heroCard: { height: HERO_HEIGHT, backgroundColor: colors.surfaceMuted },
  heroSlide: { width: screenWidth, height: HERO_HEIGHT, backgroundColor: colors.surfaceMuted },
  heroImage: { width: "100%", height: "100%" },
  heroFallback: { width: "100%", height: "100%", backgroundColor: colors.surfaceMuted },
  heroShadeStrong: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5, 11, 20, 0.18)" },
  heroShadeSoft: { position: "absolute", left: 0, right: 0, bottom: 0, height: 220, backgroundColor: "rgba(11,20,36,0.72)" },
  heroContent: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    paddingTop: 54,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    justifyContent: "space-between",
  },
  heroTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  galleryCount: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: "rgba(6,16,29,0.52)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroBottomRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.md },
  posterWrap: {
    borderRadius: 20,
    padding: 4,
    backgroundColor: "rgba(7, 15, 28, 0.52)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  poster: { width: 112, height: 168, borderRadius: 16, backgroundColor: colors.surface },
  posterFallback: { width: 112, height: 168, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  heroCopy: { flex: 1, gap: spacing.sm, paddingBottom: 8 },
  title: { color: colors.ink, fontSize: 32, lineHeight: 38, fontWeight: "900" },
  subtitle: { color: "rgba(242,244,248,0.9)", fontSize: 15, fontWeight: "700" },
  paginationRow: { flexDirection: "row", gap: 6, marginTop: 2 },
  paginationDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.24)" },
  paginationDotActive: { width: 20, backgroundColor: colors.accent },
  bodyWrap: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  section: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(20, 37, 58, 0.72)",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  metaWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(7, 15, 28, 0.42)",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  metaChipText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  description: { color: colors.ink, fontSize: 15, lineHeight: 24 },
  readMore: { alignSelf: "flex-start", paddingTop: 2 },
  readMoreText: { color: colors.accent, fontSize: 13, fontWeight: "800" },
  peopleRail: { gap: spacing.sm, paddingRight: spacing.lg },
  personCard: {
    width: 118,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(7, 15, 28, 0.42)",
    padding: spacing.sm,
    gap: spacing.sm,
  },
  personImageWrap: { width: "100%", height: 128 },
  personHeadshot: { width: "100%", height: 128, borderRadius: 16, backgroundColor: colors.surfaceMuted },
  personHeadshotHidden: { opacity: 0 },
  personFallback: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  personName: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  personRole: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  streamCta: {
    borderRadius: 22,
    paddingHorizontal: spacing.lg,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  streamCtaLabel: { color: "#fff", fontSize: 15, fontWeight: "900" },
  watchLabel: { color: colors.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase" },
  streamingList: { gap: spacing.sm },
  providerRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(7, 15, 28, 0.42)",
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  providerRowSubscribed: { borderColor: colors.success, backgroundColor: "rgba(46,196,182,0.08)" },
  providerRowLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: spacing.sm },
  providerLogoBadge: {
    minWidth: 68,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  providerLogoText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.2 },
  providerCopy: { flex: 1, gap: 2 },
  subscribedPill: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: "rgba(46,196,182,0.16)" },
  subscribedPillText: { color: colors.success, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
  providerName: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  providerHint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  providerCta: {
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginLeft: spacing.sm,
  },
  providerCtaText: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  relatedRail: { gap: spacing.sm, paddingRight: spacing.lg },
  relatedCard: {
    width: 132,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(7, 15, 28, 0.42)",
    padding: spacing.sm,
    gap: 8,
  },
  relatedPoster: { width: "100%", height: 180, borderRadius: 14, backgroundColor: colors.surfaceMuted },
  relatedPosterFallback: { width: "100%", height: 180, borderRadius: 14, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  relatedTitle: { color: colors.ink, fontSize: 13, fontWeight: "800", lineHeight: 18 },
  relatedMeta: { color: colors.muted, fontSize: 11 },
  actionTray: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    backgroundColor: "rgba(11,20,36,0.94)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  actionCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(20, 37, 58, 0.88)",
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  actionCardHighlighted: {},
  actionIconWrap: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  actionCopy: { flex: 1, gap: 2 },
  actionTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  actionSubtitle: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 206,
    borderRadius: 18,
    backgroundColor: "rgba(15, 31, 49, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  toastText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
});
