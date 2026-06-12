import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, typography } from '../theme';

interface BadgeProps {
  count?: number;
  text?: string;
}

export function Badge({ count, text }: BadgeProps) {
  if (count !== undefined && count <= 0) return null;
  const label = text ?? (count && count > 99 ? '99+' : String(count ?? ''));
  if (!label) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  text: { ...typography.caption, color: colors.surface, fontWeight: '600' },
});
