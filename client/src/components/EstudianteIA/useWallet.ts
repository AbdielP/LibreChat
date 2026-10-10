import { useEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthContext } from '~/hooks';
import { billingApi } from './api';
import store from '~/store';

export const WALLET_QUERY_KEY = ['estudiante-ia', 'wallet'] as const;

/** Por debajo de este saldo se avisa al estudiante para que recargue. */
export const LOW_BALANCE_USD = 0.5;

/**
 * Saldo del estudiante. Se refresca al terminar cada respuesta de la IA (cuando
 * se cobró el mensaje), al volver a la pestaña y cada minuto como respaldo.
 */
export function useWallet() {
  const { token, isAuthenticated } = useAuthContext();
  const queryClient = useQueryClient();
  const isSubmitting = useRecoilValue(store.isSubmittingFamily(0));
  const wasSubmitting = useRef(false);

  const query = useQuery({
    queryKey: WALLET_QUERY_KEY,
    queryFn: () => billingApi.getWallet(token as string),
    enabled: isAuthenticated && !!token,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });

  useEffect(() => {
    const justFinished = wasSubmitting.current && !isSubmitting;
    wasSubmitting.current = isSubmitting;
    if (!justFinished) {
      return;
    }
    // El cobro se liquida al final del stream; se espera un instante y se refresca.
    const timer = setTimeout(
      () => queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY }),
      800,
    );
    return () => clearTimeout(timer);
  }, [isSubmitting, queryClient]);

  const available = query.data ? Number(query.data.available) : null;
  return {
    ...query,
    isLow: available !== null && available < LOW_BALANCE_USD,
    refresh: () => queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY }),
  };
}
