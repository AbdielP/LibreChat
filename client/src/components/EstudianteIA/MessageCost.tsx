import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TranslationKeys } from '~/hooks';
import type { MessageCost as Cost } from './api';
import { billingApi, formatMicros } from './api';
import { useAuthContext, useLocalize } from '~/hooks';

/**
 * estudiante-ia-app: una línea bajo cada respuesta con lo que costó y en qué se fue
 * (ej. "$0.0014 · Luna · búsqueda web · documento"). Es una auditoría para el usuario.
 * Los mensajes de error no hablan de cobros: esto es un resumen aparte.
 */

/** Herramientas que se nombran en el resumen (las internas, como ver un archivo, no). */
const TOOL_LABELS: Record<string, TranslationKeys> = {
  create_document: 'com_eia_cost_tool_document',
  edit_document: 'com_eia_cost_tool_edit',
  generate_image: 'com_eia_cost_tool_image',
  search_images: 'com_eia_cost_tool_photos',
  create_chart: 'com_eia_cost_tool_chart',
  create_diagram: 'com_eia_cost_tool_diagram',
  search_references: 'com_eia_cost_tool_references',
};

/**
 * Junta los ids que piden los mensajes en pantalla y los consulta en una sola llamada:
 * un chat largo no dispara una petición por mensaje.
 */
let pending: { ids: Set<string>; promise: Promise<Map<string, Cost>> } | null = null;

function loadCost(token: string, id: string): Promise<Cost | null> {
  // billing-api acepta hasta 100 ids por consulta.
  if (!pending || pending.ids.size >= 100) {
    const ids = new Set<string>();
    const promise = new Promise<Map<string, Cost>>((resolve, reject) => {
      setTimeout(() => {
        if (pending?.ids === ids) {
          pending = null;
        }
        billingApi
          .getMessageCosts(token, [...ids])
          .then((costs) => resolve(new Map(costs.map((c) => [c.messageId, c]))))
          .catch(reject);
      }, 50);
    });
    pending = { ids, promise };
  }
  pending.ids.add(id);
  return pending.promise.then((costs) => costs.get(id) ?? null);
}

function MessageCost({ messageId }: { messageId: string }) {
  const localize = useLocalize();
  const { token, isAuthenticated } = useAuthContext();
  const { data } = useQuery({
    queryKey: ['estudiante-ia', 'message-cost', messageId],
    // LibreChat manda el id de la respuesta (x-message-id): con ese queda cada cobro.
    queryFn: () => loadCost(token as string, messageId),
    enabled: isAuthenticated && !!token && !!messageId,
    // El título del chat se cobra unos segundos después de la respuesta.
    staleTime: 30_000,
    retry: false,
  });

  if (!data || data.calls === 0) {
    return null;
  }

  const charged = Number(data.chargedMicros);
  const parts = [charged > 0 ? formatMicros(data.chargedMicros) : localize('com_eia_cost_free')];
  parts.push(...data.models);
  if (data.webSearches === 1) {
    parts.push(localize('com_eia_cost_search_one'));
  } else if (data.webSearches > 1) {
    parts.push(localize('com_eia_cost_search_other', { count: data.webSearches }));
  }
  for (const tool of data.tools) {
    const label = TOOL_LABELS[tool];
    if (label) {
      parts.push(localize(label));
    }
  }
  if (data.dataAnalysis) {
    parts.push(localize('com_eia_cost_tool_analysis'));
  }

  return (
    <span
      className="text-text-secondary ml-auto truncate text-xs tabular-nums"
      title={localize('com_eia_cost_details', { calls: data.calls })}
    >
      {[...new Set(parts)].join(' · ')}
    </span>
  );
}

export default memo(MessageCost);
