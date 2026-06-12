import React, { useState, useCallback } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listContacts, searchUsers, addContact, updateContact, type Contact, type User } from '../api/contacts';
import { Input } from '../components/Input';
import { ListItem } from '../components/ListItem';
import { Button } from '../components/Button';
import { IconButton } from '../components/IconButton';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { Skeleton } from '../components/Skeleton';
import { colors, spacing, radius } from '../theme';

const skeletonData = () => Array.from({ length: 6 }, (_, i) => `skeleton-${i}`);

export function ContactsScreen() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const queryClient = useQueryClient();
  const { data: contacts, isLoading: contactsLoading, isError: contactsError, refetch } = useQuery({ queryKey: ['contacts'], queryFn: listContacts });
  const { data: searchResults, isLoading: searchLoading, isError: searchError } = useQuery({
    queryKey: ['users', 'search', query],
    queryFn: () => searchUsers(query),
    enabled: query.length > 2,
  });

  const addMutation = useMutation({
    mutationFn: addContact,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'accepted' | 'blocked' | 'removed' }) => updateContact(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);
  const showSearch = query.length > 2;

  const renderSearchItem = ({ item }: { item: User }) => (
    <ListItem
      title={item.displayName}
      subtitle={item.email}
      avatarName={item.displayName}
      trailing={<IconButton icon="add" onPress={() => addMutation.mutate(item.id)} />}
    />
  );

  const renderContactItem = ({ item }: { item: Contact }) => (
    <ListItem
      title={item.target.displayName}
      subtitle={t(`contactStatus_${item.status}`)}
      avatarName={item.target.displayName}
      trailing={
        <View style={styles.actions}>
          {item.status === 'pending' ? (
            <Button
              title={t('accept')}
              onPress={() => updateMutation.mutate({ id: item.id, status: 'accepted' })}
              variant="primary"
              fullWidth={false}
              style={styles.actionButton}
              textStyle={styles.actionText}
            />
          ) : null}
          <Button
            title={t('remove')}
            onPress={() => updateMutation.mutate({ id: item.id, status: 'removed' })}
            variant="ghost"
            fullWidth={false}
            style={styles.actionButton}
            textStyle={styles.removeText}
          />
        </View>
      }
    />
  );

  const renderSkeleton = () => (
    <View style={styles.skeletonRow}>
      <Skeleton width={44} height={44} style={{ borderRadius: radius.full }} />
      <View style={styles.skeletonText}>
        <Skeleton width="60%" height={16} style={{ marginBottom: 8 }} />
        <Skeleton width="40%" height={12} />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Input
        placeholder={t('search')}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        style={styles.search}
      />
      {searchError ? <ErrorBanner message={t('searchError')} style={styles.banner} /> : null}

      {showSearch ? (
        searchLoading ? (
          <FlatList data={skeletonData()} keyExtractor={(i) => i} renderItem={renderSkeleton} />
        ) : searchResults?.length === 0 ? (
          <EmptyState icon="search" title={t('noSearchResults')} subtitle={t('noSearchResultsSubtitle')} />
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={renderSearchItem}
          />
        )
      ) : null}

      {!showSearch ? <View style={styles.divider} /> : null}

      {!showSearch && contactsError ? (
        <ErrorBanner message={t('contactsError')} onRetry={refetch} retryTitle={t('retry')} style={styles.banner} />
      ) : null}

      {!showSearch && contactsLoading && !contacts ? (
        <FlatList data={skeletonData()} keyExtractor={(i) => i} renderItem={renderSkeleton} />
      ) : null}

      {!showSearch && !contactsLoading && contacts?.length === 0 ? (
        <EmptyState icon="people" title={t('noContacts')} subtitle={t('noContactsSubtitle')} />
      ) : null}

      {!showSearch ? (
        <FlatList
          data={contacts || []}
          keyExtractor={(item) => item.id}
          renderItem={renderContactItem}
          refreshControl={<RefreshControl refreshing={contactsLoading} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  search: { marginBottom: spacing.md },
  banner: { marginBottom: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  skeletonText: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actionButton: { paddingVertical: 8, paddingHorizontal: 12 },
  actionText: { fontSize: 13 },
  removeText: { color: colors.error, fontSize: 13 },
});
