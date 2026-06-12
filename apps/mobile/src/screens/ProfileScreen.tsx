import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { logout } from '../api/auth';
import { useAuthStore } from '../stores/authStore';
import { setLanguage } from '../i18n';
import { Card } from '../components/Card';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { colors, spacing, typography } from '../theme';

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
      <Card style={styles.card}>
        <Avatar uri={user?.avatarUrl} name={user?.displayName || '?'} size="lg" />
        <Text style={styles.name}>{user?.displayName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>{t('language')}</Text>
          <Text style={styles.value}>{i18n.language.toUpperCase()}</Text>
        </View>
        <Button title={`${t('language')}: ${i18n.language.toUpperCase()}`} onPress={toggleLanguage} variant="secondary" />
        <View style={styles.gap} />
        <Button title={t('logout')} onPress={handleLogout} variant="danger" />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.xl },
  card: { alignItems: 'center', width: '100%' },
  name: { ...typography.h3, marginTop: spacing.lg, textAlign: 'center' },
  email: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  divider: { height: 1, backgroundColor: colors.border, width: '100%', marginVertical: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: spacing.md },
  label: { ...typography.body, color: colors.textSecondary },
  value: { ...typography.body, fontWeight: '600', color: colors.primary },
  gap: { height: spacing.md },
});
