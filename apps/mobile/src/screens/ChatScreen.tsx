import React, { useEffect, useState } from 'react';
import { View, TextInput, Button, FlatList, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { listMessages, sendMessage, readMessage } from '../api/chats';
import { useSocket } from '../context/SocketContext';
import { useAuthStore } from '../stores/authStore';
import type { Message } from '@pulse-chat/shared';
import type { ChatStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ChatStackParamList, 'Chat'>;

export function ChatScreen({ route }: Props) {
  const { chatId, title } = route.params;
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const { data: messages } = useQuery({ queryKey: ['messages', chatId], queryFn: () => listMessages(chatId) });
  const sendMutation = useMutation({
    mutationFn: (content: string) => sendMessage(chatId, content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages', chatId] }),
  });

  useEffect(() => {
    if (!socket) return;
    socket.emit('chat:join', { chatId });
    const onNew = (msg: Message) => {
      if (msg.chatId !== chatId) return;
      queryClient.setQueryData(['messages', chatId], (old: Message[] = []) => [...old, msg]);
      if (msg.authorId !== user?.id) readMessage(msg.id).catch(() => {});
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <FlatList
        data={messages || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.bubble}>
            <Text style={styles.author}>{item.author.displayName}</Text>
            <Text>{item.content}</Text>
            <Text style={styles.meta}>{item.readBy.length > 0 ? '✓✓' : '✓'}</Text>
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={text} onChangeText={setText} placeholder={t('send')} />
        <Button title={t('send')} onPress={() => { sendMutation.mutate(text); setText(''); }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  bubble: { backgroundColor: '#f0f0f0', borderRadius: 8, padding: 10, marginBottom: 8 },
  author: { fontWeight: '600', marginBottom: 2 },
  meta: { fontSize: 11, color: '#888', marginTop: 2 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
});
