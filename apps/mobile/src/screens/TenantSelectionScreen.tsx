import React, { useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TenantMembership } from '@pulse-chat/shared';
import { listMyTenants } from '../api/tenants';
import { useTenantStore } from '../stores/tenantStore';
import { ListItem } from '../components/ListItem';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { Skeleton } from '../components/Skeleton';
import { colors, radius, spacing, typography } from '../theme';
import type { TenantStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<TenantStackParamList, 'TenantSelection'>;

const skeletonData = () => Array.from({ length: 4 }, (_, i) => `skeleton-${i}`);

function SkeletonRow() {
  return (
    <View style={styles.skeletonRow}>
      <Skeleton width={44} height={44} style={{ borderRadius: radius.full }} />
      <View style={styles.skeletonText}>
        <Skeleton width="60%" height={16} style={{ marginBottom: spacing.sm }} />
        <Skeleton width="40%" height={12} />
      </View>
    </View>
  );
}

interface TenantRowProps {
  membership: TenantMembership;
  onPress: (membership: TenantMembership) => void;
}

function TenantRow({ membership, onPress }: TenantRowProps) {
  const { t } = useTranslation();
  return (
    <ListItem
      title={membership.tenant.name}
      subtitle={t(`role_${membership.role}`)}
      avatarName={membership.tenant.name}
      onPress={() => onPress(membership)}
    />
  );
}

export function TenantSelectionScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { setActiveTenantId } = useTenantStore();
  const { data: memberships, isLoading, isError, refetch } = useQuery({
    queryKey: ['tenants'],
    queryFn: listMyTenants,
  });

  const handleSelect = useCallback(async (membership: TenantMembership) => {
    await setActiveTenantId(membership.tenantId);
  }, [setActiveTenantId]);

  const renderItem = useCallback(({ item }: { item: TenantMembership }) => (
    <TenantRow membership={item} onPress={handleSelect} />
  ), [handleSelect]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('selectCompany')}</Text>
      <Text style={styles.subtitle}>{t('selectCompanySubtitle')}</Text>

      {isError ? (
        <ErrorBanner message={t('tenantsError')} onRetry={refetch} retryTitle={t('retry')} style={styles.banner} />
      ) : null}

      {isLoading && !memberships ? (
        <FlatList data={skeletonData()} keyExtractor={(i) => i} renderItem={SkeletonRow} />
      ) : !isLoading && memberships?.length === 0 ? (
        <EmptyState
          icon="business"
          title={t('noTenants')}
          subtitle={t('noTenantsSubtitle')}
        />
      ) : (
        <FlatList
          data={memberships || []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
        />
      )}

      <View style={styles.actions}>
        <Button title={t('createCompany')} onPress={() => navigation.navigate('CreateTenant')} variant="secondary" />
        <View style={styles.gap} />
        <Button title={t('joinCompany')} onPress={() => navigation.navigate('JoinTenant')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { ...typography.h2, marginBottom: spacing.sm },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.lg },
  banner: { marginBottom: spacing.md },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  skeletonText: { flex: 1 },
  actions: { marginTop: spacing.lg },
  gap: { height: spacing.md },
});
