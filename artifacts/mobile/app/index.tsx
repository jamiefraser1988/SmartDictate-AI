import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import NoteCard from "@/components/NoteCard";
import { useNotes, type Note } from "@/context/NotesContext";
import { useColors } from "@/hooks/useColors";

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { notes, deleteNote } = useNotes();

  const handleDelete = (id: string) => {
    Alert.alert("Delete Note", "This note will be permanently deleted.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteNote(id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  };

  const handleNewRecording = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/record");
  };

  const handleCompose = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/compose");
  };

  const topPad =
    Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 16,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            SmartDictate
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
            {notes.length} {notes.length === 1 ? "note" : "notes"}
          </Text>
        </View>
        <View
          style={[
            styles.aiTag,
            { backgroundColor: colors.primary + "20", borderRadius: 8 },
          ]}
        >
          <Feather name="zap" size={12} color={colors.primary} />
          <Text style={[styles.aiTagText, { color: colors.primary }]}>AI</Text>
        </View>
      </View>

      <FlatList<Note>
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: bottomPad + 100 },
        ]}
        scrollEnabled={notes.length > 0}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => (
          <NoteCard note={item} onDelete={handleDelete} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View
              style={[
                styles.emptyIconBg,
                { backgroundColor: colors.muted, borderRadius: colors.radius },
              ]}
            >
              <Feather name="mic" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No notes yet
            </Text>
            <Text
              style={[styles.emptySubtitle, { color: colors.mutedForeground }]}
            >
              Record a voice note or compose text to get started
            </Text>
          </View>
        }
      />

      <View
        style={[
          styles.fabContainer,
          { paddingBottom: bottomPad + 20 },
        ]}
      >
        <TouchableOpacity
          testID="compose-button"
          style={[
            styles.fabSecondary,
            {
              backgroundColor: colors.secondary,
              borderColor: colors.border,
              borderRadius: 32,
            },
          ]}
          onPress={handleCompose}
          activeOpacity={0.85}
        >
          <Feather name="edit-3" size={20} color={colors.foreground} />
          <Text style={[styles.fabSecondaryText, { color: colors.foreground }]}>Compose</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="new-recording-button"
          style={[
            styles.fab,
            {
              backgroundColor: colors.primary,
              borderRadius: 32,
            },
          ]}
          onPress={handleNewRecording}
          activeOpacity={0.85}
        >
          <Feather name="mic" size={22} color="#fff" />
          <Text style={styles.fabText}>Record</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  aiTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  aiTagText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyIconBg: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  fabContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 16,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  fabSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  fabSecondaryText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
