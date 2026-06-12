# Phase 1 Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Привести мобильное приложение pulse-chat к единой теме «Тёплый слейт», заменив сырые экраны прототипа на консистентные компоненты, пустые/ошибочные состояния и мягкие анимации.

**Architecture:** Все визуальные примитивы вынесены в `theme/index.ts` и `components/`. Экраны (`screens/*`) компонуют готовые компоненты и не содержат inline-стилей. Анимации — через `Animated` API, без внешних зависимостей кроме `@expo/vector-icons`.

**Tech Stack:** Expo SDK 52, React Native 0.76, TypeScript, React Navigation 7, i18next, `@expo/vector-icons`.

---

## File map

```
apps/mobile/src/
├── theme/
│   └── index.ts              # colors, spacing, radius, shadows, typography
├── components/
│   ├── Button.tsx            # primary/secondary/ghost, loading, disabled, press-scale
│   ├── Input.tsx             # label, error state
│   ├── Card.tsx              # white surface card
│   ├── Avatar.tsx            # image/initials, online indicator
│   ├── Badge.tsx             # unread/status count
│   ├── ListItem.tsx          # avatar + title/subtitle + trailing
│   ├── EmptyState.tsx        # icon + title + subtitle + action
│   ├── Skeleton.tsx          # pulsing placeholder
│   ├── Loading.tsx           # spinner
│   ├── ErrorBanner.tsx       # inline error with retry
│   └── IconButton.tsx        # circular icon button
├── screens/
│   ├── WelcomeScreen.tsx     # refactored
│   ├── LoginScreen.tsx       # refactored
│   ├── RegisterScreen.tsx    # refactored
│   ├── ChatsScreen.tsx       # refactored with ListItem/EmptyState/Skeleton
│   ├── ContactsScreen.tsx    # refactored with actions/EmptyState
│   ├── ChatScreen.tsx        # refactored bubbles/input/EmptyState
│   └── ProfileScreen.tsx     # refactored
├── i18n/
│   ├── locales/en.json       # new keys
│   └── locales/ru.json       # new keys
└── api/
    └── contacts.ts           # add User export already present; no changes
```

---

### Pre-task: Create branch

```bash
cd /home/shugar/dev/pulse-chat
git checkout -b phase1-polish
```

---

### Task 1: Theme tokens

**Files:**
- Create: `apps/mobile/src/theme/index.ts`

- [ ] **Step 1: Create theme tokens file**

```typescript
export const colors = {
  background: '#F8F6F3',
  surface: '#FFFFFF',
  surfaceAlt: '#F0EDE9',
  primary: '#5D6B7A',
  secondary: '#73685F',
  text: '#332E2A',
  textSecondary: '#8D8177',
  textTertiary: '#A89E92',
  border: '#E2DCD4',
  success: '#4A7C59',
  error: '#B54242',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  lg: {
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
} as const;

export const typography = {
  h1: { fontSize: 30, fontWeight: '700' as const, color: colors.text },
  h2: { fontSize: 24, fontWeight: '700' as const, color: colors.text },
  h3: { fontSize: 20, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 16, fontWeight: '400' as const, color: colors.text },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, color: colors.text },
  caption: { fontSize: 12, fontWeight: '400' as const, color: colors.textSecondary },
} as const;
```

- [ ] **Step 2: Run type-check**

```bash
cd /home/shugar/dev/pulse-chat/apps/mobile && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile/src/theme/index.ts
git commit -m "feat(mobile): theme tokens for warm slate polish"
```

---

### Task 2: Core components — Button, Input, Card

**Files:**
- Create: `apps/mobile/src/components/Button.tsx`
- Create: `apps/mobile/src/components/Input.tsx`
- Create: `apps/mobile/src/components/Card.tsx`

- [ ] **Step 1: Add `@expo/vector-icons` dependency**

```bash
cd /home/shugar/dev/pulse-chat/apps/mobile
pnpm add @expo/vector-icons
```

- [ ] **Step 2: Write Button.tsx**

