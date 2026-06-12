import { api } from './client';

export interface Contact {
  id: string;
  status: 'pending' | 'accepted' | 'blocked';
  target: { id: string; email: string; displayName: string; avatarUrl: string | null };
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

export function searchUsers(q: string) {
  return api.get<User[]>('/users/search', { params: { q } }).then((r) => r.data);
}

export function listContacts() {
  return api.get<Contact[]>('/contacts').then((r) => r.data);
}

export function addContact(targetId: string) {
  return api.post<Contact>('/contacts', { targetId }).then((r) => r.data);
}

export function updateContact(id: string, status: 'accepted' | 'blocked' | 'removed') {
  return api.patch<Contact>(`/contacts/${id}`, { status }).then((r) => r.data);
}
