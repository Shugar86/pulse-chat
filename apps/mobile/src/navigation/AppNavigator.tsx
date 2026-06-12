import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../stores/authStore';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { api } from '../api/client';

export function AppNavigator() {
  const { user, setUser } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync('accessToken').then(async (token) => {
      if (token) {
        try {
          const { data } = await api.get('/users/me');
          setUser(data);
        } catch {
          await SecureStore.deleteItemAsync('accessToken');
        }
      }
      setLoading(false);
    });
  }, [setUser]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return user ? <MainNavigator /> : <AuthNavigator />;
}
