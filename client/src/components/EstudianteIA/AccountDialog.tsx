import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Ticket, Wallet } from 'lucide-react';
import {
  Button,
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
} from '@librechat/client';
import type { Purchase } from './Checkout';
import type { Plan, Usage } from './api';
import { useAuthContext, useLocalize } from '~/hooks';
import { PASS_WARNING_PERCENT } from './useAccount';
import { billingApi, formatMicros } from './api';
import { cn } from '~/utils';

const HISTORY_ROWS = 7;

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usage: Usage | undefined;
  onBuy: (purchase: Purchase) => void;
}

/**
 * estudiante-ia-app: sección "Uso". Muestra el pase (con su barra semanal), el
 * saldo extra y el consumo de los últimos días. Sin costo por mensaje, a propósito:
 * se muestra cuánto queda, no un taxímetro.
 */
export default function AccountDialog({ open, onOpenChange, usage, onBuy }: AccountDialogProps) {
  const localize = useLocalize();
  const { token } = useAuthContext();
  const plans = useQuery({
    queryKey: ['estudiante-ia', 'plans'],
    queryFn: () => billingApi.getPlans(token as string),
    enabled: open && !!token,
    staleTime: 5 * 60_000,
  });
  const offer: Plan | undefined = plans.data?.[0];

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent className="w-11/12 max-w-md">
        <OGDialogHeader>
          <OGDialogTitle>{localize('com_eia_account_title')}</OGDialogTitle>
        </OGDialogHeader>

        <div className="flex flex-col gap-4">
          <PassCard usage={usage} offer={offer} onBuy={onBuy} />

          <section className="border-border-light flex items-center justify-between rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <Wallet className="text-text-secondary size-5" aria-hidden="true" />
              <div>
                <p className="text-text-secondary text-sm">{localize('com_eia_wallet_label')}</p>
                <p className="text-text-primary text-lg font-semibold tabular-nums">
                  ${usage?.wallet.available ?? '0.00'}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => onBuy({ kind: 'topup' })}>
              {localize('com_eia_topup_cta')}
            </Button>
          </section>

          <History history={usage?.history ?? []} />
        </div>
      </OGDialogContent>
    </OGDialog>
  );
}

function PassCard({
  usage,
  offer,
  onBuy,
}: {
  usage: Usage | undefined;
  offer: Plan | undefined;
  onBuy: (purchase: Purchase) => void;
}) {
  const localize = useLocalize();
  const pass = usage?.pass;

  if (!pass) {
    return (
      <section className="border-border-medium flex flex-col gap-3 rounded-xl border p-4">
        <div className="flex items-center gap-2">
          <Ticket className="text-text-secondary size-5" aria-hidden="true" />
          <p className="text-text-primary font-semibold">{localize('com_eia_pass_none_title')}</p>
        </div>
        {offer && (
          <>
            <p className="text-text-secondary text-sm">
              {localize('com_eia_pass_terms', {
                days: offer.durationDays,
                allowance: offer.weeklyAllowance,
              })}
            </p>
            <Button onClick={() => onBuy({ kind: 'pass', plan: offer })}>
              {localize('com_eia_pass_buy_cta', { price: offer.price })}
            </Button>
          </>
        )}
      </section>
    );
  }

  const used = pass.week.percentUsed;
  const resetsAt = new Date(pass.week.resetsAt).toLocaleString(undefined, {
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
  });
  const endsAt = new Date(pass.endsAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
  });

  return (
    <section className="border-border-light flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ticket className="text-text-secondary size-5" aria-hidden="true" />
          <p className="text-text-primary font-semibold">{pass.planName}</p>
        </div>
        <p className="text-text-secondary text-xs">
          {localize('com_eia_pass_until', { date: endsAt })}
        </p>
      </div>

      <div>
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-text-secondary">
            {localize('com_eia_pass_week', { number: pass.week.number })}
          </span>
          <span
            className={cn(
              'tabular-nums',
              used >= PASS_WARNING_PERCENT ? 'text-text-warning' : 'text-text-primary',
            )}
          >
            {localize('com_eia_pass_percent_used', { percent: used })}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={used}
          aria-label={localize('com_eia_pass_progress_label')}
          className="bg-surface-tertiary h-2 w-full overflow-hidden rounded-full"
        >
          <div
            className={cn(
              'h-full rounded-full transition-all motion-reduce:transition-none',
              used >= PASS_WARNING_PERCENT ? 'bg-surface-destructive' : 'bg-surface-submit',
            )}
            style={{ width: `${used}%` }}
          />
        </div>
      </div>

      <p className="text-text-secondary flex items-center gap-1.5 text-xs">
        <CalendarClock className="size-3.5" aria-hidden="true" />
        {used >= 100
          ? localize('com_eia_pass_exhausted', { date: resetsAt })
          : localize('com_eia_pass_resets', { date: resetsAt })}
      </p>
    </section>
  );
}

function History({ history }: { history: Usage['history'] }) {
  const localize = useLocalize();
  const rows = history.slice(-HISTORY_ROWS).reverse();

  return (
    <section className="flex flex-col gap-2">
      <p className="text-text-primary text-sm font-medium">{localize('com_eia_history_title')}</p>
      {rows.length === 0 ? (
        <p className="text-text-secondary text-sm">{localize('com_eia_history_empty')}</p>
      ) : (
        <ul className="divide-border-light border-border-light divide-y rounded-xl border">
          {rows.map((row) => (
            <li key={row.day} className="flex justify-between px-4 py-2 text-sm">
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
      )}
    </section>
  );
}
