import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthContext } from '~/hooks';
import { billingApi } from './api';

/**
 * estudiante-ia-app: junto al contador de la respuesta, qué está haciendo la IA
 * ("Creando el archivo…", "Buscando imágenes…"). Sin esto, un documento que tarda
 * se ve como si la app se hubiera quedado pegada. Solo se monta mientras se responde.
 */
function ActivityStatus() {
  const { token, isAuthenticated } = useAuthContext();
  const { data } = useQuery({
    queryKey: ['estudiante-ia', 'activity'],
    queryFn: () => billingApi.getActivity(token as string),
    enabled: isAuthenticated && !!token,
    refetchInterval: 1500,
    cacheTime: 0,
    retry: false,
  });

  if (!data?.status) {
    return null;
  }
  return (
    <span className="text-text-secondary animate-pulse truncate text-xs" aria-live="polite">
      {data.status}
    </span>
  );
}

export default memo(ActivityStatus);
