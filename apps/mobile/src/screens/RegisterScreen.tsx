import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { register } from '../api/auth';
import { useAuthStore } from '../stores/authStore';
import { useForm } from '../hooks/useForm';
import { validators } from '../lib/validation';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { ErrorBanner } from '../components/ErrorBanner';
import { colors, spacing, typography } from '../theme';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { setUser } = useAuthStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { values, errors, setValue, blur, isValid } = useForm(
    { displayName: '', tenantName: '', email: '', password: '' },
    {
      displayName: [validators.required],
      tenantName: [validators.required],
      email: [validators.required, validators.email],
      password: [validators.required, validators.minLength(6)],
    }
  );

  const handleRegister = async () => {
    setError('');
    if (!isValid) return;
    setLoading(true);
    try {
      const { user } = await register({
        email: values.email,
        password: values.password,
        displayName: values.displayName,
        tenantName: values.tenantName,
      });
      setUser(user);
    } catch {
      setError(t('registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Text style={styles.title} accessibilityRole="header">{t('register')}</Text>
        {error ? <ErrorBanner message={error} style={styles.banner} /> : null}
        <Input
          label={t('displayName')}
          placeholder={t('displayName')}
          value={values.displayName}
          onChangeText={(value) => setValue('displayName', value)}
          onBlur={() => blur('displayName')}
          error={errors.displayName ? t(errors.displayName) : undefined}
        />
        <Input
          label={t('companyName')}
          placeholder={t('companyName')}
          value={values.tenantName}
          onChangeText={(value) => setValue('tenantName', value)}
          onBlur={() => blur('tenantName')}
          style={styles.inputGap}
          error={errors.tenantName ? t(errors.tenantName) : undefined}
        />
        <Input
          label={t('email')}
          placeholder={t('email')}
          value={values.email}
          onChangeText={(value) => setValue('email', value)}
          onBlur={() => blur('email')}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.inputGap}
          error={errors.email ? t(errors.email) : undefined}
        />
        <Input
          label={t('password')}
          placeholder={t('password')}
          value={values.password}
          onChangeText={(value) => setValue('password', value)}
          onBlur={() => blur('password')}
          secureTextEntry
          style={styles.inputGap}
          error={errors.password ? t(errors.password) : undefined}
        />
        <Button title={t('register')} onPress={handleRegister} loading={loading} disabled={loading || !isValid} />
        <Button title={t('haveAccount')} onPress={() => navigation.navigate('Login')} variant="ghost" fullWidth={false} style={styles.link} />
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