```tsx
import React, { useRef } from 'react';
import { Pressable, Animated, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { colors, radius, typography } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, fullWidth = true, style, textStyle }: ButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 5 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
  };

  const isDisabled = disabled || loading;
  const containerStyle = [
    styles.base,
    variant === 'primary' && styles.primary,
    variant === 'secondary' && styles.secondary,
    variant === 'ghost' && styles.ghost,
    variant === 'danger' && styles.danger,
    isDisabled && styles.disabled,
    style,
  ];

  const titleStyle = [
    styles.text,
    variant === 'primary' && styles.primaryText,
    variant === 'secondary' && styles.secondaryText,
    variant === 'ghost' && styles.ghostText,
    variant === 'danger' && styles.dangerText,
    textStyle,
  ];

  return (
    <Animated.View style={{ transform: [{ scale }], width: fullWidth ? '100%' : undefined }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        style={({ pressed }) => [containerStyle, pressed && !isDisabled && styles.pressed]}
      >
        {loading ? (
          <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? colors.surface : colors.primary} />
        ) : (
          <Text style={titleStyle}>{title}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.error },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.9 },
  text: { ...typography.bodySmall, fontWeight: '600' },
  primaryText: { color: colors.surface },
  secondaryText: { color: colors.primary },
  ghostText: { color: colors.primary },
  dangerText: { color: colors.surface },
});
```

- [ ] **Step 3: Write Input.tsx**

```tsx
import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...rest }: InputProps) {
  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        placeholderTextColor={colors.textTertiary}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  label: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    ...typography.body,
  },
  inputError: { borderColor: colors.error },
  error: { ...typography.caption, color: colors.error, marginTop: spacing.sm },
});
```

- [ ] **Step 4: Write Card.tsx**

```tsx
import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { colors, radius, shadows, spacing } from '../theme';

export function Card({ children, style, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadows.md,
  },
});
```

- [ ] **Step 5: Run type-check**

```bash
cd /home/shugar/dev/pulse-chat/apps/mobile && pnpm exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile/src/components apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat(mobile): Button, Input, Card components"
```

---

### Task 3: Components — Avatar, Badge, ListItem

**Files:**
- Create: `apps/mobile/src/components/Avatar.tsx`
- Create: `apps/mobile/src/components/Badge.tsx`
- Create: `apps/mobile/src/components/ListItem.tsx`

- [ ] **Step 1: Write Avatar.tsx**

```tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

type Size = 'sm' | 'md' | 'lg';

interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: Size;
  online?: boolean;
}

const sizeMap = { sm: 36, md: 44, lg: 72 };
const fontMap = { sm: 14, md: 16, lg: 28 };

export function Avatar({ uri, name, size = 'md', online }: AvatarProps) {
  const diameter = sizeMap[size];
  const fontSize = fontMap[size];
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <View style={[styles.wrapper, { width: diameter, height: diameter }]}>
      {uri ? (
        <Image source={{ uri }} style={[styles.image, { width: diameter, height: diameter, borderRadius: diameter / 2 }]} />
      ) : (
        <View style={[styles.fallback, { width: diameter, height: diameter, borderRadius: diameter / 2 }]}>
          <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
        </View>
      )}
      {online && <View style={styles.onlineIndicator} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },
  image: { backgroundColor: colors.surfaceAlt },
  fallback: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  initials: { color: colors.secondary, fontWeight: '600' },
  onlineIndicator: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
```

- [ ] **Step 2: Write Badge.tsx**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, typography } from '../theme';

interface BadgeProps {
  count?: number;
  text?: string;
}

