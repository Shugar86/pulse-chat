import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TenantSelectionScreen } from '../screens/TenantSelectionScreen';
import { CreateTenantScreen } from '../screens/CreateTenantScreen';
import { JoinTenantScreen } from '../screens/JoinTenantScreen';
import { TenantInviteScreen } from '../screens/TenantInviteScreen';
import type { TenantStackParamList } from './types';

const Stack = createNativeStackNavigator<TenantStackParamList>();

export function TenantNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TenantSelection" component={TenantSelectionScreen} />
      <Stack.Screen name="CreateTenant" component={CreateTenantScreen} />
      <Stack.Screen name="JoinTenant" component={JoinTenantScreen} />
      <Stack.Screen name="TenantInvite" component={TenantInviteScreen} />
    </Stack.Navigator>
  );
}
