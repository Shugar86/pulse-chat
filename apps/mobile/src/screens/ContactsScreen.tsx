import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, Button, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listContacts, searchUsers, addContact, updateContact } from '../api/contacts';

export function ContactsScreen() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const queryClient = useQueryClient();
  const { data: contacts } = useQuery({ queryKey: ['contacts'], queryFn: listContacts });
  const { data: searchResults } = useQuery({
    queryKey: ['users', 'search', query],
    queryFn: () => searchUsers(query),
    enabled: query.length > 2,
  });

  const addMutation = useMutation({
    mutationFn: addContact,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'accepted' | 'blocked' | 'removed' }) => updateContact(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('contacts')}</Text>
      <TextInput style={styles.input} placeholder={t('search')} value={query} onChangeText={setQuery} />
      {query.length > 2 && searchResults?.length === 0 ? <Text>No users found</Text> : null}
      <FlatList
        data={searchResults || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text>{item.displayName} ({item.email})</Text>
            <Button title="+" onPress={() => addMutation.mutate(item.id)} />
          </View>
        )}
      />
      <Text style={styles.section}>My contacts</Text>
      <FlatList
        data={contacts || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text>{item.target.displayName} — {item.status}</Text>
            {item.status === 'pending' ? (
              <Button title="Accept" onPress={() => updateMutation.mutate({ id: item.id, status: 'accepted' })} />
            ) : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 12 },
  section: { fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
});
