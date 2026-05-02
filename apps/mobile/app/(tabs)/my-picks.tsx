import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { Screen } from "@/components/screen";
import { SaveToListSheet } from "@/components/save-to-list-sheet";
import { UniversalTitleModal } from "@/components/universal-title-modal";
import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { apiRequest, resolvedApiBaseUrl } from "@/lib/api";
import { fetchUniversalTitle, type UniversalTitle } from "@/lib/universal-title";

type WatchlistSummary = {
  id: string;
  name: string;
  description?: string | null;
  is_default: boolean;
  is_system_list: boolean;
  title_count: number;
  updated_at?: string | null;
  preview_posters: string[];
};

type WatchlistItem = {
  id: string;
  content_title_id: string;
  added_via: string;
  created_at: string;
  title: {
    id: string;
    title: string;
    content_type: string;
    overview?: string | null;
    poster_url?: string | null;
    release_date?: string | null;
  };
};

type WatchlistResponse = {
  id: string;
  name: string;
  description?: string | null;
  is_default: boolean;
  is_system_list: boolean;
  items: WatchlistItem[];
};

export default function MyPicksScreen() {
  const { sessionToken } = useAuth();
  const [lists, setLists] = useState<WatchlistSummary[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedList, setSelectedList] = useState<WatchlistResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [listName, setListName] = useState("");
  const [listDescription, setListDescription] = useState("");

  const [showDetails, setShowDetails] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTitle, setDetailTitle] = useState<UniversalTitle | null>(null);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [saveTitleId, setSaveTitleId] = useState<string | null>(null);

  const totals = useMemo(() => {
    const totalTitles = lists.reduce((acc, item) => acc + item.title_count, 0);
    return {
      totalTitles,
      listCount: lists.length,
    };
  }, [lists]);

  const loadLists = useCallback(async () => {
    if (!sessionToken) return;
    const summaries = await apiRequest<WatchlistSummary[]>("/me/watchlist/lists", { token: sessionToken });
    setLists(summaries);
    const nextSelected = selectedListId && summaries.some((item) => item.id === selectedListId) ? selectedListId : summaries[0]?.id ?? null;
    setSelectedListId(nextSelected);
    if (nextSelected) {
      const detail = await apiRequest<WatchlistResponse>(`/me/watchlist/lists/${nextSelected}`, { token: sessionToken });
      setSelectedList(detail);
    } else {
      setSelectedList(null);
    }
  }, [selectedListId, sessionToken]);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        if (!sessionToken) return;
        setIsLoading(true);
        setError(null);
        try {
          await loadLists();
        } catch (loadError) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load My Picks");
        } finally {
          setIsLoading(false);
        }
      }
      void load();
    }, [loadLists, sessionToken])
  );

  async function openList(listId: string) {
    if (!sessionToken) return;
    setSelectedListId(listId);
    try {
      const detail = await apiRequest<WatchlistResponse>(`/me/watchlist/lists/${listId}`, { token: sessionToken });
      setSelectedList(detail);
    } catch (listError) {
      setError(listError instanceof Error ? listError.message : "Failed to load list");
    }
  }

  async function createList() {
    if (!sessionToken || !listName.trim()) return;
    try {
      const created = await apiRequest<WatchlistResponse>("/me/watchlist/lists", {
        method: "POST",
        token: sessionToken,
        body: JSON.stringify({ name: listName.trim(), description: listDescription.trim() || null }),
      });
      setShowCreate(false);
      setListName("");
      setListDescription("");
      setToast(`Created ${created.name}`);
      await loadLists();
      setSelectedListId(created.id);
      setSelectedList(created);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create list");
    }
  }

  async function renameList() {
    if (!sessionToken || !selectedList || !listName.trim()) return;
    try {
      const updated = await apiRequest<WatchlistResponse>(`/me/watchlist/lists/${selectedList.id}`, {
        method: "PATCH",
        token: sessionToken,
        body: JSON.stringify({ name: listName.trim(), description: listDescription.trim() || null }),
      });
      setShowRename(false);
      setToast(`Updated ${updated.name}`);
      await loadLists();
      setSelectedList(updated);
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "Failed to update list");
    }
  }

  async function deleteList() {
    if (!sessionToken || !selectedList || selectedList.is_default) return;
    try {
      await apiRequest<void>(`/me/watchlist/lists/${selectedList.id}`, {
        method: "DELETE",
        token: sessionToken,
      });
      setToast("List deleted");
      await loadLists();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete list");
    }
  }

  async function removeFromList(item: WatchlistItem) {
    if (!sessionToken || !selectedList) return;
    try {
      const updated = await apiRequest<WatchlistResponse>(
        `/me/watchlist/lists/${selectedList.id}/titles/${item.content_title_id}`,
        { method: "DELETE", token: sessionToken }
      );
      setSelectedList(updated);
      await loadLists();
      setToast(`Removed from ${selectedList.name}`);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to remove title");
    }
  }

  async function openDetails(item: WatchlistItem) {
    if (!sessionToken) return;
    setShowDetails(true);
    setDetailLoading(true);
    try {
      const details = await fetchUniversalTitle(sessionToken, item.title.id, item.title);
      setDetailTitle(details);
    } catch (detailError) {
      setDetailTitle(null);
      setError(detailError instanceof Error ? detailError.message : "Failed to load title details");
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <Screen title="My Picks" subtitle="Your saved titles, organized by mood, moment, or obsession.">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summary}>
          <Text style={styles.summaryText}>{totals.totalTitles} saved • {totals.listCount} lists</Text>
          <Text style={styles.summarySub}>Updated today</Text>
        </View>

        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Lists</Text>
          <Pressable style={styles.createButton} onPress={() => {
            setListName("");
            setListDescription("");
            setShowCreate(true);
          }}>
            <Text style={styles.createButtonText}>Create New List</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.listRow}>
          {lists.map((list) => (
            <Pressable
              key={list.id}
              style={[styles.listCard, selectedListId === list.id && styles.listCardActive]}
              onPress={() => void openList(list.id)}
            >
              <Text style={styles.listName}>{list.name}</Text>
              <Text style={styles.listMeta}>{list.title_count} titles</Text>
              {list.description ? <Text style={styles.listDesc} numberOfLines={2}>{list.description}</Text> : null}
              <View style={styles.previewRow}>
                {list.preview_posters.slice(0, 4).map((poster, idx) => (
                  <Image key={poster + idx} source={{ uri: poster }} style={styles.previewPoster} />
                ))}
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>{selectedList?.name ?? "Select a list"}</Text>
          {selectedList ? (
            <View style={styles.actionsRow}>
              <Pressable
                style={styles.iconButton}
                onPress={() => {
                  setListName(selectedList.name);
                  setListDescription(selectedList.description || "");
                  setShowRename(true);
                }}
              >
                <Ionicons name="create-outline" color={colors.ink} size={16} />
              </Pressable>
              {!selectedList.is_default ? (
                <Pressable
                  style={styles.iconButton}
                  onPress={() =>
                    Alert.alert(
                      "Delete this list?",
                      "Titles will only be removed from this list, not from your other saved lists.",
                      [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => void deleteList() },
                      ]
                    )
                  }
                >
                  <Ionicons name="trash-outline" color={colors.danger} size={16} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        {isLoading ? <ActivityIndicator color={colors.accent} /> : null}
        {error ? <Text style={styles.error}>{error} ({resolvedApiBaseUrl})</Text> : null}
        {!isLoading && selectedList && selectedList.items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptyBody}>Save titles from Home, the Social Feed, Watch Teams, or Discover to fill this list.</Text>
          </View>
        ) : null}

        <View style={styles.grid}>
          {selectedList?.items.map((item) => (
            <View key={item.id} style={styles.posterCard}>
              <Pressable onPress={() => void openDetails(item)}>
                {item.title.poster_url ? (
                  <Image source={{ uri: item.title.poster_url }} style={styles.poster} />
                ) : (
                  <View style={styles.posterFallback}><Ionicons name="film" size={18} color={colors.muted} /></View>
                )}
              </Pressable>
              <Text numberOfLines={1} style={styles.title}>{item.title.title}</Text>
              <Text style={styles.meta}>{item.title.content_type}</Text>
              <Pressable style={styles.removeButton} onPress={() => void removeFromList(item)}>
                <Text style={styles.removeButtonLabel}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>

      <ListEditorModal
        visible={showCreate}
        title="Create New List"
        confirmLabel="Create New List"
        name={listName}
        description={listDescription}
        onChangeName={setListName}
        onChangeDescription={setListDescription}
        onCancel={() => setShowCreate(false)}
        onConfirm={() => void createList()}
      />

      <ListEditorModal
        visible={showRename}
        title="Edit List"
        confirmLabel="Save Changes"
        name={listName}
        description={listDescription}
        onChangeName={setListName}
        onChangeDescription={setListDescription}
        onCancel={() => setShowRename(false)}
        onConfirm={() => void renameList()}
      />

      <UniversalTitleModal
        visible={showDetails}
        loading={detailLoading}
        title={detailTitle}
        onClose={() => setShowDetails(false)}
        onSaveTitle={(detail) => {
          setSaveTitleId(detail.id);
          setShowSaveSheet(true);
        }}
        onPost={() => setShowDetails(false)}
      />

      <SaveToListSheet
        visible={showSaveSheet}
        token={sessionToken}
        titleId={saveTitleId}
        source="my_picks"
        onClose={() => {
          setShowSaveSheet(false);
          setSaveTitleId(null);
        }}
        onSaved={(listName, alreadySaved) => {
          void loadLists();
          setToast(alreadySaved ? `Already in ${listName}` : `Saved to ${listName}`);
        }}
        onError={(message) => setError(message)}
      />

      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </Screen>
  );
}

function ListEditorModal({
  visible,
  title,
  confirmLabel,
  name,
  description,
  onChangeName,
  onChangeDescription,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  confirmLabel: string;
  name: string;
  description: string;
  onChangeName: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.modalBackdrop} onPress={onCancel} />
      <View style={styles.modalSheet}>
        <Text style={styles.modalTitle}>{title}</Text>
        <TextInput value={name} onChangeText={onChangeName} placeholder="List name" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={description} onChangeText={onChangeDescription} placeholder="Description (optional)" placeholderTextColor={colors.muted} style={styles.input} />
        <View style={styles.modalActions}>
          <Pressable style={styles.modalCancel} onPress={onCancel}><Text style={styles.modalCancelText}>Cancel</Text></Pressable>
          <Pressable style={[styles.modalConfirm, !name.trim() && styles.modalConfirmDisabled]} onPress={onConfirm} disabled={!name.trim()}>
            <Text style={styles.modalConfirmText}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  summary: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface, padding: spacing.md },
  summaryText: { color: colors.ink, fontWeight: "800", fontSize: 14 },
  summarySub: { color: colors.muted, marginTop: 4, fontSize: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  createButton: { borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8 },
  createButtonText: { color: colors.accent, fontSize: 12, fontWeight: "800" },
  listRow: { gap: spacing.sm, paddingRight: spacing.lg },
  listCard: { width: 220, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: 4 },
  listCardActive: { borderColor: colors.accent },
  listName: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  listMeta: { color: colors.muted, fontSize: 12 },
  listDesc: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  previewRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  previewPoster: { width: 32, height: 44, borderRadius: 6, backgroundColor: colors.backgroundElevated },
  actionsRow: { flexDirection: "row", gap: 8 },
  iconButton: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  empty: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface, padding: spacing.lg },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  emptyBody: { color: colors.muted, marginTop: 4, lineHeight: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  posterCard: { width: "48%", borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, padding: 8 },
  poster: { width: "100%", height: 190, borderRadius: 10, backgroundColor: colors.backgroundElevated },
  posterFallback: { width: "100%", height: 190, borderRadius: 10, backgroundColor: colors.backgroundElevated, alignItems: "center", justifyContent: "center" },
  title: { color: colors.ink, marginTop: 8, fontSize: 13, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  removeButton: { borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundElevated, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, marginTop: 8 },
  removeButtonLabel: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  error: { color: colors.danger },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5,10,16,0.72)" },
  modalSheet: { marginTop: "auto", borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.sm },
  modalTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.backgroundElevated, color: colors.ink, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  modalActions: { flexDirection: "row", gap: spacing.sm },
  modalCancel: { flex: 1, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundElevated, alignItems: "center", paddingVertical: 10 },
  modalCancelText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  modalConfirm: { flex: 1, borderRadius: radii.pill, backgroundColor: colors.accent, alignItems: "center", paddingVertical: 10 },
  modalConfirmDisabled: { opacity: 0.45 },
  modalConfirmText: { color: colors.background, fontSize: 12, fontWeight: "800" },
  toast: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.xl, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", paddingVertical: 10 },
  toastText: { color: colors.success, fontWeight: "800", fontSize: 12 },
});
