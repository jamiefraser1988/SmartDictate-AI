import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WaveformAnimation from "@/components/WaveformAnimation";
import { useNotes } from "@/context/NotesContext";
import { useColors } from "@/hooks/useColors";
import { transcribeAudio } from "@/services/transcribe";

type RecordingState = "idle" | "recording" | "processing" | "done" | "error";

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function deriveTitle(transcript: string): string {
  const words = transcript.trim().split(/\s+/).slice(0, 8).join(" ");
  return words.length > 0 ? words + (transcript.split(" ").length > 8 ? "…" : "") : "Voice Note";
}

export default function RecordScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addNote } = useNotes();

  const [state, setState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [permissionStatus, setPermissionStatus] = useState<
    "granted" | "denied" | "undetermined"
  >("undetermined");

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    checkPermission();
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      pulseAnimRef.current?.stop();
    };
  }, []);

  const checkPermission = async () => {
    if (Platform.OS === "web") {
      setPermissionStatus("granted");
      return;
    }
    const { status } = await Audio.getPermissionsAsync();
    setPermissionStatus(status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined");
  };

  const requestPermission = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    setPermissionStatus(status === "granted" ? "granted" : "denied");
  };

  const startPulse = () => {
    pulseAnimRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimRef.current.start();
  };

  const stopPulse = () => {
    pulseAnimRef.current?.stop();
    Animated.timing(pulseAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const formatElapsed = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    if (permissionStatus !== "granted") {
      await requestPermission();
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setState("recording");
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);

      startPulse();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {
      setState("error");
      setErrorMsg("Could not start recording. Please try again.");
    }
  };

  const stopAndProcess = async () => {
    if (!recordingRef.current) return;

    timerRef.current && clearInterval(timerRef.current);
    stopPulse();

    setState("processing");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const duration = elapsed;

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error("No recording URI");

      if (Platform.OS === "web") {
        const note = {
          id: generateId(),
          title: "Voice Note",
          transcript: "Web recording not supported for transcription. Please use a mobile device.",
          summary: "Recorded on web browser.",
          actionItems: [] as string[],
          duration,
          createdAt: new Date().toISOString(),
        };
        await addNote(note);
        setState("done");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => router.replace(`/note/${note.id}`), 1200);
        return;
      }

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: (FileSystem.EncodingType?.Base64 as any) ?? "base64",
      });

      const mimeType = Platform.OS === "ios" ? "audio/m4a" : "audio/mp4";

      const result = await transcribeAudio(base64, mimeType, duration);

      const note = {
        id: generateId(),
        title: deriveTitle(result.transcript),
        transcript: result.transcript,
        summary: result.summary,
        actionItems: result.actionItems,
        duration,
        createdAt: new Date().toISOString(),
      };

      await addNote(note);
      setState("done");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => router.replace(`/note/${note.id}`), 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Processing failed.";
      setState("error");
      setErrorMsg(msg);
    }
  };

  const retry = useCallback(() => {
    setState("idle");
    setElapsed(0);
    setErrorMsg("");
  }, []);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: topPad + 16, paddingBottom: bottomPad + 24 },
      ]}
    >
      <View style={styles.navRow}>
        <TouchableOpacity
          testID="back-button"
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="x" size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {state === "idle" && permissionStatus !== "granted" && (
          <View style={styles.permissionContainer}>
            <View
              style={[
                styles.permIconBg,
                { backgroundColor: colors.muted, borderRadius: colors.radius },
              ]}
            >
              <Feather name="mic-off" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.permTitle, { color: colors.foreground }]}>
              Microphone access needed
            </Text>
            <Text style={[styles.permSub, { color: colors.mutedForeground }]}>
              SmartDictate needs microphone access to record your voice notes.
            </Text>
            <TouchableOpacity
              style={[
                styles.permBtn,
                { backgroundColor: colors.primary, borderRadius: colors.radius },
              ]}
              onPress={requestPermission}
            >
              <Text style={styles.permBtnText}>Allow Microphone</Text>
            </TouchableOpacity>
          </View>
        )}

        {(state === "idle" || state === "recording") && permissionStatus === "granted" && (
          <>
            <View style={styles.timerSection}>
              <Text style={[styles.timer, { color: colors.foreground }]}>
                {formatElapsed(elapsed)}
              </Text>
              <Text style={[styles.timerLabel, { color: colors.mutedForeground }]}>
                {state === "recording" ? "Recording..." : "Ready to record"}
              </Text>
            </View>

            <View style={styles.waveformSection}>
              <WaveformAnimation isActive={state === "recording"} barCount={28} />
            </View>

            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                testID="record-button"
                style={[
                  styles.recordBtn,
                  {
                    backgroundColor:
                      state === "recording" ? colors.destructive : colors.primary,
                    borderRadius: 60,
                  },
                ]}
                onPress={state === "recording" ? stopAndProcess : startRecording}
                activeOpacity={0.85}
              >
                <Feather
                  name={state === "recording" ? "square" : "mic"}
                  size={32}
                  color="#fff"
                />
              </TouchableOpacity>
            </Animated.View>

            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              {state === "recording"
                ? "Tap to stop and process"
                : "Tap to start recording"}
            </Text>
          </>
        )}

        {state === "processing" && (
          <View style={styles.processingContainer}>
            <View
              style={[
                styles.processingIconBg,
                { backgroundColor: colors.muted, borderRadius: 48 },
              ]}
            >
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
            <Text style={[styles.processingTitle, { color: colors.foreground }]}>
              Processing...
            </Text>
            <Text style={[styles.processingSubtitle, { color: colors.mutedForeground }]}>
              AI is transcribing and summarizing your note
            </Text>
          </View>
        )}

        {state === "done" && (
          <View style={styles.doneContainer}>
            <View
              style={[
                styles.doneIconBg,
                { backgroundColor: "#22c55e20", borderRadius: 48 },
              ]}
            >
              <Feather name="check" size={40} color="#22c55e" />
            </View>
            <Text style={[styles.processingTitle, { color: colors.foreground }]}>
              Note saved!
            </Text>
            <Text style={[styles.processingSubtitle, { color: colors.mutedForeground }]}>
              Your recording has been processed
            </Text>
          </View>
        )}

        {state === "error" && (
          <View style={styles.errorContainer}>
            <View
              style={[
                styles.errorIconBg,
                {
                  backgroundColor: colors.destructive + "20",
                  borderRadius: 48,
                },
              ]}
            >
              <Feather name="alert-circle" size={40} color={colors.destructive} />
            </View>
            <Text style={[styles.processingTitle, { color: colors.foreground }]}>
              Something went wrong
            </Text>
            <Text
              style={[styles.processingSubtitle, { color: colors.mutedForeground }]}
            >
              {errorMsg}
            </Text>
            <TouchableOpacity
              style={[
                styles.retryBtn,
                { backgroundColor: colors.primary, borderRadius: colors.radius },
              ]}
              onPress={retry}
            >
              <Feather name="refresh-cw" size={16} color="#fff" />
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 16,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
  },
  timerSection: {
    alignItems: "center",
    gap: 8,
  },
  timer: {
    fontSize: 56,
    fontFamily: "Inter_700Bold",
    letterSpacing: -2,
  },
  timerLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  waveformSection: {
    width: "100%",
    alignItems: "center",
  },
  recordBtn: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  hint: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  processingContainer: {
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 40,
  },
  processingIconBg: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  processingTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  processingSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  doneContainer: {
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 40,
  },
  doneIconBg: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 40,
  },
  errorIconBg: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 8,
  },
  retryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  permissionContainer: {
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 40,
  },
  permIconBg: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  permTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  permSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  permBtn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 8,
  },
  permBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
