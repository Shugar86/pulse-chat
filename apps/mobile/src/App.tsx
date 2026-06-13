import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './i18n';
import { AppNavigator } from './navigation/AppNavigator';
import { SocketProvider } from './context/SocketContext';
import { CallProvider } from './context/CallContext';
import { OfflineBanner } from './components/OfflineBanner';
import { queryClient } from './lib/queryClient';
import { initPushNotifications } from './lib/pushNotifications';

export default function App() {
  useEffect(() => {
    initPushNotifications().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <OfflineBanner />
          <SocketProvider>
            <CallProvider>
              <AppNavigator />
            </CallProvider>
          </SocketProvider>
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
