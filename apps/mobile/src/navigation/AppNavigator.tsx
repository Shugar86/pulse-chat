import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '../stores/authStore';
import { useCallContext } from '../context/CallContext';
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

function CallScreenRoute({ route, navigation }: any) {
  const { displayName, userId } = route.params;
  const { activeCall, startCall, hangUp } = useCallContext();

  useEffect(() => {
    if (!activeCall) {
      startCall(userId);
    }
  }, [activeCall, startCall, userId]);

  const subtitle =
    activeCall?.state === 'dialing' ? 'Calling...' :
    activeCall?.state === 'connected' ? 'Call in progress' :
    'Call ended';

  return (
    <CallScreen
      title={displayName}
      subtitle={subtitle}
      onHangUp={() => { hangUp(activeCall?.callId || ''); navigation.goBack(); }}
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
