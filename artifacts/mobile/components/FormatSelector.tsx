import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { OutputFormat } from "@/context/NotesContext";

const FORMAT_OPTIONS: { id: OutputFormat; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: "transcript", label: "Clean Up", icon: "refresh-cw" },
  { id: "minutes", label: "Minutes", icon: "file-text" },
  { id: "tasks", label: "Tasks", icon: "check-square" },
  { id: "email", label: "Mail", icon: "mail" },
];

interface FormatSelectorProps {
  selected: OutputFormat;
  onSelect: (format: OutputFormat) => void;
}

export default function FormatSelector({ selected, onSelect }: FormatSelectorProps) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
        Select Transformation
      </Text>
      <View style={styles.grid}>
        {FORMAT_OPTIONS.map((item) => {
          const isActive = selected === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              testID={`format-${item.id}`}
              style={[
                styles.option,
                {
                  backgroundColor: isActive ? colors.primary + "15" : colors.card,
                  borderColor: isActive ? colors.primary : colors.border,
                  borderRadius: colors.radius,
                },
              ]}
              onPress={() => onSelect(item.id)}
              activeOpacity={0.7}
            >
              <Feather
                name={item.icon}
                size={18}
                color={isActive ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.optionText,
                  { color: isActive ? colors.primary : colors.mutedForeground },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function formatLabel(format?: OutputFormat): string {
  switch (format) {
    case "transcript":
      return "Clean Up";
    case "minutes":
      return "Minutes";
    case "tasks":
      return "Tasks";
    case "email":
      return "Email";
    default:
      return "Note";
  }
}

export function formatIcon(format?: OutputFormat): keyof typeof Feather.glyphMap {
  switch (format) {
    case "transcript":
      return "refresh-cw";
    case "minutes":
      return "file-text";
    case "tasks":
      return "check-square";
    case "email":
      return "mail";
    default:
      return "mic";
  }
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: "row",
    gap: 8,
  },
  option: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
    borderWidth: 1,
  },
  optionText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
