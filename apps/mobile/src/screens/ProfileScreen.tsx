import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { logout } from '../api/auth';
import { useAuthStore } from '../stores/authStore';
import { setLanguage } from '../i18n';

export function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, setUser } = useAuthStore();

  const toggleLanguage = async () => {
    const next = i18n.language === 'ru' ? 'en' : 'ru';
    await setLanguage(next);
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('profile')}</Text>
      <Text style={styles.label}>{user?.displayName}</Text>
      <Text style={styles.label}>{user?.email}</Text>
      <View style={styles.gap} />
      <Button title={`${t('language')}: ${i18n.language.toUpperCase()}`} onPress={toggleLanguage} />
      <View style={styles.gap} />
      <Button title={t('logout')} onPress={handleLogout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  label: { fontSize: 16, marginBottom: 4 },
  gap: { height: 12 },
});
