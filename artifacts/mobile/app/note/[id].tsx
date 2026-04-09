import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FormatSelector, { formatLabel } from "@/components/FormatSelector";
import ToneSelector, { toneLabel } from "@/components/ToneSelector";
import { useNotes, type OutputFormat, type Tone } from "@/context/NotesContext";
import { useColors } from "@/hooks/useColors";
import { processText } from "@/services/process";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function NoteDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getNoteById, deleteNote, updateNote } = useNotes();
  const note = getNoteById(id ?? "");
  const [copied, setCopied] = useState<"none" | "transcript" | "output">("none");
  const [showReprocess, setShowReprocess] = useState(false);
  const [reprocessFormat, setReprocessFormat] = useState<OutputFormat>("transcript");
  const [reprocessTone, setReprocessTone] = useState<Tone>(note?.tone ?? "formal");
  const [isReprocessing, setIsReprocessing] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (!note) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingTop: topPad + 16,
            paddingBottom: bottomPad,
          },
        ]}
      >
        <View style={styles.navRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="arrow-left" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <View style={styles.notFound}>
          <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>
            Note not found
          </Text>
        </View>
      </View>
    );
  }

  const handleCopyTranscript = async () => {
    await Clipboard.setStringAsync(note.transcript);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCopied("transcript");
    setTimeout(() => setCopied("none"), 2000);
  };

  const handleCopyOutput = async () => {
    const text = note.processedOutput || note.summary || "";
    if (!text) return;
    await Clipboard.setStringAsync(text);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCopied("output");
    setTimeout(() => setCopied("none"), 2000);
  };

  const handleDelete = () => {
    Alert.alert("Delete Note", "This note will be permanently deleted.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteNote(note.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          router.replace("/");
        },
      },
    ]);
  };

  const handleReprocess = async () => {
    if (!note.transcript.trim()) return;
    setIsReprocessing(true);
    try {
      const result = await processText(note.transcript, reprocessFormat, reprocessTone);
      await updateNote(note.id, {
        outputFormat: reprocessFormat,
        processedOutput: result.result,
        tone: reprocessTone,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowReprocess(false);
    } catch {
      Alert.alert("Error", "Failed to reprocess. Please try again.");
    } finally {
      setIsReprocessing(false);
    }
  };

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.navRow,
          {
            paddingTop: topPad + 16,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          testID="back-button"
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>

        <View style={styles.navActions}>
          <TouchableOpacity
            onPress={() => setShowReprocess(!showReprocess)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather
              name="refresh-cw"
              size={20}
              color={showReprocess ? colors.primary : colors.foreground}
            />
          </TouchableOpacity>
          <TouchableOpacity
            testID="delete-button"
            onPress={handleDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="trash-2" size={20} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomPad + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Feather
              name={note.duration > 0 ? "mic" : "edit-3"}
              size={12}
              color={colors.primary}
            />
            {note.duration > 0 ? (
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {formatDuration(note.duration)}
              </Text>
            ) : null}
          </View>
          {note.duration > 0 ? (
            <Text style={[styles.metaDot, { color: colors.mutedForeground }]}>
              ·
            </Text>
          ) : null}
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {formatDate(note.createdAt)}
          </Text>
          {note.outputFormat ? (
            <>
              <Text style={[styles.metaDot, { color: colors.mutedForeground }]}>·</Text>
              <View
                style={[
                  styles.formatBadge,
                  { backgroundColor: colors.accent + "20", borderRadius: 4 },
                ]}
              >
                <Text style={[styles.formatBadgeText, { color: colors.accent }]}>
                  {formatLabel(note.outputFormat)}
                </Text>
              </View>
            </>
          ) : null}
          {note.tone ? (
            <>
              <Text style={[styles.metaDot, { color: colors.mutedForeground }]}>·</Text>
              <View
                style={[
                  styles.formatBadge,
                  { backgroundColor: colors.primary + "20", borderRadius: 4 },
                ]}
              >
                <Text style={[styles.formatBadgeText, { color: colors.primary }]}>
                  {toneLabel(note.tone)}
                </Text>
              </View>
            </>
          ) : null}
        </View>

        <Text style={[styles.noteTitle, { color: colors.foreground }]}>
          {note.title}
        </Text>

        {showReprocess && (
          <View
            style={[
              styles.reprocessCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <FormatSelector selected={reprocessFormat} onSelect={setReprocessFormat} />
            <ToneSelector selected={reprocessTone} onSelect={setReprocessTone} />
            <TouchableOpacity
              style={[
                styles.reprocessBtn,
                {
                  borderRadius: colors.radius,
                  opacity: isReprocessing ? 0.6 : 1,
                },
              ]}
              onPress={handleReprocess}
              disabled={isReprocessing}
            >
              {isReprocessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="zap" size={16} color="#fff" />
                  <Text style={styles.reprocessBtnText}>Reprocess</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {note.processedOutput ? (
          <View
            style={[
              styles.section,
              { backgroundColor: colors.primary + "10", borderRadius: colors.radius },
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeader}>
                <Feather name="zap" size={14} color={colors.primary} />
                <Text style={[styles.sectionLabel, { color: colors.primary }]}>
                  AI Result
                </Text>
              </View>
              <TouchableOpacity onPress={handleCopyOutput}>
                <Feather
                  name={copied === "output" ? "check" : "copy"}
                  size={16}
                  color={copied === "output" ? "#22c55e" : colors.primary}
                />
              </TouchableOpacity>
            </View>
            <Text style={[styles.sectionText, { color: colors.foreground }]}>
              {note.processedOutput}
            </Text>
          </View>
        ) : null}

        {!note.processedOutput && note.summary ? (
          <View
            style={[
              styles.section,
              { backgroundColor: colors.primary + "15", borderRadius: colors.radius },
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeader}>
                <Feather name="zap" size={14} color={colors.primary} />
                <Text style={[styles.sectionLabel, { color: colors.primary }]}>
                  Summary
                </Text>
              </View>
              <TouchableOpacity onPress={handleCopyOutput}>
                <Feather
                  name={copied === "output" ? "check" : "copy"}
                  size={16}
                  color={copied === "output" ? "#22c55e" : colors.primary}
                />
              </TouchableOpacity>
            </View>
            <Text style={[styles.sectionText, { color: colors.foreground }]}>
              {note.summary}
            </Text>
          </View>
        ) : null}

        {note.actionItems.length > 0 && (
          <View
            style={[
              styles.section,
              {
                backgroundColor: colors.accent + "15",
                borderRadius: colors.radius,
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Feather name="check-circle" size={14} color={colors.accent} />
              <Text style={[styles.sectionLabel, { color: colors.accent }]}>
                Action Items
              </Text>
            </View>
            {note.actionItems.map((item, idx) => (
              <View key={idx} style={styles.actionItem}>
                <View
                  style={[
                    styles.actionDot,
                    { backgroundColor: colors.accent },
                  ]}
                />
                <Text
                  style={[styles.actionText, { color: colors.foreground }]}
                >
                  {item}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.transcriptSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeader}>
              <Feather name="file-text" size={14} color={colors.mutedForeground} />
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                {note.processedOutput ? "Original Input" : "Transcript"}
              </Text>
            </View>
            <TouchableOpacity onPress={handleCopyTranscript}>
              <Feather
                name={copied === "transcript" ? "check" : "copy"}
                size={16}
                color={copied === "transcript" ? "#22c55e" : colors.mutedForeground}
              />
            </TouchableOpacity>
          </View>
          <Text
            style={[
              styles.transcriptText,
              { color: colors.foreground, lineHeight: 26 },
            ]}
          >
            {note.transcript}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 20,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaDot: {
    fontSize: 13,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  formatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  formatBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  noteTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  reprocessCard: {
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  reprocessBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: "#6366f1",
  },
  reprocessBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  section: {
    padding: 16,
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  sectionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  actionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  actionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    flex: 1,
  },
  transcriptSection: {
    gap: 12,
  },
  transcriptText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  notFoundText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
});
