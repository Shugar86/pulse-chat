# pulse-chat — Phase 1 Polish Design

- **Date:** 2026-06-12
- **Status:** Approved for implementation
- **Project root:** `~/dev/pulse-chat`
- **Target:** Expo / React Native mobile client (`apps/mobile`)

## Goal

Привести прототип Phase 1 к единому спокойному и надёжному вайбу: тёплый слейт, консистентные компоненты, понятные пустые состояния, мягкие анимации и приятный UX чата.

## Vibe (VibeCraft)

| Аспект | Значение |
|--------|----------|
| **Vibe-токен** | `calm-reliable` |
| **Core emotion** | Спокойствие и уверенность. Приложение не кричит, не паникует, всё на своих местах. |
| **Voice** | Вежливый, немного сдержанный, без пафоса. Ошибки — это «пока не получилось», а не «критический сбой». |
| **Values** | Ясность, стабильность, уважение к времени пользователя. |
| **Taboos** | Кричащие цвета, агрессивные алерты, лишние шаги, технический жаргон. |

## Theme tokens

### Colors

| Token | HEX | Usage |
|-------|-----|-------|
| `colors.background` | `#F8F6F3` | Фон приложения и табов |
| `colors.surface` | `#FFFFFF` | Карточки, инпуты, фон экрана чата |
| `colors.surfaceAlt` | `#F0EDE9` | Пузыри собеседника, вторичные поверхности |
| `colors.primary` | `#5D6B7A` | Кнопки, акценты, ссылки, бейджи, пузыри «мои» |
| `colors.secondary` | `#73685F` | Метки, вторичные иконки, аватар-инициалы |
| `colors.text` | `#332E2A` | Основной текст |
| `colors.textSecondary` | `#8D8177` | Подписи, превью, плейсхолдеры |
| `colors.textTertiary` | `#A89E92` | Разделители, disabled |
| `colors.border` | `#E2DCD4` | Границы инпутов, разделители |
| `colors.success` | `#4A7C59` | Online-индикатор, успешные действия |
| `colors.error` | `#B54242` | Ошибки, destructive actions |

### Typography

Используем системный шрифт (iOS SF Pro / Android Roboto). Inter можно подключить позже, но не в Phase 1 polish.

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `text.h1` | 30px | 700 | Welcome title |
| `text.h2` | 24px | 700 | Экранные заголовки |
| `text.h3` | 20px | 600 | Секции, шапка чата |
| `text.body` | 16px | 400 | Основной текст |
| `text.bodySmall` | 14px | 400 | Имена, кнопки, метки |
| `text.caption` | 12px | 400 | Время, статусы, подписи |

### Spacing

| Token | Value |
|-------|-------|
| `space.xs` | 4px |
| `space.sm` | 8px |
| `space.md` | 12px |
| `space.lg` | 16px |
| `space.xl` | 20px |
| `space.2xl` | 24px |
| `space.3xl` | 32px |

### Radius

| Token | Value |
|-------|-------|
| `radius.sm` | 8px |
| `radius.md` | 12px |
| `radius.lg` | 16px |
| `radius.xl` | 24px |
| `radius.full` | 9999px |

### Shadows

| Token | Value |
|-------|-------|
| `shadow.sm` | `0 1px 2px rgba(51,46,42,0.05)` |
| `shadow.md` | `0 2px 8px rgba(51,46,42,0.06)` |
| `shadow.lg` | `0 4px 16px rgba(51,46,42,0.08)` |

## Component library

Создать в `apps/mobile/src/components/`:

- `Button` — primary, secondary, ghost; loading; disabled; press-scale.
- `Input` — label, placeholder, error state, focus border animation.
- `Card` — white surface, radius lg, shadow md.
- `ListItem` — avatar + title + subtitle + trailing (time, badge, action).
- `Avatar` — фото или инициалы; online-индикатор; размеры sm/md/lg.
- `Badge` — small count/status pill.
- `EmptyState` — icon + title + subtitle + optional action.
- `Skeleton` — placeholder для списков.
- `Loading` — spinner.
- `ErrorBanner` — inline error message with retry.
- `IconButton` — круглая кнопка с иконкой (send, back, etc).

## Screen-by-screen changes

### WelcomeScreen
- Фон `background`.
- Логотип (placeholder-квадрат с `primary` и radius xl) по центру.
- Заголовок `h1`, короткий подзаголовок `body` в `textSecondary`.
- Две кнопки: primary «Войти», secondary «Регистрация».

