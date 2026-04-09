import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { formatLabel, formatIcon } from "@/components/FormatSelector";
import { toneLabel } from "@/components/ToneSelector";
import { useColors } from "@/hooks/useColors";
import { type Note } from "@/context/NotesContext";

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (days === 1) {
    return "Yesterday";
  } else if (days < 7) {
    return date.toLocaleDateString([], { weekday: "long" });
  } else {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface NoteCardProps {
  note: Note;
  onDelete: (id: string) => void;
}

export default function NoteCard({ note, onDelete }: NoteCardProps) {
  const colors = useColors();
  const router = useRouter();

  const hasFormat = !!note.outputFormat;
  const isComposed = note.duration === 0 && !note.outputFormat;

  return (
    <TouchableOpacity
      testID={`note-card-${note.id}`}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
      onPress={() => router.push(`/note/${note.id}`)}
      activeOpacity={0.75}
    >
      <View style={styles.header}>
        <View style={styles.metaRow}>
          <Feather
            name={note.duration > 0 ? "mic" : "edit-3"}
            size={12}
            color={colors.primary}
          />
          {note.duration > 0 ? (
            <Text style={[styles.duration, { color: colors.mutedForeground }]}>
              {formatDuration(note.duration)}
            </Text>
          ) : null}
          {note.duration > 0 ? (
            <Text style={[styles.dot, { color: colors.mutedForeground }]}>·</Text>
          ) : null}
          <Text style={[styles.date, { color: colors.mutedForeground }]}>
            {formatDate(note.createdAt)}
          </Text>
        </View>
        <TouchableOpacity
          testID={`delete-note-${note.id}`}
          onPress={(e) => {
            e.stopPropagation();
            onDelete(note.id);
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="trash-2" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <Text
        style={[styles.title, { color: colors.foreground }]}
        numberOfLines={2}
      >
        {note.title}
      </Text>

      {note.summary ? (
        <Text
          style={[styles.summary, { color: colors.mutedForeground }]}
          numberOfLines={2}
        >
          {note.summary}
        </Text>
      ) : note.processedOutput ? (
        <Text
          style={[styles.summary, { color: colors.mutedForeground }]}
          numberOfLines={2}
        >
          {note.processedOutput}
        </Text>
      ) : null}

      <View style={styles.badgeRow}>
        {hasFormat && (
          <View
            style={[
              styles.badge,
              { backgroundColor: colors.accent + "20", borderRadius: 6 },
            ]}
          >
            <Feather
              name={formatIcon(note.outputFormat)}
              size={10}
              color={colors.accent}
            />
            <Text style={[styles.badgeText, { color: colors.accent }]}>
              {formatLabel(note.outputFormat)}
            </Text>
          </View>
        )}
        {note.tone ? (
          <View
            style={[
              styles.badge,
              { backgroundColor: colors.primary + "15", borderRadius: 6 },
            ]}
          >
            <Feather
              name={note.tone === "formal" ? "briefcase" : "message-circle"}
              size={10}
              color={colors.primary}
            />
            <Text style={[styles.badgeText, { color: colors.primary }]}>
              {toneLabel(note.tone)}
            </Text>
          </View>
        ) : null}
        {note.actionItems.length > 0 && (
          <View
            style={[
              styles.badge,
              { backgroundColor: colors.primary + "20", borderRadius: 6 },
            ]}
          >
            <Feather name="check-circle" size={10} color={colors.primary} />
            <Text style={[styles.badgeText, { color: colors.primary }]}>
              {note.actionItems.length} action{" "}
              {note.actionItems.length === 1 ? "item" : "items"}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  duration: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  dot: {
    fontSize: 12,
  },
  date: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  title: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 22,
  },
  summary: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
