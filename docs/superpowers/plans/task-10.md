### Task 10: Mobile API client and auth store

**Files:**
- Create: `apps/mobile/src/api/client.ts`
- Create: `apps/mobile/src/api/auth.ts`
- Create: `apps/mobile/src/stores/authStore.ts`

- [ ] **Step 1: Write `apps/mobile/src/api/client.ts`**

```typescript
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export const api = axios.create({ baseURL: `${API_URL}/api` });

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

- [ ] **Step 2: Write `apps/mobile/src/api/auth.ts`**

```typescript
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
```

- [ ] **Step 3: Write `apps/mobile/src/stores/authStore.ts`**

```typescript
import { create } from 'zustand';
import type { User } from '@pulse-chat/shared';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
}));
```

- [ ] **Step 4: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile
git commit -m "feat(mobile): API client, auth helpers and Zustand auth store"
```

---

