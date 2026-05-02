import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors, radii, spacing } from "@/constants/theme";
import { apiRequest } from "@/lib/api";

type WatchlistSummary = {
  id: string;
  name: string;
  description?: string | null;
  is_default: boolean;
  is_system_list: boolean;
  title_count: number;
};

type Props = {
  visible: boolean;
  token: string | null;
  titleId: string | null;
  source: string;
  onClose: () => void;
  onSaved?: (listName: string, alreadySaved?: boolean) => void;
  onError?: (message: string) => void;
};

export function SaveToListSheet({ visible, token, titleId, source, onClose, onSaved, onError }: Props) {
  const [lists, setLists] = useState<WatchlistSummary[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!visible) {
      setCreating(false);
      setNewName("");
      setNewDescription("");
      setSelectedListId(null);
      return;
    }
  }, [visible]);

  useEffect(() => {
    async function loadLists() {
      if (!visible || !token) {
        return;
      }
      try {
        const data = await apiRequest<WatchlistSummary[]>("/me/watchlist/lists", { token });
        setLists(data);
        setSelectedListId(data[0]?.id ?? null);
      } catch (error) {
        onError?.(error instanceof Error ? error.message : "Failed to load lists");
      }
    }
    void loadLists();
  }, [onError, token, visible]);

  async function saveToList() {
    const selectedList = lists.find((item) => item.id === selectedListId) ?? null;
    if (!token || !titleId || !selectedList || isBusy) {
      return;
    }
    setIsBusy(true);
    try {
      const list = await apiRequest<{ id: string; items: Array<{ content_title_id: string }> }>(
        `/me/watchlist/lists/${selectedList.id}`,
        { token }
      );
      const already = list.items.some((item) => item.content_title_id === titleId);
      await apiRequest("/me/watchlist/items", {
        method: "POST",
        token,
        body: JSON.stringify({
          content_title_id: titleId,
          list_id: selectedList.id,
          added_via: source,
        }),
      });
      onSaved?.(selectedList.name, already);
      onClose();
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsBusy(false);
    }
  }

  async function createListAndSave() {
    if (!token || !titleId || !newName.trim() || isBusy) {
      return;
    }
    setIsBusy(true);
    try {
      const created = await apiRequest<{ id: string; name: string }>("/me/watchlist/lists", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || null,
        }),
      });
      await apiRequest("/me/watchlist/items", {
        method: "POST",
        token,
        body: JSON.stringify({
          content_title_id: titleId,
          list_id: created.id,
          added_via: source,
        }),
      });
      onSaved?.(created.name, false);
      setCreating(false);
      setNewName("");
      setNewDescription("");
      onClose();
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Failed to create list");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Save to a List</Text>
          {!creating ? (
            <View style={styles.listBody}>
              <Text style={styles.subtitle}>Choose where to save this title.</Text>
              <ScrollView contentContainerStyle={styles.listScroller}>
                {lists.map((list) => (
                  <Pressable
                    key={list.id}
                    style={[styles.listRow, selectedListId === list.id && styles.listRowSelected]}
                    onPress={() => setSelectedListId(list.id)}
                  >
                    <View>
                      <Text style={styles.listName}>{list.name}</Text>
                      <Text style={styles.listMeta}>{list.title_count} titles</Text>
                    </View>
                    <Text style={styles.selectLabel}>{selectedListId === list.id ? "Selected" : "Select"}</Text>
                  </Pressable>
                ))}
                {!lists.length ? <Text style={styles.emptyText}>No lists yet. Create one to save this title.</Text> : null}
              </ScrollView>
              <Pressable style={styles.createButton} onPress={() => setCreating(true)}>
                <Text style={styles.createButtonText}>+ Create New List</Text>
              </Pressable>
              <View style={styles.footerActions}>
                <Pressable style={styles.secondary} onPress={onClose}>
                  <Text style={styles.secondaryText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.primary, (!selectedListId || isBusy) && styles.disabled]}
                  disabled={!selectedListId || isBusy}
                  onPress={() => void saveToList()}
                >
                  <Text style={styles.primaryText}>{isBusy ? "Saving..." : "Save"}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.createBody}>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="List name"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <TextInput
                value={newDescription}
                onChangeText={setNewDescription}
                placeholder="Description (optional)"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <View style={styles.createActions}>
                <Pressable style={styles.secondary} onPress={() => setCreating(false)}>
                  <Text style={styles.secondaryText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.primary, (!newName.trim() || isBusy) && styles.disabled]}
                  disabled={!newName.trim() || isBusy}
                  onPress={() => void createListAndSave()}
                >
                  <Text style={styles.primaryText}>Create New List</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(4,9,16,0.72)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
    maxHeight: "86%",
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  listBody: { gap: 8, paddingBottom: spacing.sm },
  listScroller: { gap: 8, paddingBottom: spacing.sm },
  listRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listRowSelected: {
    borderColor: colors.accent,
    backgroundColor: "rgba(244,196,48,0.12)",
  },
  listName: { color: colors.ink, fontWeight: "800", fontSize: 14 },
  listMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  selectLabel: { color: colors.accent, fontWeight: "700", fontSize: 12 },
  emptyText: { color: colors.muted, fontSize: 13, lineHeight: 20, paddingVertical: 6 },
  createButton: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    paddingVertical: 10,
    alignItems: "center",
  },
  createButtonText: { color: colors.ink, fontWeight: "700", fontSize: 13 },
  footerActions: { flexDirection: "row", gap: spacing.sm },
  createBody: { gap: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.backgroundElevated,
    color: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  createActions: { flexDirection: "row", gap: spacing.sm },
  secondary: {
    flex: 1,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  primary: {
    flex: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryText: { color: colors.background, fontSize: 12, fontWeight: "800" },
  disabled: { opacity: 0.5 },
});
