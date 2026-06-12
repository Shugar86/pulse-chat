import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Tenant, TenantMembership } from '@pulse-chat/shared';

const ACTIVE_TENANT_KEY = '@pulse-chat/activeTenantId';

interface TenantState {
  activeTenantId: string | null;
  setActiveTenantId: (id: string | null) => Promise<void>;
  initializeTenant: (memberships: TenantMembership[]) => Promise<Tenant | null>;
}

export const useTenantStore = create<TenantState>((set, get) => ({
  activeTenantId: null,

  setActiveTenantId: async (id) => {
    set({ activeTenantId: id });
    if (id) {
      await AsyncStorage.setItem(ACTIVE_TENANT_KEY, id);
    } else {
      await AsyncStorage.removeItem(ACTIVE_TENANT_KEY);
    }
  },

  initializeTenant: async (memberships) => {
    if (memberships.length === 0) {
      set({ activeTenantId: null });
      await AsyncStorage.removeItem(ACTIVE_TENANT_KEY);
      return null;
    }

    const stored = await AsyncStorage.getItem(ACTIVE_TENANT_KEY);
    const valid = memberships.find((m) => m.tenantId === stored);
    const selected = valid ? valid : memberships[0];

    set({ activeTenantId: selected.tenantId });
    await AsyncStorage.setItem(ACTIVE_TENANT_KEY, selected.tenantId);
    return selected.tenant;
  },
}));

export function getActiveTenantId(): string | null {
  return useTenantStore.getState().activeTenantId;
}
