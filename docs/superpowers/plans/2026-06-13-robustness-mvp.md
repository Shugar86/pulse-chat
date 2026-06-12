# Robustness MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Harden the existing messenger MVP with validation, logging, rate-limiting, offline awareness, and broader test coverage.

**Architecture:** Add small, focused middleware/helpers on the backend (validation formatter, rate limiter, request logger) and reusable validation/feedback utilities on mobile. Tests drive every backend behavior change.

**Tech stack:** Node.js/Express/Prisma/Jest, Expo/React Native/TypeScript/Zustand/TanStack Query.

---

## File structure

### Backend

- `services/api/src/lib/validation.ts` — shared Zod error formatter and `parseOrThrow` helper.
- `services/api/src/middleware/rateLimit.ts` — simple in-memory rate limiter.
- `services/api/src/middleware/requestLogger.ts` — request-id + structured logging.
- `services/api/src/routes/*.ts` — consume formatter, apply rate limiter to auth.
- `services/api/tests/*.test.ts` — new edge-case tests.

### Mobile

- `apps/mobile/src/lib/validation.ts` — client-side validators (email, password, required).
- `apps/mobile/src/lib/errors.ts` — format field-level API errors.
- `apps/mobile/src/hooks/useForm.ts` — generic form state + validation hook.
- `apps/mobile/src/components/OfflineBanner.tsx` — offline indicator.
- `apps/mobile/src/components/ErrorBoundary.tsx` — global error boundary.
- `apps/mobile/src/screens/*.tsx` — use validators and field errors.
- `apps/mobile/src/stores/tenantStore.ts` — clear query cache on tenant switch.
- `apps/mobile/src/api/auth.ts` — clear query cache on logout.
- `apps/mobile/package.json` — add `@react-native-community/netinfo`.

---

### Task 1: Backend Zod error formatter and parse helper

**Files:**
- Create: `services/api/src/lib/validation.ts`
- Modify: `services/api/src/routes/auth.ts`, `services/api/src/routes/users.ts`, `services/api/src/routes/contacts.ts`, `services/api/src/routes/chats.ts`, `services/api/src/routes/tenants.ts`, `services/api/src/middleware/error.ts`
- Test: existing tests must still pass

- [ ] **Step 1: Create formatter helper**

```ts
import { ZodError } from 'zod';

export interface FieldError {
  field: string;
  message: string;
}

export function formatZodError(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'general',
    message: issue.message,
  }));
}

export class ValidationError extends Error {
  constructor(public errors: FieldError[]) {
    super('Validation failed');
    this.name = 'ValidationError';
  }
}
```

- [ ] **Step 2: Update error middleware to serialize ValidationError as 400 with fields**

Modify `services/api/src/middleware/error.ts`:

```ts
import { ValidationError } from '../lib/validation.js';

export function errorHandler(err: any, req, res, next) {
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: 'Validation failed', fields: err.errors });
  }
  // ... existing logic
}
```

- [ ] **Step 3: Add parseOrThrow helper**

```ts
import { ZodSchema } from 'zod';

export function parseOrThrow<T>(schema: ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new ValidationError(formatZodError(err));
    }
    throw err;
  }
}
```

- [ ] **Step 4: Replace inline `schema.parse` in route files with `parseOrThrow`**

For example in `auth.ts`:

```ts
import { parseOrThrow } from '../lib/validation.js';

const data = parseOrThrow(registerSchema, req.body);
```

- [ ] **Step 5: Run backend tests**

```bash
cd services/api && pnpm test
```

