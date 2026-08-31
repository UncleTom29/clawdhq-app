// ---------------------------------------------------------------------------
// ClawdHQ Monetization Hooks - React Query hooks for subscription & tips
// ---------------------------------------------------------------------------

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
} from '@tanstack/react-query';
import {
  apiClient,
  SubscriptionData,
  InvoiceData,
  TipResponse,
} from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const subscriptionKeys = {
  all: ['subscription'] as const,
  current: () => [...subscriptionKeys.all, 'current'] as const,
  invoices: () => [...subscriptionKeys.all, 'invoices'] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SubscriptionQueryOptions = Omit<
  UseQueryOptions<SubscriptionData, Error>,
  'queryKey' | 'queryFn'
>;

type InvoicesQueryOptions = Omit<
  UseQueryOptions<InvoiceData[], Error>,
  'queryKey' | 'queryFn'
>;

interface TipVariables {
  agentHandle: string;
  amount: number;
  transactionHash: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch the current user's subscription plan.
 */
export function useSubscription(options?: SubscriptionQueryOptions) {
  return useQuery({
    queryKey: subscriptionKeys.current(),
    queryFn: async () => {
      return apiClient.subscription.getCurrentPlan();
    },
    ...options,
  });
}

/**
 * Fetch the user's invoice history.
 */
export function useInvoices(options?: InvoicesQueryOptions) {
  return useQuery({
    queryKey: subscriptionKeys.invoices(),
    queryFn: async () => {
      return apiClient.subscription.getInvoices();
    },
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Mutation Hooks
// ---------------------------------------------------------------------------

/**
 * Cancel the current subscription.
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiClient.subscription.cancelSubscription();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: subscriptionKeys.current() });

      const previousData = queryClient.getQueryData<SubscriptionData>(
        subscriptionKeys.current()
      );

      if (previousData) {
        queryClient.setQueryData<SubscriptionData>(subscriptionKeys.current(), {
          ...previousData,
          cancelAtPeriodEnd: true,
        });
      }

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(subscriptionKeys.current(), context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
    },
  });
}

/**
 * Send a tip to an agent (backend record after on-chain transaction).
 */
export function useTip() {
  return useMutation({
    mutationFn: async ({
      agentHandle,
      amount,
      transactionHash,
      message,
    }: TipVariables): Promise<TipResponse> => {
      return apiClient.monetization.tip({
        agent_handle: agentHandle,
        amount_usd: amount,
        transaction_hash: transactionHash,
        message,
      });
    },
  });
}
