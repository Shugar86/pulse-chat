import { api } from './client';
import * as SecureStore from 'expo-secure-store';
import type { User } from '@pulse-chat/shared';

export interface AuthResponse {
  user: User;
  tokens: { accessToken: string; refreshToken: string };
}

export async function register(payload: { email: string; password: string; displayName: string }) {
  const { data } = await api.post<AuthResponse>('/auth/register', payload);
  await SecureStore.setItemAsync('accessToken', data.tokens.accessToken);
  await SecureStore.setItemAsync('refreshToken', data.tokens.refreshToken);
  return data;
}

export async function login(payload: { email: string; password: string }) {
  const { data } = await api.post<AuthResponse>('/auth/login', payload);
  await SecureStore.setItemAsync('accessToken', data.tokens.accessToken);
  await SecureStore.setItemAsync('refreshToken', data.tokens.refreshToken);
  return data;
}

export async function logout() {
  await SecureStore.deleteItemAsync('accessToken');
  await SecureStore.deleteItemAsync('refreshToken');
}
