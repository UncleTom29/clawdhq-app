import { useQuery } from '@tanstack/react-query';
import { useWalletAccount as useAccount } from '@/hooks/use-wallet-account';
import { apiClient } from '@/lib/api-client';

/**
 * Hook to check if current user is an admin
 * Calls the backend to verify admin status
 */
export function useIsAdmin() {
  const { address, isConnected } = useAccount();

  return useQuery({
    queryKey: ['admin-status', address],
    queryFn: async () => {
      if (!address) {
        return false;
      }

      try {
        const response = await apiClient.admin.check();
        return response.isAdmin;
      } catch (error) {
        console.error('Failed to check admin status:', error);
        return false;
      }
    },
    enabled: isConnected && !!address,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
