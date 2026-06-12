import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useTranslation } from 'react-i18next';
import { colors, spacing, typography } from '../theme';

export function OfflineBanner() {
  const { t } = useTranslation();
  const { isConnected } = useNetInfo();
  if (isConnected !== false) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{t('offline')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.error, padding: spacing.sm, alignItems: 'center' },
  text: { ...typography.bodySmall, color: colors.surface },
});
