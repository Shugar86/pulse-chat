# Multitenancy Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` task-by-task.

**Goal:** Mobile app supports multiple tenants (companies). After authentication the user picks or creates a tenant; all API calls carry `X-Tenant-Id` and sockets are scoped to the active tenant.

**Architecture:** New `tenantStore` holds `activeTenantId`. `api/client.ts` injects the header. `AppNavigator` shows a `TenantNavigator` when no tenant is selected. New screens handle tenant selection, creation and invite-code join. Registration collects a company/tenant name.

**Tech Stack:** Expo / React Native, TypeScript, Zustand, Axios, React Navigation, i18next.

---

### Task 1: Tenant store

**Files:**
- Create: `apps/mobile/src/stores/tenantStore.ts`

- [ ] **Step 1: Write store**

```ts
import { create } from 'zustand';

interface TenantState {
  activeTenantId: string | null;
  setActiveTenant: (id: string | null) => void;
  clear: () => void;
}

export const useTenantStore = create<TenantState>((set) => ({
  activeTenantId: null,
  setActiveTenant: (id) => set({ activeTenantId: id }),
  clear: () => set({ activeTenantId: null }),
}));
```

- [ ] **Step 2: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile/src/stores/tenantStore.ts
git commit -m "feat(mobile): add tenant store"
```

---

### Task 2: API tenant header

**Files:**
- Modify: `apps/mobile/src/api/client.ts`

- [ ] **Step 1: Inject X-Tenant-Id from store**

Replace the request interceptor block with:

```ts
import { useTenantStore } from '../stores/tenantStore';

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const tenantId = useTenantStore.getState().activeTenantId;
  if (tenantId) config.headers['X-Tenant-Id'] = tenantId;
  return config;
});
```

Keep the rest of the file unchanged.

- [ ] **Step 2: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile/src/api/client.ts
git commit -m "feat(mobile): send X-Tenant-Id header on every request"
```

---

### Task 3: Tenant API module

**Files:**
- Create: `apps/mobile/src/api/tenants.ts`

- [ ] **Step 1: Write module**

```ts
import { api } from './client';
import type { TenantMembership } from '@pulse-chat/shared';

export type TenantMembershipResponse = TenantMembership;

export function listTenants() {
  return api.get<TenantMembershipResponse[]>('/tenants').then((r) => r.data);
}

export function createTenant(name: string) {
  return api.post<TenantMembershipResponse>('/tenants', { name }).then((r) => r.data);
}

export function createInvite(tenantId: string) {
  return api.post<{ code: string }>(`/tenants/${tenantId}/invites`).then((r) => r.data);
}

export function joinTenant(code: string) {
  return api.post<TenantMembershipResponse>('/tenants/join', { code }).then((r) => r.data);
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile/src/api/tenants.ts
git commit -m "feat(mobile): add tenants API module"
```

---

### Task 4: Update auth module

**Files:**
- Modify: `apps/mobile/src/api/auth.ts`

- [ ] **Step 1: Import tenant store and update register/logout**

Replace the file with:

```ts
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

function setInitialTenant(user: User) {
  if (user.tenants.length === 1) {
    useTenantStore.getState().setActiveTenant(user.tenants[0].tenantId);
  }
}

export async function register(payload: { email: string; password: string; displayName: string; tenantName: string }) {
  const { data } = await api.post<AuthResponse>('/auth/register', payload);
  await setTokens(data.tokens.accessToken, data.tokens.refreshToken);
  useAuthStore.getState().setUser(data.user);
  setInitialTenant(data.user);
  return data;
}

export async function login(payload: { email: string; password: string }) {
  const { data } = await api.post<AuthResponse>('/auth/login', payload);
  await setTokens(data.tokens.accessToken, data.tokens.refreshToken);
  useAuthStore.getState().setUser(data.user);
  setInitialTenant(data.user);
  return data;
}

export async function logout() {
  await SecureStore.deleteItemAsync('accessToken');
  await SecureStore.deleteItemAsync('refreshToken');
  useAuthStore.getState().setUser(null);
  useTenantStore.getState().clear();
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile/src/api/auth.ts
git commit -m "feat(mobile): auth sets initial tenant and logout clears it"
```

---

### Task 5: Tenant navigator and navigation types

**Files:**
- Modify: `apps/mobile/src/navigation/types.ts`
- Create: `apps/mobile/src/navigation/TenantNavigator.tsx`

- [ ] **Step 1: Add tenant stack types**

Append to `apps/mobile/src/navigation/types.ts`:

