### Task 13: Mobile chats list and chat screen

**Files:**
- Create: `apps/mobile/src/api/chats.ts`
- Create: `apps/mobile/src/context/SocketContext.tsx`
- Modify: `apps/mobile/src/navigation/MainNavigator.tsx` (ensure Chat screen in stack)
- Create: `apps/mobile/src/screens/ChatsScreen.tsx`
- Create: `apps/mobile/src/screens/ChatScreen.tsx`

- [ ] **Step 1: Write `apps/mobile/src/api/chats.ts`**

```typescript
import { api } from './client';
import type { Chat, Message } from '@pulse-chat/shared';

export function listChats() {
  return api.get<Chat[]>('/chats').then((r) => r.data);
}

export function createGroupChat(title: string, memberIds: string[]) {
  return api.post<Chat>('/chats', { title, memberIds }).then((r) => r.data);
}

export function listMessages(chatId: string) {
  return api.get<Message[]>(`/chats/${chatId}/messages`).then((r) => r.data);
}

export function sendMessage(chatId: string, content: string) {
  return api.post<Message>(`/chats/${chatId}/messages`, { content }).then((r) => r.data);
}

export function readMessage(messageId: string) {
  return api.post(`/chats/messages/${messageId}/read`).then((r) => r.data);
}
```

- [ ] **Step 2: Write `apps/mobile/src/context/SocketContext.tsx`**

```tsx
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('accessToken').then((token) => {
      if (!token) {
        setReady(true);
        return;
      }
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
      const socket = io(API_URL, { auth: { token } });
      socketRef.current = socket;
      socket.on('connect', () => setReady(true));
      socket.on('disconnect', () => setReady(false));
    });
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return <SocketContext.Provider value={socketRef.current}>{ready ? children : null}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
```

- [ ] **Step 3: Write `apps/mobile/src/screens/ChatsScreen.tsx`**

```tsx
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { listChats } from '../api/chats';
import { useAuthStore } from '../stores/authStore';

type Props = NativeStackScreenProps<any>;

export function ChatsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { data: chats } = useQuery({ queryKey: ['chats'], queryFn: listChats });

  const titleFor = (chat: any) => {
    if (chat.title) return chat.title;
    const other = chat.members.find((m: any) => m.user.id !== user?.id)?.user;
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
```

- [ ] **Step 4: Write `apps/mobile/src/screens/ChatScreen.tsx`**

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput, Button, FlatList, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { listMessages, sendMessage, readMessage } from '../api/chats';
import { useSocket } from '../context/SocketContext';
import { useAuthStore } from '../stores/authStore';
import type { Message } from '@pulse-chat/shared';

type Props = NativeStackScreenProps<any>;

export function ChatScreen({ route }: Props) {
  const { chatId, title } = route.params as { chatId: string; title: string };
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
      if (msg.authorId !== user?.id) readMessage(msg.id);
    };
    const onRead = ({ messageId }: { messageId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
    };
    socket.on('message:new', onNew);
    socket.on('message:read', onRead);
    return () => {
      socket.off('message:new', onNew);
      socket.off('message:read', onRead);
      socket.emit('chat:leave', { chatId });
    };
  }, [socket, chatId, queryClient]);

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
```

- [ ] **Step 5: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile
git commit -m "feat(mobile): chat list, chat screen and socket context"
```

---