export function Badge({ count, text }: BadgeProps) {
  if (count !== undefined && count <= 0) return null;
  const label = text ?? (count && count > 99 ? '99+' : String(count ?? ''));
  if (!label) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  text: { color: colors.surface, ...typography.caption, fontWeight: '600' },
});
```

- [ ] **Step 3: Write ListItem.tsx**

```tsx
import React, { useEffect, useRef } from 'react';
import { Pressable, Animated, Text, View, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '../theme';
import { Avatar } from './Avatar';

interface ListItemProps {
  title: string;
  subtitle?: string;
  avatarUri?: string | null;
  avatarName?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export function ListItem({ title, subtitle, avatarUri, avatarName, trailing, onPress, style }: ListItemProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  }, []);

  const content = (
    <Animated.View style={[styles.row, { opacity, transform: [{ translateY }] }, style]}>
      {avatarName ? <Avatar uri={avatarUri} name={avatarName} size="md" /> : null}
      <View style={styles.textContainer}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </Animated.View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  textContainer: { flex: 1, justifyContent: 'center' },
  title: { ...typography.bodySmall, fontWeight: '600', color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  trailing: { alignItems: 'flex-end' },
});
```

- [ ] **Step 4: Run type-check**

```bash
cd /home/shugar/dev/pulse-chat/apps/mobile && pnpm exec tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile/src/components
git commit -m "feat(mobile): Avatar, Badge, ListItem components"
```

---

### Task 4: Components — EmptyState, Skeleton, Loading, ErrorBanner, IconButton

**Files:**
- Create: `apps/mobile/src/components/EmptyState.tsx`
- Create: `apps/mobile/src/components/Skeleton.tsx`
- Create: `apps/mobile/src/components/Loading.tsx`
- Create: `apps/mobile/src/components/ErrorBanner.tsx`
- Create: `apps/mobile/src/components/IconButton.tsx`

- [ ] **Step 1: Write EmptyState.tsx**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';
import { Button } from './Button';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface EmptyStateProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  actionTitle?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, subtitle, actionTitle, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color={colors.textTertiary} />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionTitle && onAction ? (
        <View style={styles.action}>
          <Button title={actionTitle} onPress={onAction} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  title: { ...typography.h3, marginTop: spacing.lg, textAlign: 'center' },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
  action: { marginTop: spacing.xl, width: '100%' },
});
```

- [ ] **Step 2: Write Skeleton.tsx**

```tsx
import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '../theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, opacity },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
  },
});
```

- [ ] **Step 3: Write Loading.tsx**

```tsx
import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { colors } from '../theme';

export function Loading() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 4: Write ErrorBanner.tsx**

```tsx
import React from 'react';
import { View, Text, StyleSheet, ViewProps } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { Button } from './Button';

interface ErrorBannerProps extends ViewProps {
  message: string;
  onRetry?: () => void;
  retryTitle?: string;
}

export function ErrorBanner({ message, onRetry, retryTitle, style }: ErrorBannerProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? <Button title={retryTitle ?? 'Retry'} onPress={onRetry} variant="ghost" fullWidth={false} style={styles.retryButton} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  message: { ...typography.bodySmall, color: colors.error, marginBottom: spacing.sm },
  retryButton: { alignSelf: 'flex-start' },
});
```

- [ ] **Step 5: Write IconButton.tsx**

```tsx
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  size?: number;
  color?: string;
  backgroundColor?: string;
  disabled?: boolean;
}

