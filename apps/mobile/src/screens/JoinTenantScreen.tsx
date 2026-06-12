import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { joinTenant } from '../api/tenants';
import { useTenantStore } from '../stores/tenantStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { ErrorBanner } from '../components/ErrorBanner';
import { colors, spacing, typography } from '../theme';
import type { TenantStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<TenantStackParamList, 'JoinTenant'>;

export function JoinTenantScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { setActiveTenantId } = useTenantStore();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: joinTenant,
    onSuccess: async (membership) => {
      await setActiveTenantId(membership.tenantId);
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
    onError: () => {
      setError(t('joinTenantFailed'));
    },
  });

  const handleSubmit = () => {
    setError('');
    if (!code.trim()) {
      setError(t('inviteCodeRequired'));
      return;
    }
    mutation.mutate(code.trim().toUpperCase());
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Text style={styles.title}>{t('joinCompany')}</Text>
        {error ? <ErrorBanner message={error} style={styles.banner} /> : null}
        <Input
          label={t('inviteCode')}
          placeholder={t('inviteCode')}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoFocus
        />
        <View style={styles.gap} />
        <Button title={t('join')} onPress={handleSubmit} loading={mutation.isPending} disabled={mutation.isPending} />
        <View style={styles.gap} />
        <Button title={t('back')} onPress={() => navigation.goBack()} variant="ghost" />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%' },
  title: { ...typography.h2, marginBottom: spacing.lg },
  banner: { marginBottom: spacing.md },
  gap: { height: spacing.md },
});
