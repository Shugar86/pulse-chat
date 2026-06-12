import React, { useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Chat, ChatMember } from '@pulse-chat/shared';
import { listChats } from '../api/chats';
import { useAuthStore } from '../stores/authStore';
import { ListItem } from '../components/ListItem';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { Skeleton } from '../components/Skeleton';
import { colors, radius, spacing, typography } from '../theme';
import type { ChatStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatsList'>;

const SKELETON_DATA = Array.from({ length: 6 }, (_, i) => `skeleton-${i}`);

function formatTime(dateString?: string) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function titleFor(chat: Chat, userId: string | undefined, t: (key: string) => string) {
  if (chat.title) return chat.title;
  const other = chat.members.find((m: ChatMember) => m.user.id !== userId)?.user;
  return other?.displayName || t('unknown');
}

function avatarNameFor(chat: Chat, userId: string | undefined) {
  if (chat.title) return chat.title;
  const other = chat.members.find((m: ChatMember) => m.user.id !== userId)?.user;
  return other?.displayName || '?';
}

function lastMessageFor(chat: Chat, userId: string | undefined) {
  const last = chat.messages?.[0];
  if (!last) return '';
  const prefix = chat.type === 'group' && last.author.id !== userId ? `${last.author.displayName}: ` : '';
  return `${prefix}${last.content}`;
}

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

interface ChatRowProps {
  chat: Chat;
  onPress: (chat: Chat) => void;
}

function ChatRow({ chat, onPress }: ChatRowProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const userId = user?.id;
  return (
    <ListItem
      title={titleFor(chat, userId, t)}
      subtitle={lastMessageFor(chat, userId)}
      avatarName={avatarNameFor(chat, userId)}
      onPress={() => onPress(chat)}
      trailing={
        <View style={styles.trailing}>
          <Text style={styles.time}>{formatTime(chat.messages?.[0]?.createdAt)}</Text>
          <Badge count={0} />
        </View>
      }
    />
  );
}

export function ChatsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { data: chats, isPending, isError, refetch } = useQuery({ queryKey: ['chats'], queryFn: listChats });

  const handlePress = useCallback((chat: Chat) => {
    navigation.navigate('Chat', { chatId: chat.id, title: titleFor(chat, user?.id, t) });
  }, [navigation, user?.id, t]);

  const renderItem = useCallback(({ item }: { item: Chat }) => (
    <ChatRow chat={item} onPress={handlePress} />
  ), [handlePress]);

  if (isPending && !chats) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('chats')}</Text>
        <FlatList data={SKELETON_DATA} keyExtractor={(i) => i} renderItem={SkeletonRow} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('chats')}</Text>
      {isError ? <ErrorBanner message={t('chatsError')} onRetry={refetch} retryTitle={t('retry')} style={styles.banner} /> : null}
      {!isPending && chats?.length === 0 ? (
        <EmptyState
          icon="chatbubbles"
          title={t('noMessages')}
          subtitle={t('noMessagesSubtitle')}
          actionTitle={t('findContacts')}
          onAction={() => navigation.getParent()?.navigate('ContactsTab' as never)}
        />
      ) : (
        <FlatList
          data={chats || []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={isPending} onRefresh={refetch} tintColor={colors.primary} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { ...typography.h2, marginBottom: spacing.lg },
  banner: { marginBottom: spacing.md },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  skeletonText: { flex: 1 },
  trailing: { alignItems: 'flex-end' },
  time: { ...typography.caption, marginBottom: spacing.xs },
});
