import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { TenantNavigator } from './TenantNavigator';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { CallScreen } from '../components/CallScreen';
import { api } from '../api/client';
import { colors } from '../theme';
import type { MainStackParamList } from './types';

const Stack = createNativeStackNavigator<MainStackParamList>();

function CallScreenRoute({ route, navigation }: NativeStackScreenProps<MainStackParamList, 'Call'>) {
  const { t } = useTranslation();
  return (
    <CallScreen
      title={route.params.displayName}
      subtitle={t('calling')}
      onHangUp={() => navigation.goBack()}
    />
  );
}

export function AppNavigator() {
  const { user, setUser } = useAuthStore();
  const { activeTenantId, initializeTenant, setActiveTenantId } = useTenantStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    SecureStore.getItemAsync('accessToken').then(async (token) => {
      if (!token) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const { data } = await api.get('/users/me');
        if (!mounted) return;
        await initializeTenant(data.tenants || []);
        setUser(data);
      } catch {
        if (!mounted) return;
        await SecureStore.deleteItemAsync('accessToken');
        await setActiveTenantId(null);
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [setUser, initializeTenant, setActiveTenantId]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      {!user ? (
        <AuthNavigator />
      ) : !activeTenantId ? (
        <TenantNavigator />
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs" component={MainNavigator} />
          <Stack.Screen name="Call" component={CallScreenRoute} options={{ animation: 'slide_from_bottom' }} />
        </Stack.Navigator>
      )}
    </ErrorBoundary>
  );
}
