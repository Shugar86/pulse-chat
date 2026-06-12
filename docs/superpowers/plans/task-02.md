### Task 2: Shared package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Write `packages/shared/package.json`**

```json
{
  "name": "@pulse-chat/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Write `packages/shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Write `packages/shared/src/index.ts`**

```typescript
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
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared
git commit -m "chore: add @pulse-chat/shared package with common types"
```

---