```ts
export type TenantStackParamList = {
  TenantSelect: undefined;
  CreateTenant: undefined;
  JoinTenant: undefined;
};
```

- [ ] **Step 2: Create TenantNavigator**

```tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TenantSelectScreen } from '../screens/TenantSelectScreen';
import { CreateTenantScreen } from '../screens/CreateTenantScreen';
import { JoinTenantScreen } from '../screens/JoinTenantScreen';
import type { TenantStackParamList } from './types';

const Stack = createNativeStackNavigator<TenantStackParamList>();

export function TenantNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TenantSelect" component={TenantSelectScreen} />
      <Stack.Screen name="CreateTenant" component={CreateTenantScreen} />
      <Stack.Screen name="JoinTenant" component={JoinTenantScreen} />
    </Stack.Navigator>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile/src/navigation/types.ts apps/mobile/src/navigation/TenantNavigator.tsx
git commit -m "feat(mobile): add tenant navigation stack"
```

---

### Task 6: Tenant selection screen

**Files:**
- Create: `apps/mobile/src/screens/TenantSelectScreen.tsx`

- [ ] **Step 1: Write screen**

```tsx
import React from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { colors, spacing, typography } from '../theme';
import type { TenantStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<TenantStackParamList, 'TenantSelect'>;

export function TenantSelectScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { setActiveTenant } = useTenantStore();
  const tenants = user?.tenants ?? [];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('tenants')}</Text>
      <FlatList
        data={tenants}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => setActiveTenant(item.tenantId)}>
            <Card style={styles.card}>
              <Text style={styles.name}>{item.tenant.name}</Text>
              <Text style={styles.role}>{item.role}</Text>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('noTenants')}</Text>
        }
        contentContainerStyle={styles.list}
      />
      <Button title={t('createTenant')} onPress={() => navigation.navigate('CreateTenant')} />
      <View style={styles.gap} />
      <Button title={t('joinTenant')} onPress={() => navigation.navigate('JoinTenant')} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl },
  title: { ...typography.h2, marginBottom: spacing.lg },
  list: { flexGrow: 1 },
  card: { marginBottom: spacing.md },
  name: { ...typography.bodySmall, fontWeight: '600' },
  role: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs, textTransform: 'capitalize' },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
  gap: { height: spacing.md },
});
```

