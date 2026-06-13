import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { useVpn } from '../hooks/useVpn';
import { connectVpn, disconnectVpn, getVpnStatus } from '../lib/nativeVpn';
import { generateKeyPair } from '../lib/wireguard';
import { colors, spacing, radius, shadows, typography } from '../theme';

export function VpnCard() {
  const { t } = useTranslation();
  const { config, isLoading, error, create, remove } = useVpn();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    getVpnStatus()
      .then((s) => setConnected(s.connected))
      .catch(() => setConnected(false));
  }, [config?.id]);

  const handleCreate = () => {
    const keys = generateKeyPair();
    create.mutate(keys.publicKey, {
      onError: (err: any) => {
        Alert.alert(t('vpnError'), err?.response?.data?.error || err.message);
      },
    });
  };

  const handleDelete = () => {
    Alert.alert(t('deleteVpnConfirm'), t('deleteVpnSubtitle'), [
      { text: t('cancel', 'Cancel'), style: 'cancel' },
      {
        text: t('delete', 'Delete'),
        style: 'destructive',
        onPress: () => remove.mutate(),
      },
    ]);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('vpn')}</Text>
      {isLoading && <ActivityIndicator color={colors.primary} />}
      {!isLoading && !config && (
        <>
          <Text style={styles.hint}>{t('vpnHint')}</Text>
          {error && <Text style={styles.error}>{(error as any)?.response?.data?.error || t('noVpnConfig', 'No VPN config found')}</Text>}
          <Button title={t('enableVpn')} onPress={handleCreate} disabled={create.isPending} />
        </>
      )}
      {config && (
        <>
          <Text style={styles.row}>{t('address', 'Address')}: {config.address}</Text>
          <Text style={styles.row}>{t('endpoint', 'Endpoint')}: {config.endpoint}</Text>
          <Button
            title={connected ? t('disconnectVpn') : t('connectVpn')}
            onPress={async () => {
              try {
                if (connected) {
                  await disconnectVpn();
                  setConnected(false);
                } else if (config) {
                  await connectVpn(config.config, 'Pulse VPN');
                  setConnected(true);
                }
              } catch (err: any) {
                Alert.alert(t('vpnError'), err.message);
              }
            }}
          />
          <Button title={t('deleteVpn')} onPress={handleDelete} disabled={remove.isPending} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    margin: spacing.lg,
    ...shadows.md,
  },
  title: { ...typography.h3, marginBottom: spacing.sm },
  hint: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.md },
  row: { ...typography.bodySmall, marginBottom: spacing.xs },
  error: { color: colors.error, marginBottom: spacing.md },
});
