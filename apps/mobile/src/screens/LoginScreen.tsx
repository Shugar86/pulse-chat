import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { login } from '../api/auth';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { ErrorBanner } from '../components/ErrorBanner';
import { colors, spacing, typography } from '../theme';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const { user } = await login({ email, password });
      setUser(user);
    } catch {
      setError(t('loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Text style={styles.title} accessibilityRole="header">{t('login')}</Text>
        {error ? <ErrorBanner message={error} style={styles.banner} /> : null}
        <Input label={t('email')} placeholder={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Input label={t('password')} placeholder={t('password')} value={password} onChangeText={setPassword} secureTextEntry style={styles.inputGap} />
        <Button title={t('login')} onPress={handleLogin} loading={loading} disabled={loading} />
        <Button title={t('noAccount')} onPress={() => navigation.navigate('Register')} variant="ghost" fullWidth={false} style={styles.link} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%' },
  title: { ...typography.h2, marginBottom: spacing.lg },
  banner: { marginBottom: spacing.md },
  inputGap: { marginTop: spacing.md, marginBottom: spacing.lg },
  link: { marginTop: spacing.lg, alignSelf: 'center' },
});
