import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useThemeMode } from '../theme/ThemeContext';

interface SkeletonLineProps {
  width?: ViewStyle['width'];
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonLine({ width = '100%', height = 16, borderRadius = 6, style }: SkeletonLineProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const { scheme } = useThemeMode();
  const base = scheme === 'dark' ? '#374151' : '#e2e8f0';
  const highlight = scheme === 'dark' ? '#4b5563' : '#f1f5f9';

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: 700, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const bg = anim.interpolate({ inputRange: [0, 1], outputRange: [base, highlight] });

  return (
    <Animated.View style={[{ width, height, borderRadius, backgroundColor: bg, marginBottom: 6 }, style]} />
  );
}

interface SkeletonCardProps {
  count?: number;
}

export function SkeletonCard({ count = 4 }: SkeletonCardProps) {
  const { scheme } = useThemeMode();
  const cardBg = scheme === 'dark' ? '#1f2937' : '#ffffff';

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.card, { backgroundColor: cardBg }]}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <SkeletonLine width={42} height={42} borderRadius={21} style={{ marginBottom: 0 }} />
            <View style={{ flex: 1 }}>
              <SkeletonLine width="60%" height={16} />
              <SkeletonLine width="80%" height={12} />
              <SkeletonLine width="40%" height={12} />
            </View>
          </View>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
});
