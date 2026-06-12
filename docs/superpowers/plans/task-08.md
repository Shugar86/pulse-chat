### Task 8: Mobile Expo skeleton

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/babel.config.js`
- Create: `apps/mobile/src/App.tsx`
- Modify: `.gitignore` (add Expo entries if missing)

- [ ] **Step 1: Write `apps/mobile/package.json`**

```json
{
  "name": "@pulse-chat/mobile",
  "version": "0.1.0",
  "main": "expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "test": "jest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@pulse-chat/shared": "workspace:*",
    "@react-navigation/bottom-tabs": "^7.0.0",
    "@react-navigation/native": "^7.0.0",
    "@react-navigation/native-stack": "^7.0.0",
    "@tanstack/react-query": "^5.62.0",
    "axios": "^1.7.9",
    "expo": "~52.0.0",
    "expo-localization": "~16.0.0",
    "expo-secure-store": "~14.0.0",
    "@react-native-async-storage/async-storage": "1.23.1",
    "expo-status-bar": "~2.0.0",
    "i18next": "^24.1.0",
    "react": "18.3.1",
    "react-i18next": "^15.2.0",
    "react-native": "0.76.5",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.4.0",
    "socket.io-client": "^4.8.1",
    "zustand": "^5.0.2"
  },
  "devDependencies": {
    "@babel/core": "^7.26.0",
    "@types/react": "~18.3.12",
    "jest-expo": "~52.0.0",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Write `apps/mobile/tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*", "App.tsx"]
}
```

- [ ] **Step 3: Write `apps/mobile/app.json`**

```json
{
  "expo": {
    "name": "pulse-chat",
    "slug": "pulse-chat",
    "version": "0.1.0",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "scheme": "pulsechat",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "chat.pulse.mobile"
    },
    "android": {
      "package": "chat.pulse.mobile",
      "adaptiveIcon": { "backgroundColor": "#1a2230" }
    },
    "plugins": ["expo-secure-store"]
  }
}
```

- [ ] **Step 4: Write `apps/mobile/babel.config.js`**

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

- [ ] **Step 5: Write `apps/mobile/src/App.tsx`**

```tsx
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './i18n';
import { AppNavigator } from './navigation/AppNavigator';
import { SocketProvider } from './context/SocketContext';

const queryClient = new QueryClient();

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <SocketProvider>
            <AppNavigator />
          </SocketProvider>
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 6: Install dependencies**

```bash
cd /home/shugar/dev/pulse-chat
pnpm install
```

- [ ] **Step 7: Commit**

```bash
git add apps/mobile
git commit -m "chore(mobile): Expo skeleton and dependencies"
```

---

