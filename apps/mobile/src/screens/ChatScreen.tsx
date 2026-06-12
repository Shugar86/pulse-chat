import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { listMessages, sendMessage, readMessage } from '../api/chats';
import { useSocket } from '../context/SocketContext';
import { useAuthStore } from '../stores/authStore';
import type { Message } from '@pulse-chat/shared';
import { Input } from '../components/Input';
import { IconButton } from '../components/IconButton';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { colors, radius, spacing, typography } from '../theme';
import type { ChatStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ChatStackParamList, 'Chat'>;

function formatTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface MessageBubbleProps {
  item: Message;
  currentUserId?: string;
}

function MessageBubble({ item, currentUserId }: MessageBubbleProps) {
  const isMe = item.authorId === currentUserId;
  return (
    <View style={[styles.row, isMe ? styles.rowRight : styles.rowLeft]}>
      {!isMe ? <Avatar uri={item.author.avatarUrl} name={item.author.displayName} size="sm" /> : <View style={styles.avatarSpacer} />}
      <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
        {!isMe ? <Text style={styles.authorName}>{item.author.displayName}</Text> : null}
        <Text style={[styles.content, isMe && styles.myContent]}>{item.content}</Text>
        <Text style={[styles.meta, isMe && styles.myMeta]}>
          {formatTime(item.createdAt)} {item.readBy.length > 0 ? '✓✓' : '✓'}
        </Text>
      </View>
    </View>
  );
}

export function ChatScreen({ route }: Props) {
  const { chatId, title } = route.params;
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const { data: messages, isPending, isError, refetch } = useQuery({ queryKey: ['messages', chatId], queryFn: () => listMessages(chatId) });

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendMessage(chatId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
      setText('');
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    },
  });

  useEffect(() => {
    if (!socket) return;
    socket.emit('chat:join', { chatId });
    const onNew = (msg: Message) => {
      if (msg.chatId !== chatId) return;
      queryClient.setQueryData(['messages', chatId], (old: Message[] = []) => [...old, msg]);
      if (msg.authorId !== user?.id) readMessage(msg.id).catch(() => {});
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    };
    const onRead = () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
    };
    socket.on('message:new', onNew);
    socket.on('message:read', onRead);
    return () => {
      socket.off('message:new', onNew);
      socket.off('message:read', onRead);
      socket.emit('chat:leave', { chatId });
    };
  }, [socket, chatId, queryClient, user?.id]);

  const handleSend = () => {
    const content = text.trim();
    if (!content) return;
    sendMutation.mutate(content);
  };

  const renderItem = useCallback(({ item }: { item: Message }) => (
    <MessageBubble item={item} currentUserId={user?.id} />
  ), [user?.id]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <View style={styles.header}>
        <Avatar name={title || t('unknown')} size="sm" />
        <Text style={styles.headerTitle} numberOfLines={1}>{title || t('unknown')}</Text>
      </View>

      {isError ? <ErrorBanner message={t('messagesError')} onRetry={refetch} retryTitle={t('retry')} style={styles.banner} /> : null}

      {!isPending && messages?.length === 0 ? (
        <EmptyState icon="chatbubble" title={t('emptyChat')} subtitle={t('emptyChatSubtitle')} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages || []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      <View style={styles.footer}>
        <Input placeholder={t('messagePlaceholder')} value={text} onChangeText={setText} style={styles.input} />
        <IconButton icon="send" onPress={handleSend} disabled={!text.trim() || sendMutation.isPending} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, paddingTop: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.h3, flex: 1 },
  banner: { margin: spacing.lg, marginBottom: 0 },
  list: { padding: spacing.lg, paddingBottom: spacing.md },
  row: { flexDirection: 'row', marginBottom: spacing.md, gap: spacing.sm },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end', flexDirection: 'row-reverse' },
  avatarSpacer: { width: 36 },
  bubble: { maxWidth: '75%', padding: spacing.md, borderRadius: radius.lg },
  theirBubble: { backgroundColor: colors.surfaceAlt, borderBottomLeftRadius: radius.sm },
  myBubble: { backgroundColor: colors.primary, borderBottomRightRadius: radius.sm },
  authorName: { ...typography.caption, color: colors.secondary, marginBottom: 2 },
  content: { ...typography.bodySmall, color: colors.text },
  myContent: { color: colors.surface },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs, alignSelf: 'flex-end' },
  myMeta: { color: colors.surface, opacity: 0.7 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, marginBottom: 0 },
});
