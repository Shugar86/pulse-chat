import React from 'react';
import { View, Text, StyleSheet, ViewProps } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { Button } from './Button';

interface ErrorBannerProps extends ViewProps {
  message: string;
  onRetry?: () => void;
  retryTitle?: string;
}

export function ErrorBanner({ message, onRetry, retryTitle, style }: ErrorBannerProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? <Button title={retryTitle ?? 'Retry'} onPress={onRetry} variant="ghost" fullWidth={false} style={styles.retryButton} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  message: { ...typography.bodySmall, color: colors.error, marginBottom: spacing.sm },
  retryButton: { alignSelf: 'flex-start' },
});