- [ ] **Step 2: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile/src/screens/TenantSelectScreen.tsx
git commit -m "feat(mobile): add tenant selection screen"
```

---

### Task 7: Create tenant screen

**Files:**
- Create: `apps/mobile/src/screens/CreateTenantScreen.tsx`

- [ ] **Step 1: Write screen**

```tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createTenant } from '../api/tenants';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { ErrorBanner } from '../components/ErrorBanner';
import { colors, spacing, typography } from '../theme';
import type { TenantStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<TenantStackParamList, 'CreateTenant'>;

export function CreateTenantScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();
  const { setActiveTenant } = useTenantStore();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setError('');
    setLoading(true);
    try {
      const membership = await createTenant(name);
      setUser({ ...user!, tenants: [...(user?.tenants ?? []), membership] });
      setActiveTenant(membership.tenantId);
    } catch {
      setError(t('genericError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('createTenant')}</Text>
      {error ? <ErrorBanner message={error} style={styles.banner} /> : null}
      <Input label={t('tenantName')} placeholder={t('tenantName')} value={name} onChangeText={setName} />
      <Button title={t('createTenant')} onPress={handleCreate} loading={loading} disabled={loading || !name.trim()} />
      <View style={styles.gap} />
      <Button title={t('back')} onPress={() => navigation.goBack()} variant="ghost" fullWidth={false} style={styles.back} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl },
  title: { ...typography.h2, marginBottom: spacing.lg },
  banner: { marginBottom: spacing.md },
  gap: { height: spacing.md },
  back: { alignSelf: 'center' },
});
```

- [ ] **Step 2: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile/src/screens/CreateTenantScreen.tsx
git commit -m "feat(mobile): add create tenant screen"
```

---

### Task 8: Join tenant screen

**Files:**
- Create: `apps/mobile/src/screens/JoinTenantScreen.tsx`

- [ ] **Step 1: Write screen**

```tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { joinTenant } from '../api/tenants';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { ErrorBanner } from '../components/ErrorBanner';
import { colors, spacing, typography } from '../theme';
import type { TenantStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<TenantStackParamList, 'JoinTenant'>;

export function JoinTenantScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();
  const { setActiveTenant } = useTenantStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    setError('');
    setLoading(true);
    try {
      const membership = await joinTenant(code.trim());
      setUser({ ...user!, tenants: [...(user?.tenants ?? []), membership] });
      setActiveTenant(membership.tenantId);
    } catch {
      setError(t('genericError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('joinTenant')}</Text>
      {error ? <ErrorBanner message={error} style={styles.banner} /> : null}
      <Input label={t('inviteCode')} placeholder={t('inviteCode')} value={code} onChangeText={setCode} autoCapitalize="characters" />
      <Button title={t('joinTenant')} onPress={handleJoin} loading={loading} disabled={loading || !code.trim()} />
      <View style={styles.gap} />
      <Button title={t('back')} onPress={() => navigation.goBack()} variant="ghost" fullWidth={false} style={styles.back} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl },
  title: { ...typography.h2, marginBottom: spacing.lg },
  banner: { marginBottom: spacing.md },
  gap: { height: spacing.md },
  back: { alignSelf: 'center' },
});
```

- [ ] **Step 2: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile/src/screens/JoinTenantScreen.tsx
git commit -m "feat(mobile): add join tenant screen"
```

---

### Task 9: AppNavigator tenant gate

**Files:**
- Modify: `apps/mobile/src/navigation/AppNavigator.tsx`

- [ ] **Step 1: Render TenantNavigator when no active tenant**

Replace the file with:

```tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { TenantNavigator } from './TenantNavigator';
import { api } from '../api/client';

export function AppNavigator() {
  const { user, setUser } = useAuthStore();
  const { activeTenantId, setActiveTenant } = useTenantStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync('accessToken').then(async (token) => {
      if (token) {
        try {
          const { data } = await api.get('/users/me');
          setUser(data);
        } catch {
          await SecureStore.deleteItemAsync('accessToken');
        }
      }
      setLoading(false);
    });
  }, [setUser]);

  useEffect(() => {
    if (user && !activeTenantId && user.tenants.length === 1) {
      setActiveTenant(user.tenants[0].tenantId);
    }
  }, [user, activeTenantId, setActiveTenant]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) return <AuthNavigator />;
  if (!activeTenantId) return <TenantNavigator />;
  return <MainNavigator />;
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile/src/navigation/AppNavigator.tsx
git commit -m "feat(mobile): gate app behind active tenant selection"
```

---

### Task 10: Register screen with tenant name

**Files:**
- Modify: `apps/mobile/src/screens/RegisterScreen.tsx`

- [ ] **Step 1: Add company/tenant name input**

Edit the state and form:

```tsx
const [displayName, setDisplayName] = useState('');
const [tenantName, setTenantName] = useState('');
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
```

Add an Input before displayName or after:

```tsx
<Input label={t('companyName')} placeholder={t('companyName')} value={tenantName} onChangeText={setTenantName} />
```

Update `handleRegister`:

```tsx
const handleRegister = async () => {
  setError('');
  setLoading(true);
  try {
    const { user } = await register({ email, password, displayName, tenantName });
    setUser(user);
  } catch {
    setError(t('registerFailed'));
  } finally {
    setLoading(false);
  }
};
```

Disable button when `tenantName` is empty:

```tsx
<Button title={t('register')} onPress={handleRegister} loading={loading} disabled={loading || !displayName.trim() || !tenantName.trim() || !email.trim() || !password.trim()} />
```

- [ ] **Step 2: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile/src/screens/RegisterScreen.tsx
git commit -m "feat(mobile): add company name to registration"
```

---

### Task 11: Profile tenant switcher

**Files:**
- Modify: `apps/mobile/src/screens/ProfileScreen.tsx`

- [ ] **Step 1: Show active tenant and switch button**

Replace the file with:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { logout } from '../api/auth';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';
import { setLanguage } from '../i18n';
import { Card } from '../components/Card';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { colors, spacing, typography } from '../theme';

