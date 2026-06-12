export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  preferredLanguage: 'ru' | 'en';
  createdAt: string;
  lastSeenAt: string;
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  title: string | null;
  avatarUrl: string | null;
  updatedAt: string;
  members: ChatMember[];
}

export interface ChatMember {
  id: string;
  userId: string;
  role: 'member' | 'admin' | 'owner';
  user: User;
}

export interface Message {
  id: string;
  chatId: string;
  authorId: string;
  type: 'text' | 'audio' | 'call';
  content: string;
  createdAt: string;
  editedAt: string | null;
  author: User;
  readBy: { userId: string; readAt: string }[];
}
