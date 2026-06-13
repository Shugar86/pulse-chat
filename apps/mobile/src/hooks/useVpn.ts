import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createVpnConfig, deleteVpnConfig, getVpnConfig } from '../api/vpn';

const VPN_QUERY_KEY = ['vpn-config'];

export function useVpn() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: VPN_QUERY_KEY,
    queryFn: getVpnConfig,
    retry: false,
    staleTime: Infinity,
  });

  const create = useMutation({
    mutationFn: createVpnConfig,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: VPN_QUERY_KEY }),
  });

  const remove = useMutation({
    mutationFn: deleteVpnConfig,
    onSuccess: () => queryClient.setQueryData(VPN_QUERY_KEY, null),
  });

  return {
    config: data ?? null,
    isLoading,
    error,
    create,
    remove,
  };
}
