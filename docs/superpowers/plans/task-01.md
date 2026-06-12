### Task 1: Root monorepo setup

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `docker-compose.yml`
- Modify: `.gitignore` (append `services/api/dist`, `apps/mobile/dist`)

- [ ] **Step 1: Write root `package.json`**

```json
{
  "name": "pulse-chat",
  "private": true,
  "version": "0.1.0",
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "pnpm -r dev",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'services/*'
  - 'packages/*'
```

- [ ] **Step 3: Write `docker-compose.yml`**

```yaml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: pulsechat
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
volumes:
  postgres_data:
```

- [ ] **Step 4: Append build dirs to `.gitignore`**

Add at the end:

```
services/api/dist
services/api/coverage
apps/mobile/dist
apps/mobile/coverage
```

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml docker-compose.yml .gitignore
git commit -m "chore: root monorepo setup with docker-compose"
```

---