export function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, setUser } = useAuthStore();
  const { activeTenantId, setActiveTenant } = useTenantStore();
  const activeTenant = user?.tenants.find((m) => m.tenantId === activeTenantId)?.tenant;

  const toggleLanguage = async () => {
    const next = i18n.language === 'ru' ? 'en' : 'ru';
    await setLanguage(next);
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Avatar uri={user?.avatarUrl} name={user?.displayName || '?'} size="lg" />
        <Text style={styles.name}>{user?.displayName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.divider} />
        {activeTenant ? (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>{t('tenant')}</Text>
              <Text style={styles.value}>{activeTenant.name}</Text>
            </View>
            <Button title={t('switchTenant')} onPress={() => setActiveTenant(null)} variant="secondary" />
            <View style={styles.gap} />
          </>
        ) : null}
        <View style={styles.row}>
          <Text style={styles.label}>{t('language')}</Text>
          <Text style={styles.value}>{i18n.language.toUpperCase()}</Text>
        </View>
        <Button title={`${t('language')}: ${i18n.language.toUpperCase()}`} onPress={toggleLanguage} variant="secondary" />
        <View style={styles.gap} />
        <Button title={t('logout')} onPress={handleLogout} variant="danger" />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.xl },
  card: { alignItems: 'center', width: '100%' },
  name: { ...typography.h3, marginTop: spacing.lg, textAlign: 'center' },
  email: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  divider: { height: 1, backgroundColor: colors.border, width: '100%', marginVertical: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: spacing.md },
  label: { ...typography.body, color: colors.textSecondary },
  value: { ...typography.body, fontWeight: '600', color: colors.primary },
  gap: { height: spacing.md },
});
```

- [ ] **Step 2: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile/src/screens/ProfileScreen.tsx
git commit -m "feat(mobile): show active tenant and allow switching"
```

---

### Task 12: Scope socket by tenant

**Files:**
- Modify: `apps/mobile/src/context/SocketContext.tsx`

- [ ] **Step 1: Pass tenantId in handshake and reconnect on change**

Replace the file with:

```tsx
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const { activeTenantId } = useTenantStore();

  useEffect(() => {
    SecureStore.getItemAsync('accessToken').then(() => {
      setAuthResolved(true);
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !activeTenantId) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    SecureStore.getItemAsync('accessToken').then((token) => {
      if (!token) return;
      const API_URL = (process.env as Record<string, string | undefined>).EXPO_PUBLIC_API_URL || 'http://localhost:4000';
      const socket = io(API_URL, { auth: { token, tenantId: activeTenantId } });
      socketRef.current = socket;
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, activeTenantId]);

  return (
    <SocketContext.Provider value={socketRef.current}>
      {authResolved ? children : null}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile/src/context/SocketContext.tsx
git commit -m "feat(mobile): scope socket connection to active tenant"
```

---

### Task 13: i18n keys

**Files:**
- Modify: `apps/mobile/src/i18n/locales/en.json`
- Modify: `apps/mobile/src/i18n/locales/ru.json`

- [ ] **Step 1: Add English keys**

Add these keys to `en.json`:

```json
  "tenant": "Company",
  "tenants": "Companies",
  "createTenant": "Create company",
  "joinTenant": "Join company",
  "tenantName": "Company name",
  "companyName": "Company name",
  "inviteCode": "Invite code",
  "switchTenant": "Switch company",
  "noTenants": "No companies yet",
  "back": "Back"
```

- [ ] **Step 2: Add Russian keys**

Add these keys to `ru.json`:

```json
  "tenant": "Компания",
  "tenants": "Компании",
  "createTenant": "Создать компанию",
  "joinTenant": "Присоединиться к компании",
  "tenantName": "Название компании",
  "companyName": "Название компании",
  "inviteCode": "Код приглашения",
  "switchTenant": "Сменить компанию",
  "noTenants": "Пока нет компаний",
  "back": "Назад"
```

- [ ] **Step 3: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile/src/i18n/locales/en.json apps/mobile/src/i18n/locales/ru.json
git commit -m "feat(mobile): add tenant i18n keys"
```

---

### Task 14: Final mobile verification

- [ ] **Step 1: Type-check**

```bash
cd /home/shugar/dev/pulse-chat/apps/mobile && pnpm exec tsc --noEmit
```

- [ ] **Step 2: Fix any errors**

If `User` from `@pulse-chat/shared` lacks `tenants`, ensure the shared package was rebuilt/republished locally. In a pnpm workspace the symlink is enough, but run:

```bash
cd /home/shugar/dev/pulse-chat/packages/shared && pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit fixes**

```bash
cd /home/shugar/dev/pulse-chat
git add -A
git commit -m "fix(mobile): multitenancy type-check fixes"
```

---

## Self-review

1. **Spec coverage:** tenant selection, creation, join, header injection, socket scoping, registration field, profile switcher.
2. **Placeholder scan:** no TBD/TODO.
3. **Type consistency:** `TenantMembership`, `TenantStackParamList`, `activeTenantId` used consistently.
