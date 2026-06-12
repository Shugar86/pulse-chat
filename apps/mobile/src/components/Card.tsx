import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { colors, radius, shadows, spacing } from '../theme';

export function Card({ children, style, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadows.md,
  },
});
