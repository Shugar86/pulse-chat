import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createInvite } from '../api/tenants';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorBanner } from '../components/ErrorBanner';
import { colors, radius, spacing, typography } from '../theme';
import type { TenantStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<TenantStackParamList, 'TenantInvite'>;

export function TenantInviteScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { tenantId } = route.params;
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => createInvite(tenantId),
    onSuccess: (data) => {
      setError('');
      setCode(data.code);
    },
    onError: () => {
      setError(t('inviteCreateFailed'));
    },
  });

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Text style={styles.title}>{t('inviteCode')}</Text>
        <Text style={styles.subtitle}>{t('inviteCodeSubtitle')}</Text>

        {error ? <ErrorBanner message={error} style={styles.banner} /> : null}

        {code ? (
          <View style={styles.codeBox}>
            <Text style={styles.code}>{code}</Text>
          </View>
        ) : null}

        <Button
          title={code ? t('generateNewCode') : t('generateCode')}
          onPress={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={mutation.isPending}
        />
        <View style={styles.gap} />
        <Button title={t('back')} onPress={() => navigation.goBack()} variant="ghost" />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%' },
  title: { ...typography.h2, marginBottom: spacing.sm },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.lg },
  banner: { marginBottom: spacing.md },
  codeBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  code: { ...typography.h2, letterSpacing: 2 },
  gap: { height: spacing.md },
});
