import { api } from './client';
import * as SecureStore from 'expo-secure-store';
import type { User } from '@pulse-chat/shared';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';

export interface AuthResponse {
  user: User;
  tokens: { accessToken: string; refreshToken: string };
}

async function setTokens(accessToken: string, refreshToken: string) {
  await SecureStore.setItemAsync('accessToken', accessToken);
  await SecureStore.setItemAsync('refreshToken', refreshToken);
}

export async function register(payload: {
  email: string;
  password: string;
  displayName: string;
  tenantName: string;
}) {
  const { data } = await api.post<AuthResponse>('/auth/register', payload);
  await setTokens(data.tokens.accessToken, data.tokens.refreshToken);
  await useTenantStore.getState().initializeTenant(data.user.tenants);
  useAuthStore.getState().setUser(data.user);
  return data;
}

export async function login(payload: { email: string; password: string }) {
  const { data } = await api.post<AuthResponse>('/auth/login', payload);
  await setTokens(data.tokens.accessToken, data.tokens.refreshToken);
  await useTenantStore.getState().initializeTenant(data.user.tenants);
  useAuthStore.getState().setUser(data.user);
  return data;
}

export async function logout() {
  await SecureStore.deleteItemAsync('accessToken');
  await SecureStore.deleteItemAsync('refreshToken');
  useAuthStore.getState().setUser(null);
  await useTenantStore.getState().setActiveTenantId(null);
}
