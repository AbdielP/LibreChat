import { useQuery } from '@tanstack/react-query';
import type { ModelEstimate } from './api';
import { useAuthContext } from '~/hooks';
import { billingApi } from './api';

/** Modelos con su costo típico por mensaje (cambian poco: se cachean 10 minutos). */
export function useModels() {
  const { token, isAuthenticated } = useAuthContext();
  const query = useQuery({
    queryKey: ['estudiante-ia', 'models'],
    queryFn: () => billingApi.getModels(token as string),
    enabled: isAuthenticated && !!token,
    staleTime: 10 * 60_000,
  });
  const models = query.data ?? [];
  const byTier = (tier: ModelEstimate['tier']) => models.find((m) => m.tier === tier);
  return { models, economy: byTier('ECONOMY'), standard: byTier('STANDARD') };
}
