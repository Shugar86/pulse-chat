import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Chat, ChatMember } from '@pulse-chat/shared';
import { listChats } from '../api/chats';
import { useAuthStore } from '../stores/authStore';
import type { ChatStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatsList'>;

export function ChatsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { data: chats } = useQuery({ queryKey: ['chats'], queryFn: listChats });

  const titleFor = (chat: Chat) => {
    if (chat.title) return chat.title;
    const other = chat.members.find((m: ChatMember) => m.user.id !== user?.id)?.user;
    return other?.displayName || t('chats');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('chats')}</Text>
      <FlatList
        data={chats || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Chat', { chatId: item.id, title: titleFor(item) })}>
            <Text style={styles.name}>{titleFor(item)}</Text>
            <Text style={styles.preview}>{item.messages?.[0]?.content || ''}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  name: { fontSize: 16, fontWeight: '600' },
  preview: { color: '#666', marginTop: 4 },
});
