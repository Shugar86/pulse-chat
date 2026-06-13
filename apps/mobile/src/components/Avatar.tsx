import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, radius, typography, statusColors } from '../theme';

type Size = 'sm' | 'md' | 'lg';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: Size;
  isOnline?: boolean;
}

const sizeMap: Record<Size, { container: number; font: number; indicator: number }> = {
  sm: { container: 36, font: 14, indicator: 8 },
  md: { container: 48, font: 18, indicator: 10 },
  lg: { container: 80, font: 30, indicator: 14 },
};

export function Avatar({ uri, name = '?', size = 'md', isOnline }: AvatarProps) {
  const pulse = useRef(new Animated.Value(1)).current;
  const s = sizeMap[size];
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!isOnline) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.4, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isOnline, pulse]);

  return (
    <View style={[styles.container, { width: s.container, height: s.container, borderRadius: radius.full }]}>
      <View style={[styles.fallback, { width: s.container, height: s.container, borderRadius: radius.full }]}>
        <Text style={[styles.text, { fontSize: s.font }]}>{initials}</Text>
      </View>
      {isOnline !== undefined ? (
        <View style={[styles.indicatorContainer, { width: s.indicator, height: s.indicator, borderRadius: s.indicator / 2, bottom: size === 'lg' ? 4 : 0, right: size === 'lg' ? 4 : 0 }]}>
          <Animated.View style={[styles.indicatorPulse, { width: s.indicator, height: s.indicator, borderRadius: s.indicator / 2, backgroundColor: statusColors.online, transform: [{ scale: pulse }] }]} />
          <View style={[styles.indicator, { width: s.indicator, height: s.indicator, borderRadius: s.indicator / 2, backgroundColor: isOnline ? statusColors.online : statusColors.offline }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  fallback: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.secondary, fontWeight: '600' },
  indicatorContainer: { position: 'absolute', borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  indicatorPulse: { position: 'absolute', opacity: 0.4 },
  indicator: { position: 'absolute' },
});
