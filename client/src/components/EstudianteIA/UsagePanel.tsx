import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@librechat/client';
import type { Purchase } from './Checkout';
import type { Usage } from './api';
import { estimateMessages, formatMicros } from './api';
import { useAccount } from './useAccount';
import { useModels } from './useModels';
import { useLocalize } from '~/hooks';
import Checkout from './Checkout';

const HISTORY_ROWS = 7;

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

/**
 * estudiante-ia-app: pestaña "Uso" de Configuración (inspirada en la de Claude,
 * adaptada a prepago): cuánto rinde el saldo, en qué modelos se gasta, la
 * actividad diaria y las últimas recargas. Sin costo por mensaje.
 */
export default function UsagePanel() {
  const localize = useLocalize();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const { data, refresh, isFetching } = useAccount();
  const { models, economy, standard } = useModels();

  if (!data) {
    return null;
  }

  const available = data.wallet.availableMicros;
  const nameOf = (key: string) => models.find((m) => m.modelKey === key)?.displayName ?? key;
  const totalSpent = data.byModel.reduce((sum, m) => sum + Number(m.spentMicros), 0);

  let status = localize('com_eia_usage_status_empty');
  if (Number(available) > 0 && economy && standard) {
    status = localize('com_eia_usage_status', {
      economy: estimateMessages(available, economy).toLocaleString(),
      economyName: economy.displayName,
      standard: estimateMessages(available, standard).toLocaleString(),
      standardName: standard.displayName,
    });
  }

  return (
    <div className="flex flex-col gap-6 py-2">
      <section className="flex flex-col gap-3">
        <p className="text-text-primary text-xl font-semibold">{status}</p>
      </section>

      <section className="border-border-light flex items-center justify-between gap-4 border-t pt-5">
        <div>
          <p className="text-text-primary font-medium">{localize('com_eia_wallet_label')}</p>
          <p className="text-text-secondary text-sm">{localize('com_eia_usage_wallet_hint')}</p>
          {Number(data.wallet.heldMicros) > 0 && (
            <p className="text-text-secondary text-sm">
              {localize('com_eia_usage_held', { amount: data.wallet.held })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-text-primary text-lg font-semibold tabular-nums">
            ${data.wallet.balance}
          </span>
          {data.topupsEnabled && (
            <Button onClick={() => setPurchase({ kind: 'topup' })}>
              {localize('com_eia_topup_cta')}
            </Button>
          )}
        </div>
      </section>

      <section className="border-border-light flex flex-col gap-3 border-t pt-5">
        <p className="text-text-primary font-medium">{localize('com_eia_usage_by_model')}</p>
        {data.byModel.length === 0 && (
          <p className="text-text-secondary text-sm">{localize('com_eia_history_empty')}</p>
        )}
        {data.byModel.map((row) => {
          const percent =
            totalSpent > 0 ? Math.round((Number(row.spentMicros) / totalSpent) * 100) : 0;
          return (
            <div key={row.model} className="flex items-center gap-4 text-sm">
              <span className="text-text-primary w-32 shrink-0">{nameOf(row.model)}</span>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-label={nameOf(row.model)}
                className="bg-surface-tertiary h-1.5 flex-1 overflow-hidden rounded-full"
              >
                <div
                  className="bg-surface-submit h-full rounded-full"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-text-secondary w-12 shrink-0 text-right tabular-nums">
                {localize('com_eia_usage_percent', { percent })}
              </span>
            </div>
          );
        })}
      </section>

      <section className="border-border-light flex flex-col gap-2 border-t pt-5">
        <p className="text-text-primary font-medium">{localize('com_eia_history_title')}</p>
        <History history={data.history} />
      </section>

      <section className="border-border-light flex flex-col gap-2 border-t pt-5">
        <p className="text-text-primary font-medium">{localize('com_eia_usage_topups')}</p>
        {data.topups.length === 0 ? (
          <p className="text-text-secondary text-sm">{localize('com_eia_usage_topups_empty')}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {data.topups.map((t) => (
              <li key={t.at} className="flex justify-between">
                <span className="text-text-secondary">{dateTime(t.at)}</span>
                <span className="text-text-primary tabular-nums">
                  {localize('com_eia_usage_topup_amount', { amount: t.amount })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="text-text-secondary flex items-center gap-2 text-xs">
        {localize('com_eia_usage_updated', { date: dateTime(data.updatedAt) })}
        <button
          type="button"
          onClick={refresh}
          aria-label={localize('com_eia_usage_refresh')}
          className="hover:bg-surface-hover rounded p-1"
        >
          <RefreshCw
            className={isFetching ? 'size-3.5 animate-spin' : 'size-3.5'}
            aria-hidden="true"
          />
        </button>
      </div>

      <Checkout purchase={purchase} onClose={() => setPurchase(null)} onPaid={refresh} />
    </div>
  );
}

function History({ history }: { history: Usage['history'] }) {
  const localize = useLocalize();
  const rows = history.slice(-HISTORY_ROWS).reverse();
  if (rows.length === 0) {
    return <p className="text-text-secondary text-sm">{localize('com_eia_history_empty')}</p>;
  }
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {rows.map((row) => (
        <li key={row.day} className="flex justify-between">
          <span className="text-text-primary">
            {new Date(`${row.day}T12:00:00`).toLocaleDateString(undefined, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </span>
          <span className="text-text-secondary tabular-nums">
            {localize('com_eia_history_row', {
              messages: row.messages,
              amount: formatMicros(row.spentMicros),
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}
