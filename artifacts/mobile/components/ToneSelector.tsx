import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { Tone } from "@/context/NotesContext";

const TONE_OPTIONS: { id: Tone; label: string; icon: keyof typeof Feather.glyphMap; description: string }[] = [
  { id: "formal", label: "Formal", icon: "briefcase", description: "Professional & polished" },
  { id: "informal", label: "Informal", icon: "message-circle", description: "Friendly & conversational" },
];

interface ToneSelectorProps {
  selected: Tone;
  onSelect: (tone: Tone) => void;
}

export default function ToneSelector({ selected, onSelect }: ToneSelectorProps) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
        Tone
      </Text>
      <View style={styles.row}>
        {TONE_OPTIONS.map((item) => {
          const isActive = selected === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              testID={`tone-${item.id}`}
              style={[
                styles.option,
                {
                  backgroundColor: isActive ? colors.accent + "15" : colors.card,
                  borderColor: isActive ? colors.accent : colors.border,
                  borderRadius: colors.radius,
                },
              ]}
              onPress={() => onSelect(item.id)}
              activeOpacity={0.7}
            >
              <Feather
                name={item.icon}
                size={16}
                color={isActive ? colors.accent : colors.mutedForeground}
              />
              <View style={styles.textCol}>
                <Text
                  style={[
                    styles.optionLabel,
                    { color: isActive ? colors.accent : colors.foreground },
                  ]}
                >
                  {item.label}
                </Text>
                <Text
                  style={[
                    styles.optionDesc,
                    { color: isActive ? colors.accent + "CC" : colors.mutedForeground },
                  ]}
                >
                  {item.description}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function toneLabel(tone?: Tone): string {
  switch (tone) {
    case "formal":
      return "Formal";
    case "informal":
      return "Informal";
    default:
      return "Formal";
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
  row: {
    flexDirection: "row",
    gap: 8,
  },
  option: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  optionDesc: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
});
