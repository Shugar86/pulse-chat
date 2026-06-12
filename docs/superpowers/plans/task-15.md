### Task 15: Final verification and documentation update

**Files:**
- Modify: `README.md`
- Modify: `services/api/package.json` (add lint script if missing)

- [ ] **Step 1: Run backend tests one final time**

```bash
cd /home/shugar/dev/pulse-chat/services/api
pnpm test
```

Expected: all tests pass.

- [ ] **Step 2: Run TypeScript checks**

```bash
cd /home/shugar/dev/pulse-chat/services/api
pnpm exec tsc --noEmit
cd ../apps/mobile
pnpm exec tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 3: Update `README.md` quick start section**

Replace the placeholder quick start with:

```markdown
## Быстрый старт

```bash
# 1. Зависимости
pnpm install

# 2. Переменные окружения
cp .env.example .env
# отредактируй .env, убедись что DATABASE_URL указывает на запущенный Postgres

# 3. База данных
docker compose up -d
cd services/api
pnpm exec prisma migrate dev

# 4. Бэкенд
pnpm dev

# 5. Мобильное приложение (новое окно)
cd ../../apps/mobile
pnpm start
```
```

- [ ] **Step 4: Final commit**

```bash
cd /home/shugar/dev/pulse-chat
git add README.md
git commit -m "docs: update quick start in README"
```

---

## Spec coverage check

| Spec requirement | Implementing task |
|------------------|-------------------|
| Registration/login with JWT | Task 4 |
| Contacts (add, accept, block, list) | Task 5 |
| 1-to-1 and group chats | Task 5, Task 6 |
| Real-time text messages | Task 7 |
| Read receipts | Task 6, Task 7 |
| ru/en localization | Task 9, Task 14 |
| PostgreSQL via Prisma | Task 3 |
| Docker-based backend | Task 1, Task 3 |
| Expo / React Native client | Task 8 |

## Placeholder scan

- No TBD/TODO/fill-in-details statements.
- Every code step includes the actual file content.
- Every test step includes exact test code and expected output.

## Type consistency check

- `User` type is defined in `@pulse-chat/shared` and reused in client API and store.
- `AuthRequest.user` uses `TokenPayload` from `lib/jwt.ts` consistently.
- Socket event names (`message:new`, `message:read`, `chat:join`, `chat:leave`, `user:presence`) match between server and client.
