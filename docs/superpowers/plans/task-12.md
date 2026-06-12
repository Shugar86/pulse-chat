### Task 12: Mobile contacts screen

**Files:**
- Create: `apps/mobile/src/api/contacts.ts`
- Create: `apps/mobile/src/screens/ContactsScreen.tsx`

- [ ] **Step 1: Write `apps/mobile/src/api/contacts.ts`**

```typescript
import { api } from './client';

export interface Contact {
  id: string;
  status: 'pending' | 'accepted' | 'blocked';
  target: { id: string; email: string; displayName: string; avatarUrl: string | null };
}

export function searchUsers(q: string) {
  return api.get('/users/search', { params: { q } }).then((r) => r.data);
}

export function listContacts() {
  return api.get<Contact[]>('/contacts').then((r) => r.data);
}

export function addContact(targetId: string) {
  return api.post<Contact>('/contacts', { targetId }).then((r) => r.data);
}

export function updateContact(id: string, status: 'accepted' | 'blocked' | 'removed') {
  return api.patch<Contact>(`/contacts/${id}`, { status }).then((r) => r.data);
}
```

- [ ] **Step 2: Write `apps/mobile/src/screens/ContactsScreen.tsx`**

```tsx
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
        keyExtractor={(item: any) => item.id}
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
```

- [ ] **Step 3: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile
git commit -m "feat(mobile): contacts search and management"
```

---

