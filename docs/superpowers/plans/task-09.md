### Task 9: Mobile i18n

**Files:**
- Create: `apps/mobile/src/i18n/index.ts`
- Create: `apps/mobile/src/i18n/locales/en.json`
- Create: `apps/mobile/src/i18n/locales/ru.json`

- [ ] **Step 1: Write `apps/mobile/src/i18n/index.ts`**

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './locales/en.json';
import ru from './locales/ru.json';

const LANGUAGE_KEY = '@pulse-chat/language';

export const resources = { en: { translation: en }, ru: { translation: ru } };

async function getStoredLanguage(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LANGUAGE_KEY);
  } catch {
    return null;
  }
}

export async function setLanguage(lang: 'ru' | 'en') {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  await i18n.changeLanguage(lang);
}

i18n.use(initReactI18next).init({
  resources,
  lng: Localization.locale.startsWith('en') ? 'en' : 'ru',
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
});

getStoredLanguage().then((lang) => {
  if (lang === 'ru' || lang === 'en') i18n.changeLanguage(lang);
});

export default i18n;
```

- [ ] **Step 2: Write `apps/mobile/src/i18n/locales/en.json`**

```json
{
  "welcome": "Welcome to pulse-chat",
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
  "logout": "Logout"
}
```

- [ ] **Step 3: Write `apps/mobile/src/i18n/locales/ru.json`**

```json
{
  "welcome": "Добро пожаловать в pulse-chat",
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
  "logout": "Выйти"
}
```

- [ ] **Step 4: Re-install and commit**

```bash
cd /home/shugar/dev/pulse-chat
pnpm install
```

```bash
git add apps/mobile
git commit -m "feat(mobile): i18n setup with ru/en"
```

---