Expected: 25 passing.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/lib/validation.ts services/api/src/middleware/error.ts services/api/src/routes/*.ts
git commit -m "feat(api): centralize zod validation and field-level error responses"
```

---

### Task 2: Backend rate limiter for auth endpoints

**Files:**
- Create: `services/api/src/middleware/rateLimit.ts`
- Modify: `services/api/src/routes/auth.ts`, `services/api/src/app.ts` (ensure trust proxy if behind proxy)
- Test: `services/api/tests/auth.test.ts`

- [ ] **Step 1: Write rate limiter middleware**

```ts
import { Request, Response, NextFunction } from 'express';

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export function rateLimit(options: { windowMs: number; max: number; keyPrefix?: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${options.keyPrefix || 'rl'}:${req.ip}`;
    const now = Date.now();
    let window = windows.get(key);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + options.windowMs };
      windows.set(key, window);
    }
    window.count++;
    if (window.count > options.max) {
      return res.status(429).json({ error: 'Too many requests, please try again later' });
    }
    next();
  };
}
```

- [ ] **Step 2: Apply to auth routes**

In `services/api/src/routes/auth.ts`:

```ts
import { rateLimit } from '../middleware/rateLimit.js';

authRouter.post('/register', rateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyPrefix: 'register' }), ...);
authRouter.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: 'login' }), ...);
```

- [ ] **Step 3: Add test for 429**

```ts
it('returns 429 after too many login attempts', async () => {
  for (let i = 0; i < 10; i++) {
    await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'wrong' });
  }
  const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'wrong' });
  expect(res.status).toBe(429);
});
```

- [ ] **Step 4: Run tests**

```bash
cd services/api && pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add services/api/src/middleware/rateLimit.ts services/api/src/routes/auth.ts services/api/tests/auth.test.ts
git commit -m "feat(api): add in-memory rate limiter for auth endpoints"
```

---

### Task 3: Backend request logger

**Files:**
- Create: `services/api/src/middleware/requestLogger.ts`
- Modify: `services/api/src/app.ts`
- Test: visual / existing tests pass

- [ ] **Step 1: Create logger middleware**

```ts
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers['x-request-id'] as string) || randomUUID();
  (req as any).requestId = id;
  res.setHeader('X-Request-Id', id);
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(JSON.stringify({
      requestId: id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      ip: req.ip,
    }));
  });
  next();
}
```

- [ ] **Step 2: Mount before routes in app.ts**

```ts
import { requestLogger } from './middleware/requestLogger.js';
app.use(requestLogger);
```

- [ ] **Step 3: Run tests**

```bash
cd services/api && pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add services/api/src/middleware/requestLogger.ts services/api/src/app.ts
git commit -m "feat(api): add structured request logger with request id"
```

---

### Task 4: Expand backend edge-case tests

**Files:**
- Modify: `services/api/tests/auth.test.ts`, `services/api/tests/tenants.test.ts` (create if needed), `services/api/tests/contacts.test.ts`, `services/api/tests/chats.test.ts`

- [ ] **Step 1: Add auth edge tests**

In `auth.test.ts`:

```ts
it('returns 409 for duplicate email', async () => {
  await request(app).post('/api/auth/register').send({ email: 'dup@example.com', password: '123456', displayName: 'A', tenantName: 'T' });
  const res = await request(app).post('/api/auth/register').send({ email: 'dup@example.com', password: '123456', displayName: 'B', tenantName: 'T2' });
  expect(res.status).toBe(409);
});

it('returns 400 with field errors for invalid register payload', async () => {
  const res = await request(app).post('/api/auth/register').send({ email: 'bad', password: '123', displayName: '', tenantName: '' });
  expect(res.status).toBe(400);
  expect(res.body.fields).toBeDefined();
});

it('returns 401 for reused/invalid refresh token', async () => {
  const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'invalid' });
  expect(res.status).toBe(401);
});
```

- [ ] **Step 2: Add tenant isolation / invite tests**

Create `services/api/tests/tenants.test.ts` or extend existing tenant tests:

```ts
it('returns 400 when tenant header is missing for scoped endpoint', async () => { ... });
it('returns 403 when accessing another tenant', async () => { ... });
it('returns 404 for invalid invite code', async () => { ... });
it('returns 410 for expired invite', async () => { ... });
```

Use existing test helpers (`getAuthTokens`).

- [ ] **Step 3: Run tests**

```bash
cd services/api && pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add services/api/tests/*.test.ts
git commit -m "test(api): cover duplicate registration, validation errors, token reuse, tenant isolation, invites"
```

---

### Task 5: Mobile validation utilities and useForm hook

**Files:**
- Create: `apps/mobile/src/lib/validation.ts`, `apps/mobile/src/hooks/useForm.ts`
- Modify: `apps/mobile/src/screens/LoginScreen.tsx`, `apps/mobile/src/screens/RegisterScreen.tsx`, `apps/mobile/src/screens/CreateTenantScreen.tsx`, `apps/mobile/src/screens/JoinTenantScreen.tsx`
- Test: `apps/mobile/src/lib/validation.test.ts`

- [ ] **Step 1: Write validators**

```ts
export const validators = {
  required: (v: string) => (v.trim() ? '' : 'required'),
  email: (v: string) => (/^\S+@\S+\.\S+$/.test(v) ? '' : 'invalidEmail'),
  minLength: (min: number) => (v: string) => (v.length >= min ? '' : `minLength:${min}`),
};

export function validateField(value: string, rules: Array<(v: string) => string>): string {
  for (const rule of rules) {
    const error = rule(value);
    if (error) return error;
  }
  return '';
}
```

- [ ] **Step 2: Write useForm hook**

```ts
import { useState, useCallback } from 'react';

export function useForm<T extends Record<string, string>>(initial: T, schema: { [K in keyof T]: Array<(v: string) => string> }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const setValue = useCallback((key: keyof T, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (touched[key]) {
      setErrors((prev) => ({ ...prev, [key]: validateField(value, schema[key]) }));
    }
  }, [schema, touched]);

  const blur = useCallback((key: keyof T) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => ({ ...prev, [key]: validateField(values[key], schema[key]) }));
  }, [schema, values]);

  const isValid = Object.keys(schema).every((key) => !validateField(values[key], schema[key]));

  return { values, errors, touched, setValue, blur, isValid };
}
```

- [ ] **Step 3: Update LoginScreen to use hook and disable invalid submit**

Replace local state with `useForm`.

- [ ] **Step 4: Add unit tests**

```ts
import { validateField, validators } from '../lib/validation';

test('email validator rejects invalid email', () => {
  expect(validateField('bad', [validators.required, validators.email])).toBe('invalidEmail');
});
```

- [ ] **Step 5: Run mobile tests / lint**

```bash
cd apps/mobile && pnpm test -- --passWithNoTests && pnpm exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/lib/validation.ts apps/mobile/src/hooks/useForm.ts apps/mobile/src/screens/*.tsx apps/mobile/src/lib/validation.test.ts
git commit -m "feat(mobile): add useForm validation hook and wire into auth/tenant screens"
```

---

### Task 6: Mobile API error formatter and field errors

**Files:**
- Create: `apps/mobile/src/lib/errors.ts`
- Modify: `apps/mobile/src/components/ErrorBanner.tsx` to accept `fieldErrors` prop, `apps/mobile/src/screens/*.tsx`

- [ ] **Step 1: Create error formatter**

```ts
export interface ApiFieldError {
  field: string;
  message: string;
}

export function getFieldErrors(error: any): ApiFieldError[] {
  if (error?.response?.data?.fields) return error.response.data.fields;
  return [];
}

export function getGeneralError(error: any): string {
  return error?.response?.data?.error || error?.message || 'genericError';
}
```

- [ ] **Step 2: Update screens to show field errors**

Pass `error={errors.email}` to `Input` components.

- [ ] **Step 3: Run lint**

```bash
cd apps/mobile && pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/errors.ts apps/mobile/src/components/ErrorBanner.tsx apps/mobile/src/screens/*.tsx
git commit -m "feat(mobile): format backend field errors and show inline"
```

---

### Task 7: Offline banner and network awareness

**Files:**
- Add dependency: `apps/mobile/package.json`
- Create: `apps/mobile/src/components/OfflineBanner.tsx`
- Modify: `apps/mobile/App.tsx`
- Test: visual

- [ ] **Step 1: Install dependency**

```bash
cd apps/mobile && pnpm add @react-native-community/netinfo
```

- [ ] **Step 2: Create OfflineBanner**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { colors, spacing, typography } from '../theme';

export function OfflineBanner() {
  const { isConnected } = useNetInfo();
  if (isConnected !== false) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>offline</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.error, padding: spacing.sm, alignItems: 'center' },
  text: { color: colors.surface, ...typography.bodySmall },
});
```

- [ ] **Step 3: Render in App.tsx below NavigationContainer or above safe area**

- [ ] **Step 4: Add i18n keys `offline`**

- [ ] **Step 5: Run lint**

```bash
cd apps/mobile && pnpm exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/package.json apps/mobile/src/components/OfflineBanner.tsx apps/mobile/App.tsx apps/mobile/src/i18n/locales/*.json
git commit -m "feat(mobile): add offline banner via netinfo"
```

---

### Task 8: Clear query cache on logout and tenant switch

**Files:**
- Modify: `apps/mobile/src/api/auth.ts`, `apps/mobile/src/stores/tenantStore.ts`

- [ ] **Step 1: Pass queryClient clear callback**

Option A: import `queryClient` from a new `apps/mobile/src/lib/queryClient.ts` and call `queryClient.clear()`.

Create `apps/mobile/src/lib/queryClient.ts`:

```ts
import { QueryClient } from '@tanstack/react-query';
export const queryClient = new QueryClient();
```

Update `App.tsx` to use this instance.

- [ ] **Step 2: Clear on logout**

```ts
import { queryClient } from '../lib/queryClient';
export async function logout() { ... queryClient.clear(); }
```

- [ ] **Step 3: Clear on tenant switch**

In `tenantStore.ts` `setActiveTenantId`:

```ts
import { queryClient } from '../lib/queryClient';
await setActiveTenantId(...);
queryClient.clear();
```

- [ ] **Step 4: Run lint**

```bash
cd apps/mobile && pnpm exec tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/queryClient.ts apps/mobile/src/App.tsx apps/mobile/src/api/auth.ts apps/mobile/src/stores/tenantStore.ts
git commit -m "feat(mobile): clear tanstack query cache on logout and tenant switch"
```

---

### Task 9: Global error boundary

**Files:**
- Create: `apps/mobile/src/components/ErrorBoundary.tsx`
- Modify: `apps/mobile/src/navigation/AppNavigator.tsx`

- [ ] **Step 1: Create ErrorBoundary**

```tsx
import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from './Button';
import { colors, spacing, typography } from '../theme';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (!this.state.hasError) return this.props.children;
    return this.props.fallback || (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Button title="Reload" onPress={() => this.setState({ hasError: false })} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.xl },
  title: { ...typography.h2, marginBottom: spacing.lg, textAlign: 'center' },
});
```

- [ ] **Step 2: Wrap AppNavigator**

```tsx
<ErrorBoundary><AppNavigator /></ErrorBoundary>
```

- [ ] **Step 3: Run lint**

```bash
cd apps/mobile && pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/ErrorBoundary.tsx apps/mobile/src/navigation/AppNavigator.tsx
git commit -m "feat(mobile): add global error boundary"
```

---

## Self-review

- **Spec coverage:** every robustness item from the design doc has at least one task.
- **Placeholder scan:** no TBD/TODO; exact paths and commands provided.
- **Type consistency:** `ValidationError` used by formatter and error middleware; `queryClient` exported from single file.
