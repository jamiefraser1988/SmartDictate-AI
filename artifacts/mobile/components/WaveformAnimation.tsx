import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface WaveformAnimationProps {
  isActive: boolean;
  barCount?: number;
}

function WaveBar({
  isActive,
  index,
  barCount,
  color,
}: {
  isActive: boolean;
  index: number;
  barCount: number;
  color: string;
}) {
  const heightAnim = useRef(new Animated.Value(4)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isActive) {
      const minHeight = 4;
      const maxHeight = 28 + Math.random() * 20;
      const duration = 300 + Math.random() * 400;
      const delay = (index / barCount) * 200;

      animRef.current = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(heightAnim, {
            toValue: maxHeight,
            duration,
            useNativeDriver: false,
          }),
          Animated.timing(heightAnim, {
            toValue: minHeight,
            duration,
            useNativeDriver: false,
          }),
        ])
      );
      animRef.current.start();
    } else {
      animRef.current?.stop();
      Animated.timing(heightAnim, {
        toValue: 4,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }

    return () => {
      animRef.current?.stop();
    };
  }, [isActive]);

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          height: heightAnim,
          backgroundColor: color,
          opacity: isActive ? 1 : 0.3,
        },
      ]}
    />
  );
}

export default function WaveformAnimation({
  isActive,
  barCount = 32,
}: WaveformAnimationProps) {
  const colors = useColors();
  const bars = Array.from({ length: barCount }, (_, i) => i);

  return (
    <View style={styles.container}>
      {bars.map((_, i) => (
        <WaveBar
          key={i}
          isActive={isActive}
          index={i}
          barCount={barCount}
          color={colors.primary}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 60,
  },
  bar: {
    width: 3,
    borderRadius: 2,
  },
});
