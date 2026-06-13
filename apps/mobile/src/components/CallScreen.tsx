import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { colors, spacing, typography } from '../theme';

interface CallScreenProps {
  title: string;
  subtitle: string;
  onHangUp: () => void;
  onAccept?: () => void;
}

export function CallScreen({ title, subtitle, onHangUp, onAccept }: CallScreenProps) {
  return (
    <View style={styles.container}>
      <Avatar name={title} size="lg" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.gap} />
      {onAccept ? (
        <View style={styles.row}>
          <Button title="Accept" onPress={onAccept} variant="secondary" style={styles.button} />
          <Button title="Decline" onPress={onHangUp} variant="danger" style={styles.button} />
        </View>
      ) : (
        <Button title="Hang up" onPress={onHangUp} variant="danger" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  title: { ...typography.h2, marginTop: spacing.lg },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  gap: { height: spacing['3xl'] },
  row: { flexDirection: 'row', gap: spacing.md },
  button: { flex: 1 },
});
