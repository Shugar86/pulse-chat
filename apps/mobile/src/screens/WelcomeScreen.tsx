import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { colors, spacing, typography, radius } from '../theme';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [fade]);

  return (
    <Animated.View style={[styles.container, { opacity: fade }]}>
      <View style={styles.logo} />
      <Text style={styles.title} accessibilityRole="header">{t('welcome')}</Text>
      <Text style={styles.subtitle}>{t('welcomeSubtitle')}</Text>
      <View style={styles.buttons}>
        <Button title={t('login')} onPress={() => navigation.navigate('Login')} />
        <View style={styles.gap} />
        <Button title={t('register')} onPress={() => navigation.navigate('Register')} variant="secondary" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  logo: { width: 80, height: 80, borderRadius: radius.xl, backgroundColor: colors.primary, marginBottom: spacing.xl },
  title: { ...typography.h1, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing['3xl'] },
  buttons: { width: '100%' },
  gap: { height: spacing.md },
});
