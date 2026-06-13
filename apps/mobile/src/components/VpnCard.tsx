import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Button } from './Button';
import { useVpn } from '../hooks/useVpn';
import { connectVpn, disconnectVpn, getVpnStatus } from '../lib/nativeVpn';

export function VpnCard() {
  const { config, isLoading, error, create, remove } = useVpn();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    getVpnStatus()
      .then((s) => setConnected(s.connected))
      .catch(() => setConnected(false));
  }, [config?.id]);

  const handleCreate = () => {
    create.mutate(undefined, {
      onError: (err: any) => {
        Alert.alert('VPN error', err?.response?.data?.error || err.message);
      },
    });
  };

  const handleDelete = () => {
    Alert.alert('Delete VPN config?', 'You will need to reconnect afterwards.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => remove.mutate(),
      },
    ]);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Corporate VPN</Text>
      {isLoading && <ActivityIndicator />}
      {!isLoading && !config && (
        <>
          <Text style={styles.hint}>Connect your device to the tenant VPN.</Text>
          {error && <Text style={styles.error}>{(error as any)?.response?.data?.error || 'No VPN config found'}</Text>}
          <Button title="Enable VPN" onPress={handleCreate} disabled={create.isPending} />
        </>
      )}
      {config && (
        <>
          <Text style={styles.row}>Address: {config.address}</Text>
          <Text style={styles.row}>Endpoint: {config.endpoint}</Text>
          <Button
            title={connected ? 'Disconnect VPN' : 'Connect VPN'}
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
                Alert.alert('VPN error', err.message);
              }
            }}
          />
          <Button title="Delete VPN config" onPress={handleDelete} disabled={remove.isPending} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  hint: { color: '#666', marginBottom: 12 },
  row: { marginBottom: 4 },
  error: { color: '#d32f2f', marginBottom: 12 },
});
