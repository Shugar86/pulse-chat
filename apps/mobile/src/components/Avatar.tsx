import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

type Size = 'sm' | 'md' | 'lg';

interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: Size;
  online?: boolean;
}

const sizeMap = { sm: 36, md: 44, lg: 72 };
const fontMap = { sm: 14, md: 16, lg: 28 };

export function Avatar({ uri, name, size = 'md', online }: AvatarProps) {
  const diameter = sizeMap[size];
  const fontSize = fontMap[size];
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <View style={[styles.wrapper, { width: diameter, height: diameter }]}>
      {uri ? (
        <Image source={{ uri }} style={[styles.image, { width: diameter, height: diameter, borderRadius: diameter / 2 }]} />
      ) : (
        <View style={[styles.fallback, { width: diameter, height: diameter, borderRadius: diameter / 2 }]}>
          <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
        </View>
      )}
      {online && <View style={styles.onlineIndicator} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },
  image: { backgroundColor: colors.surfaceAlt },
  fallback: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  initials: { color: colors.secondary, fontWeight: '600' },
  onlineIndicator: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