### LoginScreen / RegisterScreen
- Фон `background`.
- Крупная карточка `surface` с `shadow.lg`, отступы xl.
- Поля `Input` с лейблами.
- `ErrorBanner` под заголовком при ошибке.
- Primary button на всю ширину.
- Ссылка «Нет аккаунта? / Уже есть аккаунт?» текстом с `primary`.

### ChatsScreen
- Фон `background`.
- Шапка с заголовком `h2`.
- `FlatList` с `ListItem` (avatar, title, preview, time, badge).
- Pull-to-refresh.
- `EmptyState` «Пока нет сообщений» с action на ContactsTab.
- `Skeleton` во время первой загрузки.

### ChatScreen
- Фон `surface`.
- Шапка: back button, avatar sm, имя собеседника/название чата `h3`.
- Сообщения:
  - «Чужие» — `surfaceAlt`, слева, `radius.lg` с острым нижним левым углом.
  - «Мои» — `primary`, текст белый, справа, `radius.lg` с острым нижним правым углом.
  - В групповых чатах — имя автора над чужим пузырём.
  - Время и статус прочтения (`✓` / `✓✓`) в `caption`.
- Поле ввода: `Input` + `IconButton` send.
- Плавный auto-scroll к новому сообщению.
- `EmptyState` если нет сообщений.

### ContactsScreen
- Фон `background`.
- Шапка + `Input` поиска.
- Сегментировано: результаты поиска сверху, мои контакты снизу.
- `ListItem` с action-кнопками: «Принять» (success), «Удалить» (error text), «+» для добавления.
- Pull-to-refresh.
- `EmptyState` для контактов и для поиска без результатов.

### ProfileScreen
- Фон `background`.
- Карточка `surface` с `shadow.lg`, centered:
  - `Avatar` lg.
  - Имя `h3`, email `bodySmall` textSecondary.
  - Row «Язык» с текущим значением.
  - Primary/secondary buttons для переключения языка.
  - Destructive button «Выйти».

## Empty & error states

| Screen | State | Title | Subtitle | Action |
|--------|-------|-------|----------|--------|
| Chats | empty | Пока нет сообщений | Найдите коллегу в разделе Контакты и начните общение. | Найти контакты |
| Contacts | empty | У вас пока нет контактов | Введите имя или email коллеги в поле поиска выше. | — |
| Contacts | search empty | Никого не нашли | Проверьте запрос или попробуйте найти по email. | — |
| Chat | empty | Нет сообщений | Напишите первое сообщение — разговор начинается здесь. | — |
| Global | error | Что-то пошло не так | Проверьте соединение и попробуйте снова. | Повторить |
| Auth | error | Не удалось войти | Неверный email или пароль. Попробуйте ещё раз. | — |

## Animations & micro-interactions

- **Screen transitions**: нативный стек React Navigation — сдвиг справа для Chat, fade для табов.
- **List items**: fade + translateY по очереди при появлении.
- **Skeletons**: мягкое пульсирование фона (`Animated`).
- **Button press**: `scale` 0.97, spring back.
- **Input focus**: плавная смена `borderColor` на `primary`.
- **Send button**: scale bounce on press.
- **Message appear**: slide up + fade, 200ms.
- **Online indicator**: тихий pulse green dot.
- **Pull-to-refresh**: на списках чатов и контактов.
- **Errors**: inline banner slide down, no modal.

## Implementation notes

- Тема живёт в `apps/mobile/src/theme/index.ts` (или `theme.ts`).
- Иконки — `@expo/vector-icons` (Ionicons), чтобы не тащить кастомный набор.
- Все новые компоненты используют только токены, без хардкода.
- Заменяем экраны по одному, проверяя `tsc --noEmit` после каждого.
- Анимации — `react-native-reanimated` или `Animated` API. Recommended: `Animated` для простых кейсов, `reanimated` если нужны жесты/сложные переходы.
- Цвета и стили — `StyleSheet`, без Tailwind/NativeWind на этом этапе.
- i18n-ключи добавляем в `en.json` и `ru.json`.

## Out of scope

- Тёмная тема (Phase 2).
- Кастомные иллюстрации/иконки (используем emoji и системные иконки).
- Шрифт Inter / SF Pro explicit loading.
- Haptics / sounds.
- Push notifications.
- Deep linking / swipe actions.

## Open decisions

None. All decisions confirmed during brainstorming.
