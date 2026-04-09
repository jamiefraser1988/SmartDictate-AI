import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FormatSelector from "@/components/FormatSelector";
import ToneSelector from "@/components/ToneSelector";
import { useNotes, type OutputFormat, type Tone } from "@/context/NotesContext";
import { useColors } from "@/hooks/useColors";
import { processText } from "@/services/process";
import { transcribeAudio } from "@/services/transcribe";

const MAX_CHARS = 20000;

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function deriveTitle(text: string): string {
  const words = text.trim().split(/\s+/).slice(0, 8).join(" ");
  return words.length > 0
    ? words + (text.split(/\s+/).length > 8 ? "\u2026" : "")
    : "Text Note";
}

export default function ComposeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addNote } = useNotes();

  const [text, setText] = useState("");
  const [format, setFormat] = useState<OutputFormat>("transcript");
  const [tone, setTone] = useState<Tone>("formal");
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputCopied, setInputCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isDictating, setIsDictating] = useState(false);
  const [dictateElapsed, setDictateElapsed] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      pulseAnimRef.current?.stop();
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const startDictatePulse = () => {
    pulseAnimRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulseAnimRef.current.start();
  };

  const stopDictatePulse = () => {
    pulseAnimRef.current?.stop();
    Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  };

  const formatElapsed = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const startDictation = async () => {
    try {
      if (Platform.OS !== "web") {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== "granted") {
          setError("Microphone permission is required for dictation.");
          return;
        }
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setIsDictating(true);
      setDictateElapsed(0);
      setError(null);

      timerRef.current = setInterval(() => {
        setDictateElapsed((e) => e + 1);
      }, 1000);

      startDictatePulse();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {
      setError("Could not start dictation. Please try again.");
    }
  };

  const stopDictation = useCallback(async () => {
    if (!recordingRef.current) return;

    timerRef.current && clearInterval(timerRef.current);
    timerRef.current = null;
    stopDictatePulse();
    setIsDictating(false);
    setIsTranscribing(true);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const duration = dictateElapsed;

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error("No recording URI");

      if (Platform.OS === "web") {
        setText((prev) => {
          const sep = prev.trim() ? "\n\n" : "";
          return (prev + sep + "[Web dictation not supported — please use a mobile device]").slice(0, MAX_CHARS);
        });
        setIsTranscribing(false);
        return;
      }

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: (FileSystem.EncodingType?.Base64 as any) ?? "base64",
      });

      const mimeType = Platform.OS === "ios" ? "audio/m4a" : "audio/mp4";
      const result = await transcribeAudio(base64, mimeType, duration);

      if (result.transcript) {
        setText((prev) => {
          const sep = prev.trim() ? "\n\n" : "";
          return (prev + sep + result.transcript).slice(0, MAX_CHARS);
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Dictation failed.";
      setError(msg);
    } finally {
      setIsTranscribing(false);
    }
  }, [dictateElapsed]);

  const handleFileImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/*", "video/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];

      if (file.size && file.size > 25 * 1024 * 1024) {
        setError("File is too large. Please choose a file under 25 MB.");
        return;
      }

      setIsImporting(true);
      setError(null);

      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: (FileSystem.EncodingType?.Base64 as any) ?? "base64",
      });

      const mimeType = file.mimeType || "audio/mp4";
      const transcribeResult = await transcribeAudio(base64, mimeType, 0);

      if (transcribeResult.transcript) {
        setText((prev) => {
          const sep = prev.trim() ? "\n\n--- Imported Transcription ---\n\n" : "";
          return (prev + sep + transcribeResult.transcript).slice(0, MAX_CHARS);
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setError("Transcription returned empty. Try a different file.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed.";
      setError(msg);
    } finally {
      setIsImporting(false);
    }
  };

  const handleCopyInput = async () => {
    if (!text.trim()) return;
    await Clipboard.setStringAsync(text);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputCopied(true);
    setTimeout(() => setInputCopied(false), 2000);
  };

  const handleDirectSave = async () => {
    if (!text.trim()) return;

    const note = {
      id: generateId(),
      title: deriveTitle(text),
      transcript: text,
      summary: "",
      actionItems: [] as string[],
      duration: 0,
      createdAt: new Date().toISOString(),
      tone,
    };

    await addNote(note);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace(`/note/${note.id}`);
  };

  const handleProcess = async () => {
    if (!text.trim()) {
      setError("Please enter some text first.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const result = await processText(text, format, tone);

      const note = {
        id: generateId(),
        title: deriveTitle(text),
        transcript: text,
        summary: "",
        actionItems: [] as string[],
        duration: 0,
        createdAt: new Date().toISOString(),
        outputFormat: format,
        processedOutput: result.result,
        tone,
      };

      await addNote(note);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/note/${note.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Processing failed.";
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    Alert.alert("Clear Text", "Are you sure you want to clear all text?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          setText("");
          setError(null);
        },
      },
    ]);
  };

  const isBusy = isProcessing || isTranscribing || isImporting;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
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
          <Feather name="x" size={24} color={colors.foreground} />
        </TouchableOpacity>

        <Text style={[styles.navTitle, { color: colors.foreground }]}>
          Compose
        </Text>

        <View style={styles.navActions}>
          {text.trim() ? (
            <TouchableOpacity onPress={handleCopyInput}>
              <Feather
                name={inputCopied ? "check" : "copy"}
                size={20}
                color={inputCopied ? "#22c55e" : colors.mutedForeground}
              />
            </TouchableOpacity>
          ) : null}
          {text.trim() ? (
            <TouchableOpacity onPress={handleClear}>
              <Feather name="trash-2" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomPad + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.inputCard,
            {
              backgroundColor: colors.card,
              borderColor: error ? colors.destructive + "80" : colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <View style={styles.inputHeader}>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
              INPUT NOTES
            </Text>
            <Text
              style={[
                styles.charCount,
                {
                  color:
                    text.length >= MAX_CHARS
                      ? colors.destructive
                      : colors.mutedForeground,
                },
              ]}
            >
              {text.length} / {MAX_CHARS}
            </Text>
          </View>

          <TextInput
            testID="compose-input"
            style={[
              styles.textInput,
              {
                color: colors.foreground,
                backgroundColor: colors.background + "80",
                borderColor: isDictating ? colors.destructive : colors.border,
                borderRadius: colors.radius,
              },
            ]}
            placeholder="Start typing, paste your notes, or use the mic to dictate..."
            placeholderTextColor={colors.mutedForeground + "80"}
            value={text}
            onChangeText={(t) => {
              setText(t.slice(0, MAX_CHARS));
              if (error) setError(null);
            }}
            multiline
            textAlignVertical="top"
            maxLength={MAX_CHARS}
            editable={!isDictating}
          />

          {(isTranscribing || isImporting) && (
            <View
              style={[
                styles.transcribingOverlay,
                { backgroundColor: colors.background + "E0", borderRadius: colors.radius },
              ]}
            >
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.transcribingText, { color: colors.primary }]}>
                {isImporting ? "Transcribing file..." : "Transcribing dictation..."}
              </Text>
            </View>
          )}

          <View style={styles.inputActions}>
            <TouchableOpacity
              testID="import-button"
              style={[
                styles.inputActionBtn,
                {
                  backgroundColor: colors.secondary,
                  borderRadius: 24,
                  opacity: isBusy || isDictating ? 0.4 : 1,
                },
              ]}
              onPress={handleFileImport}
              disabled={isBusy || isDictating}
              activeOpacity={0.7}
            >
              <Feather name="upload" size={18} color={colors.foreground} />
            </TouchableOpacity>

            {isDictating && (
              <View style={styles.dictateTimer}>
                <View style={[styles.dictateTimerDot, { backgroundColor: colors.destructive }]} />
                <Text style={[styles.dictateTimerText, { color: colors.destructive }]}>
                  {formatElapsed(dictateElapsed)}
                </Text>
              </View>
            )}

            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                testID="dictate-button"
                style={[
                  styles.dictateBtn,
                  {
                    backgroundColor: isDictating ? colors.destructive : colors.primary,
                    borderRadius: 28,
                    opacity: isBusy ? 0.4 : 1,
                  },
                ]}
                onPress={isDictating ? stopDictation : startDictation}
                disabled={isBusy}
                activeOpacity={0.85}
              >
                <Feather
                  name={isDictating ? "square" : "mic"}
                  size={20}
                  color="#fff"
                />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>

        {error ? (
          <View style={styles.errorRow}>
            <Feather name="alert-circle" size={14} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {error}
            </Text>
          </View>
        ) : null}

        <FormatSelector selected={format} onSelect={setFormat} />

        <ToneSelector selected={tone} onSelect={setTone} />

        <View style={styles.actionButtons}>
          <TouchableOpacity
            testID="add-to-result-button"
            style={[
              styles.secondaryBtn,
              {
                backgroundColor: colors.secondary,
                borderRadius: colors.radius,
                opacity: !text.trim() || isBusy || isDictating ? 0.5 : 1,
              },
            ]}
            onPress={handleDirectSave}
            disabled={!text.trim() || isBusy || isDictating}
            activeOpacity={0.7}
          >
            <Feather name="chevron-right" size={18} color={colors.foreground} />
            <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>
              Add to Result
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="process-button"
            style={[
              styles.primaryBtn,
              {
                borderRadius: colors.radius,
                opacity: !text.trim() || isBusy || isDictating ? 0.5 : 1,
              },
            ]}
            onPress={handleProcess}
            disabled={!text.trim() || isBusy || isDictating}
            activeOpacity={0.7}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="zap" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Process with AI</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  navTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  navActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 20,
  },
  inputCard: {
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  inputHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  charCount: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    fontVariant: ["tabular-nums"],
  },
  textInput: {
    minHeight: 160,
    maxHeight: 350,
    borderWidth: 1,
    padding: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  transcribingOverlay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
  },
  transcribingText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  inputActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
  },
  inputActionBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dictateTimer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dictateTimerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dictateTimerText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    fontVariant: ["tabular-nums"],
  },
  dictateBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  actionButtons: {
    gap: 12,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    backgroundColor: "#6366f1",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
