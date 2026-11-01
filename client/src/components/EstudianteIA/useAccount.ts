import { useEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthContext } from '~/hooks';
import { billingApi } from './api';
import store from '~/store';

export const ACCOUNT_QUERY_KEY = ['estudiante-ia', 'usage'] as const;

/** Saldo extra por debajo del cual se avisa (si no hay pase con margen). */
export const LOW_BALANCE_USD = 0.3;
/**
 * Por debajo no alcanza ni para un mensaje corto de Luna: cada mensaje lleva unos 7.400
 * tokens de instrucciones y herramientas (~$0.0011) más el mínimo de respuesta.
 */
export const EMPTY_BALANCE_MICROS = 2_000;
/** % del tope semanal a partir del cual se avisa. */
export const PASS_WARNING_PERCENT = 80;

/**
 * Estado de la cuenta del estudiante (pase, saldo extra e historial).
 * Se refresca al terminar cada respuesta de la IA, al volver a la pestaña y cada minuto.
 */
export function useAccount() {
  const { token, isAuthenticated } = useAuthContext();
  const queryClient = useQueryClient();
  const isSubmitting = useRecoilValue(store.isSubmittingFamily(0));
  const wasSubmitting = useRef(false);

  const query = useQuery({
    queryKey: ACCOUNT_QUERY_KEY,
    queryFn: () => billingApi.getUsage(token as string),
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
      () => queryClient.invalidateQueries({ queryKey: ACCOUNT_QUERY_KEY }),
      800,
    );
    return () => clearTimeout(timer);
  }, [isSubmitting, queryClient]);

  const pass = query.data?.pass ?? null;
  const balance = query.data ? Number(query.data.wallet.balance) : null;
  const passNearLimit = pass !== null && pass.week.percentUsed >= PASS_WARNING_PERCENT;
  const walletLow = balance !== null && balance < LOW_BALANCE_USD;
  const walletEmpty =
    query.data != null && Number(query.data.wallet.availableMicros) < EMPTY_BALANCE_MICROS;

  return {
    ...query,
    pass,
    /** Hay que avisar: el pase está por agotarse (o no hay pase) y el saldo extra es bajo. */
    isLow: walletLow && (pass === null || passNearLimit),
    /** Sin pase con margen y sin saldo para un mensaje: el chat va a rechazar lo que envíe. */
    isEmpty: walletEmpty && (pass === null || pass.week.percentUsed >= 100),
    passNearLimit,
    refresh: () => queryClient.invalidateQueries({ queryKey: ACCOUNT_QUERY_KEY }),
  };
}
