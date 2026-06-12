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
