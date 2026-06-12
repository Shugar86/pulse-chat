import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChatsScreen } from '../screens/ChatsScreen';
import { ContactsScreen } from '../screens/ContactsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ChatScreen } from '../screens/ChatScreen';
import type { ChatStackParamList } from './types';

const Tab = createBottomTabNavigator();
const ChatStack = createNativeStackNavigator<ChatStackParamList>();

function ChatStackNavigator() {
  return (
    <ChatStack.Navigator>
      <ChatStack.Screen name="ChatsList" component={ChatsScreen} options={{ title: 'Chats' }} />
      <ChatStack.Screen name="Chat" component={ChatScreen} />
    </ChatStack.Navigator>
  );
}

export function MainNavigator() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="ChatsTab" component={ChatStackNavigator} options={{ tabBarLabel: t('chats'), tabBarIcon: () => <Text>💬</Text> }} />
      <Tab.Screen name="ContactsTab" component={ContactsScreen} options={{ tabBarLabel: t('contacts'), tabBarIcon: () => <Text>👥</Text> }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ tabBarLabel: t('profile'), tabBarIcon: () => <Text>⚙️</Text> }} />
    </Tab.Navigator>
  );
}