export function IconButton({
  icon,
  onPress,
  size = 24,
  color = colors.surface,
  backgroundColor = colors.primary,
  disabled,
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, { backgroundColor }, disabled && styles.disabled]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
});
```

- [ ] **Step 6: Fix ErrorBanner typo**

In `ErrorBanner.tsx` change `{onPress ?` to `{onRetry ?`.

- [ ] **Step 7: Run type-check**

```bash
cd /home/shugar/dev/pulse-chat/apps/mobile && pnpm exec tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile/src/components
git commit -m "feat(mobile): EmptyState, Skeleton, Loading, ErrorBanner, IconButton"
```

---

### Task 5: Auth screens — Welcome, Login, Register

**Files:**
- Modify: `apps/mobile/src/screens/WelcomeScreen.tsx`
- Modify: `apps/mobile/src/screens/LoginScreen.tsx`
- Modify: `apps/mobile/src/screens/RegisterScreen.tsx`

- [ ] **Step 1: Update WelcomeScreen.tsx**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { colors, spacing, typography } from '../theme';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <View style={styles.logo} />
      <Text style={styles.title}>{t('welcome')}</Text>
      <Text style={styles.subtitle}>{t('welcomeSubtitle')}</Text>
      <View style={styles.buttons}>
        <Button title={t('login')} onPress={() => navigation.navigate('Login')} />
        <View style={styles.gap} />
        <Button title={t('register')} onPress={() => navigation.navigate('Register')} variant="secondary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  logo: { width: 80, height: 80, borderRadius: 24, backgroundColor: colors.primary, marginBottom: spacing.xl },
  title: { ...typography.h1, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing['3xl'] },
  buttons: { width: '100%' },
  gap: { height: spacing.md },
});
```

- [ ] **Step 2: Update LoginScreen.tsx**

```tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { login } from '../api/auth';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { ErrorBanner } from '../components/ErrorBanner';
import { colors, spacing, typography } from '../theme';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const { user } = await login({ email, password });
      setUser(user);
    } catch {
      setError(t('loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Text style={styles.title}>{t('login')}</Text>
        {error ? <ErrorBanner message={error} style={styles.banner} /> : null}
        <Input label={t('email')} placeholder={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Input label={t('password')} placeholder={t('password')} value={password} onChangeText={setPassword} secureTextEntry style={styles.inputGap} />
        <Button title={t('login')} onPress={handleLogin} loading={loading} disabled={loading} />
        <Pressable onPress={() => navigation.navigate('Register')} style={styles.link}>
          <Text style={styles.linkText}>{t('noAccount')}</Text>
        </Pressable>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%' },
  title: { ...typography.h2, marginBottom: spacing.lg },
  banner: { marginBottom: spacing.md },
  inputGap: { marginTop: spacing.md, marginBottom: spacing.lg },
  link: { marginTop: spacing.lg, alignSelf: 'center' },
  linkText: { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },
});
```

- [ ] **Step 3: Update RegisterScreen.tsx**

```tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { register } from '../api/auth';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { ErrorBanner } from '../components/ErrorBanner';
import { colors, spacing, typography } from '../theme';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { setUser } = useAuthStore();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError('');
    setLoading(true);
    try {
      const { user } = await register({ email, password, displayName });
      setUser(user);
    } catch {
      setError(t('registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Text style={styles.title}>{t('register')}</Text>
        {error ? <ErrorBanner message={error} style={styles.banner} /> : null}
        <Input label={t('displayName')} placeholder={t('displayName')} value={displayName} onChangeText={setDisplayName} />
        <Input label={t('email')} placeholder={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.inputGap} />
        <Input label={t('password')} placeholder={t('password')} value={password} onChangeText={setPassword} secureTextEntry style={styles.inputGap} />
        <Button title={t('register')} onPress={handleRegister} loading={loading} disabled={loading} />
        <Pressable onPress={() => navigation.navigate('Login')} style={styles.link}>
          <Text style={styles.linkText}>{t('haveAccount')}</Text>
        </Pressable>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%' },
  title: { ...typography.h2, marginBottom: spacing.lg },
  banner: { marginBottom: spacing.md },
  inputGap: { marginTop: spacing.md, marginBottom: spacing.lg },
  link: { marginTop: spacing.lg, alignSelf: 'center' },
  linkText: { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },
});
```

- [ ] **Step 4: Add i18n keys**

Replace contents of `apps/mobile/src/i18n/locales/en.json`:

```json
{
  "welcome": "Welcome to pulse-chat",
  "welcomeSubtitle": "Corporate messenger that stays calm",
  "login": "Login",
  "register": "Register",
  "email": "Email",
  "password": "Password",
  "displayName": "Display name",
  "chats": "Chats",
  "contacts": "Contacts",
  "profile": "Profile",
  "search": "Search",
  "send": "Send",
  "language": "Language",
  "logout": "Logout",
  "loginFailed": "Invalid email or password. Please try again.",
  "registerFailed": "Could not create account. Please try again.",
  "noAccount": "Don't have an account? Register",
  "haveAccount": "Already have an account? Login",
  "noMessages": "No messages yet",
  "noMessagesSubtitle": "Find a colleague in Contacts and start a conversation.",
  "findContacts": "Find contacts",
  "noContacts": "You don't have any contacts yet",
  "noContactsSubtitle": "Search by name or email above.",
  "noSearchResults": "No one found",
  "noSearchResultsSubtitle": "Check your query or try searching by email.",
  "genericError": "Something went wrong. Please try again.",
  "retry": "Retry",
  "messagePlaceholder": "Message...",
  "unknown": "Unknown",
  "searchError": "Could not search users. Check your connection.",
  "contactsError": "Could not load contacts.",
  "chatsError": "Could not load chats.",
  "messagesError": "Could not load messages.",
  "emptyChat": "No messages",
  "emptyChatSubtitle": "Write the first message — the conversation starts here.",
  "contactStatus_pending": "Pending",
  "contactStatus_accepted": "Accepted",
  "contactStatus_blocked": "Blocked",
  "accept": "Accept",
  "remove": "Remove"
}
```

Replace contents of `apps/mobile/src/i18n/locales/ru.json`:

```json
{
  "welcome": "Добро пожаловать в pulse-chat",
  "welcomeSubtitle": "Корпоративный мессенджер без суеты",
  "login": "Вход",
  "register": "Регистрация",
  "email": "Email",
  "password": "Пароль",
  "displayName": "Отображаемое имя",
  "chats": "Чаты",
  "contacts": "Контакты",
  "profile": "Профиль",
  "search": "Поиск",
  "send": "Отправить",
  "language": "Язык",
  "logout": "Выйти",
  "loginFailed": "Неверный email или пароль. Попробуйте ещё раз.",
  "registerFailed": "Не удалось создать аккаунт. Попробуйте ещё раз.",
  "noAccount": "Нет аккаунта? Зарегистрироваться",
  "haveAccount": "Уже есть аккаунт? Войти",
  "noMessages": "Пока нет сообщений",
  "noMessagesSubtitle": "Найдите коллегу в разделе Контакты и начните общение.",
  "findContacts": "Найти контакты",
  "noContacts": "У вас пока нет контактов",
  "noContactsSubtitle": "Введите имя или email коллеги в поле поиска выше.",
  "noSearchResults": "Никого не нашли",
  "noSearchResultsSubtitle": "Проверьте запрос или попробуйте найти по email.",
  "genericError": "Что-то пошло не так. Попробуйте ещё раз.",
  "retry": "Повторить",
  "messagePlaceholder": "Сообщение...",
  "unknown": "Неизвестно",
  "searchError": "Не удалось найти пользователей. Проверьте соединение.",
  "contactsError": "Не удалось загрузить контакты.",
  "chatsError": "Не удалось загрузить чаты.",
  "messagesError": "Не удалось загрузить сообщения.",
  "emptyChat": "Нет сообщений",
  "emptyChatSubtitle": "Напишите первое сообщение — разговор начинается здесь.",
  "contactStatus_pending": "В ожидании",
  "contactStatus_accepted": "Принят",
  "contactStatus_blocked": "Заблокирован",
  "accept": "Принять",
  "remove": "Удалить"
}
```

- [ ] **Step 5: Run type-check**

```bash
cd /home/shugar/dev/pulse-chat/apps/mobile && pnpm exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile/src/screens apps/mobile/src/i18n/locales
git commit -m "feat(mobile): refactor auth screens with new theme"
```

---

### Task 6: ContactsScreen refactor

**Files:**
- Modify: `apps/mobile/src/screens/ContactsScreen.tsx`

- [ ] **Step 1: Refactor ContactsScreen**

```tsx
import React, { useState, useCallback } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listContacts, searchUsers, addContact, updateContact, type Contact, type User } from '../api/contacts';
import { Input } from '../components/Input';
import { ListItem } from '../components/ListItem';
import { Button } from '../components/Button';
import { IconButton } from '../components/IconButton';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { Skeleton } from '../components/Skeleton';
import { colors, spacing } from '../theme';

const skeletonData = () => Array.from({ length: 6 }, (_, i) => `skeleton-${i}`);

export function ContactsScreen() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const queryClient = useQueryClient();
  const { data: contacts, isLoading: contactsLoading, isError: contactsError, refetch } = useQuery({ queryKey: ['contacts'], queryFn: listContacts });
  const { data: searchResults, isLoading: searchLoading, isError: searchError } = useQuery({
    queryKey: ['users', 'search', query],
    queryFn: () => searchUsers(query),
    enabled: query.length > 2,
  });

  const addMutation = useMutation({
    mutationFn: addContact,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'accepted' | 'blocked' | 'removed' }) => updateContact(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);
  const showSearch = query.length > 2;

  const renderSearchItem = ({ item }: { item: User }) => (
    <ListItem
      title={item.displayName}
      subtitle={item.email}
      avatarName={item.displayName}
      trailing={<IconButton icon="add" onPress={() => addMutation.mutate(item.id)} />}
    />
  );

  const renderContactItem = ({ item }: { item: Contact }) => (
    <ListItem
      title={item.target.displayName}
      subtitle={t(`contactStatus_${item.status}`)}
      avatarName={item.target.displayName}
      trailing={
        <View style={styles.actions}>
          {item.status === 'pending' ? (
            <Button
              title={t('accept')}
              onPress={() => updateMutation.mutate({ id: item.id, status: 'accepted' })}
              variant="primary"
              fullWidth={false}
              style={styles.actionButton}
              textStyle={styles.actionText}
            />
          ) : null}
          <Button
            title={t('remove')}
            onPress={() => updateMutation.mutate({ id: item.id, status: 'removed' })}
            variant="ghost"
            fullWidth={false}
            style={styles.actionButton}
            textStyle={styles.removeText}
          />
        </View>
      }
    />
  );

  const renderSkeleton = () => (
    <View style={styles.skeletonRow}>
      <Skeleton width={44} height={44} style={{ borderRadius: 22 }} />
      <View style={styles.skeletonText}>
        <Skeleton width="60%" height={16} style={{ marginBottom: 8 }} />
        <Skeleton width="40%" height={12} />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Input
        placeholder={t('search')}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        style={styles.search}
      />
      {searchError ? <ErrorBanner message={t('searchError')} style={styles.banner} /> : null}

      {showSearch ? (
        searchLoading ? (
          <FlatList data={skeletonData()} keyExtractor={(i) => i} renderItem={renderSkeleton} />
        ) : searchResults?.length === 0 ? (
          <EmptyState icon="search" title={t('noSearchResults')} subtitle={t('noSearchResultsSubtitle')} />
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={renderSearchItem}
            refreshControl={<RefreshControl refreshing={contactsLoading} onRefresh={onRefresh} tintColor={colors.primary} />}
          />
        )
      ) : null}

      {!showSearch ? <View style={styles.divider} /> : null}

      {!showSearch && contactsError ? (
        <ErrorBanner message={t('contactsError')} onRetry={refetch} retryTitle={t('retry')} style={styles.banner} />
      ) : null}

      {!showSearch && contactsLoading && !contacts ? (
        <FlatList data={skeletonData()} keyExtractor={(i) => i} renderItem={renderSkeleton} />
      ) : null}

      {!showSearch && !contactsLoading && contacts?.length === 0 ? (
        <EmptyState icon="people" title={t('noContacts')} subtitle={t('noContactsSubtitle')} />
      ) : null}

      {!showSearch ? (
        <FlatList
          data={contacts || []}
          keyExtractor={(item) => item.id}
          renderItem={renderContactItem}
          refreshControl={<RefreshControl refreshing={contactsLoading} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  search: { marginBottom: spacing.md },
  banner: { marginBottom: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  skeletonText: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actionButton: { paddingVertical: 8, paddingHorizontal: 12 },
  actionText: { fontSize: 13 },
  removeText: { color: colors.error, fontSize: 13 },
});
```

- [ ] **Step 2: Run type-check**

```bash
cd /home/shugar/dev/pulse-chat/apps/mobile && pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile/src/screens/ContactsScreen.tsx
git commit -m "feat(mobile): refactor Contacts screen"
```

---

### Task 7: ChatsScreen refactor

**Files:**
- Modify: `apps/mobile/src/screens/ChatsScreen.tsx`

- [ ] **Step 1: Refactor ChatsScreen**

```tsx
import React, { useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Chat, ChatMember } from '@pulse-chat/shared';
import { listChats } from '../api/chats';
import { useAuthStore } from '../stores/authStore';
import { ListItem } from '../components/ListItem';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { Skeleton } from '../components/Skeleton';
import { colors, spacing, typography } from '../theme';
import type { ChatStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatsList'>;

const skeletonData = () => Array.from({ length: 6 }, (_, i) => `skeleton-${i}`);

function formatTime(dateString?: string) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { data: chats, isLoading, isError, refetch } = useQuery({ queryKey: ['chats'], queryFn: listChats });

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  const titleFor = (chat: Chat) => {
    if (chat.title) return chat.title;
    const other = chat.members.find((m: ChatMember) => m.user.id !== user?.id)?.user;
    return other?.displayName || t('unknown');
  };

  const avatarNameFor = (chat: Chat) => {
    if (chat.title) return chat.title;
    const other = chat.members.find((m: ChatMember) => m.user.id !== user?.id)?.user;
    return other?.displayName || '?';
  };

  const lastMessageFor = (chat: Chat) => {
    const last = chat.messages?.[0];
    if (!last) return '';
    const prefix = chat.type === 'group' && last.author.id !== user?.id ? `${last.author.displayName}: ` : '';
    return `${prefix}${last.content}`;
  };

  const renderSkeleton = () => (
    <View style={styles.skeletonRow}>
      <Skeleton width={44} height={44} style={{ borderRadius: 22 }} />
      <View style={styles.skeletonText}>
        <Skeleton width="60%" height={16} style={{ marginBottom: 8 }} />
        <Skeleton width="40%" height={12} />
      </View>
    </View>
  );

  if (isLoading && !chats) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('chats')}</Text>
        <FlatList data={skeletonData()} keyExtractor={(i) => i} renderItem={renderSkeleton} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('chats')}</Text>
      {isError ? <ErrorBanner message={t('chatsError')} onRetry={refetch} retryTitle={t('retry')} style={styles.banner} /> : null}
      {!isLoading && chats?.length === 0 ? (
        <EmptyState
          icon="chatbubbles"
          title={t('noMessages')}
          subtitle={t('noMessagesSubtitle')}
          actionTitle={t('findContacts')}
          onAction={() => navigation.getParent()?.navigate('ContactsTab' as never)}
        />
      ) : (
        <FlatList
          data={chats || []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ListItem
              title={titleFor(item)}
              subtitle={lastMessageFor(item)}
              avatarName={avatarNameFor(item)}
              onPress={() => navigation.navigate('Chat', { chatId: item.id, title: titleFor(item) })}
              trailing={
                <View style={styles.trailing}>
                  <Text style={styles.time}>{formatTime(item.messages?.[0]?.createdAt)}</Text>
                  <Badge count={0} />
                </View>
              }
            />
          )}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { ...typography.h2, marginBottom: spacing.lg },
  banner: { marginBottom: spacing.md },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  skeletonText: { flex: 1 },
  trailing: { alignItems: 'flex-end' },
  time: { ...typography.caption, marginBottom: 4 },
});
```

- [ ] **Step 2: Run type-check**

```bash
cd /home/shugar/dev/pulse-chat/apps/mobile && pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile/src/screens/ChatsScreen.tsx
git commit -m "feat(mobile): refactor Chats list screen"
```

---

### Task 8: ChatScreen refactor

**Files:**
- Modify: `apps/mobile/src/screens/ChatScreen.tsx`

- [ ] **Step 1: Refactor ChatScreen**

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { listMessages, sendMessage, readMessage } from '../api/chats';
import { useSocket } from '../context/SocketContext';
import { useAuthStore } from '../stores/authStore';
import type { Message } from '@pulse-chat/shared';
import { Input } from '../components/Input';
import { IconButton } from '../components/IconButton';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { colors, radius, spacing, typography } from '../theme';
import type { ChatStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ChatStackParamList, 'Chat'>;

function formatTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatScreen({ route }: Props) {
  const { chatId, title } = route.params;
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const { data: messages, isLoading, isError, refetch } = useQuery({ queryKey: ['messages', chatId], queryFn: () => listMessages(chatId) });

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendMessage(chatId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
      setText('');
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    },
  });

  useEffect(() => {
    if (!socket) return;
    socket.emit('chat:join', { chatId });
    const onNew = (msg: Message) => {
      if (msg.chatId !== chatId) return;
      queryClient.setQueryData(['messages', chatId], (old: Message[] = []) => [...old, msg]);
      if (msg.authorId !== user?.id) readMessage(msg.id).catch(() => {});
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
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

  const handleSend = () => {
    const content = text.trim();
    if (!content) return;
    sendMutation.mutate(content);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.authorId === user?.id;
    return (
      <View style={[styles.row, isMe ? styles.rowRight : styles.rowLeft]}>
        {!isMe ? <Avatar uri={item.author.avatarUrl} name={item.author.displayName} size="sm" /> : <View style={styles.avatarSpacer} />}
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
          {!isMe ? <Text style={styles.authorName}>{item.author.displayName}</Text> : null}
          <Text style={[styles.content, isMe && styles.myContent]}>{item.content}</Text>
          <Text style={[styles.meta, isMe && styles.myMeta]}>
            {formatTime(item.createdAt)} {item.readBy.length > 0 ? '✓✓' : '✓'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <View style={styles.header}>
        <Avatar name={title} size="sm" />
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      </View>

      {isError ? <ErrorBanner message={t('messagesError')} onRetry={refetch} retryTitle={t('retry')} style={styles.banner} /> : null}

      {!isLoading && messages?.length === 0 ? (
        <EmptyState icon="chatbubble" title={t('emptyChat')} subtitle={t('emptyChatSubtitle')} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages || []}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      <View style={styles.footer}>
        <Input placeholder={t('messagePlaceholder')} value={text} onChangeText={setText} style={styles.input} />
        <IconButton icon="send" onPress={handleSend} disabled={!text.trim() || sendMutation.isPending} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, paddingTop: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.h3, flex: 1 },
  banner: { margin: spacing.lg, marginBottom: 0 },
  list: { padding: spacing.lg, paddingBottom: spacing.md },
  row: { flexDirection: 'row', marginBottom: spacing.md, gap: spacing.sm },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end', flexDirection: 'row-reverse' },
  avatarSpacer: { width: 36 },
  bubble: { maxWidth: '75%', padding: spacing.md, borderRadius: radius.lg },
  theirBubble: { backgroundColor: colors.surfaceAlt, borderBottomLeftRadius: radius.sm },
  myBubble: { backgroundColor: colors.primary, borderBottomRightRadius: radius.sm },
  authorName: { ...typography.caption, color: colors.secondary, marginBottom: 2 },
  content: { ...typography.bodySmall, color: colors.text },
  myContent: { color: colors.surface },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs, alignSelf: 'flex-end' },
  myMeta: { color: 'rgba(255,255,255,0.7)' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, marginBottom: 0 },
});
```

- [ ] **Step 2: Run type-check**

```bash
cd /home/shugar/dev/pulse-chat/apps/mobile && pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile/src/screens/ChatScreen.tsx
git commit -m "feat(mobile): refactor Chat screen"
```

---

### Task 9: ProfileScreen refactor

**Files:**
- Modify: `apps/mobile/src/screens/ProfileScreen.tsx`

- [ ] **Step 1: Refactor ProfileScreen**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { logout } from '../api/auth';
import { useAuthStore } from '../stores/authStore';
import { setLanguage } from '../i18n';
import { Card } from '../components/Card';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { colors, spacing, typography } from '../theme';

export function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, setUser } = useAuthStore();

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

- [ ] **Step 2: Run type-check**

```bash
cd /home/shugar/dev/pulse-chat/apps/mobile && pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile/src/screens/ProfileScreen.tsx
git commit -m "feat(mobile): refactor Profile screen"
```

---

### Task 10: Final verification and docs update

**Files:**
- Modify: `README.md` (optional: mention polish pass)

- [ ] **Step 1: Run all checks**

```bash
cd /home/shugar/dev/pulse-chat/services/api && pnpm test
cd /home/shugar/dev/pulse-chat/apps/mobile && pnpm exec tsc --noEmit
cd /home/shugar/dev/pulse-chat/packages/shared && pnpm exec tsc --noEmit
```

- [ ] **Step 2: Optional README update**

Add a line under the quick start: "Phase 1 UI polish applied — warm slate theme, consistent components, empty states, micro-animations."

- [ ] **Step 3: Final commit**

```bash
cd /home/shugar/dev/pulse-chat
git add README.md
git commit -m "docs: note Phase 1 polish in README"
```

---

## Spec coverage check

| Spec section | Implementing task |
|--------------|-------------------|
| Theme tokens | Task 1 |
| Button/Input/Card | Task 2 |
| Avatar/Badge/ListItem | Task 3 |
| EmptyState/Skeleton/Loading/ErrorBanner/IconButton | Task 4 |
| Welcome/Login/Register screens | Task 5 |
| Contacts screen | Task 6 |
| Chats list screen | Task 7 |
| Chat screen | Task 8 |
| Profile screen | Task 9 |
| Final verification + docs | Task 10 |

## Placeholder scan

- No TBD/TODO/fill-in-details statements.
- All component code is provided.
- Exact file paths are listed.
- i18n keys are provided.
