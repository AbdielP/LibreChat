import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ExternalLink, XCircle } from 'lucide-react';
import {
  Button,
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
  Spinner,
} from '@librechat/client';
import type { OrderStatus, PaymentSession, Plan } from './api';
import type { YappyButtonHandle } from './YappyButton';
import { useAuthContext, useLocalize } from '~/hooks';
import YappyButton from './YappyButton';
import { billingApi } from './api';
import { cn } from '~/utils';

const PRESET_AMOUNTS = [2, 3, 5, 10];
const MIN_USD = 1;
const MAX_USD = 50;
const POLL_INTERVAL_MS = 2_000;

export type Purchase = { kind: 'topup' } | { kind: 'pass'; plan: Plan };

type Step =
  | { kind: 'choose' }
  | { kind: 'waiting'; session: PaymentSession }
  | { kind: 'done'; status: OrderStatus; amount: string };

interface CheckoutProps {
  purchase: Purchase | null;
  onClose: () => void;
  onPaid: () => void;
}

/**
 * estudiante-ia-app: pago con Yappy de una recarga de saldo extra o de un pase.
 * El precio del pase lo fija billing-api (el cliente solo envía el código del plan).
 * Tras crear la orden se espera la confirmación, que llega a billing-api por el
 * aviso firmado de Yappy; aquí solo se consulta el estado de la orden.
 */
export default function Checkout({ purchase, onClose, onPaid }: CheckoutProps) {
  const localize = useLocalize();
  const { token } = useAuthContext();
  const yappyRef = useRef<YappyButtonHandle>(null);
  const [amount, setAmount] = useState('3');
  const [step, setStep] = useState<Step>({ kind: 'choose' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountUsd = Number(amount);
  const validAmount =
    Number.isFinite(amountUsd) &&
    amountUsd >= MIN_USD &&
    amountUsd <= MAX_USD &&
    /^\d+(\.\d{1,2})?$/.test(amount);
  const canPay = purchase?.kind === 'pass' || validAmount;

  useEffect(() => {
    if (purchase === null) {
      setStep({ kind: 'choose' });
      setError(null);
      setCreating(false);
    }
  }, [purchase]);

  useEffect(() => {
    if (step.kind !== 'waiting' || !token) {
      return;
    }
    const timer = setInterval(async () => {
      try {
        const order = await billingApi.getOrder(token, step.session.orderId);
        if (order.status === 'PENDING') {
          return;
        }
        setStep({ kind: 'done', status: order.status, amount: order.amount });
        if (order.status === 'PAID') {
          onPaid();
        }
      } catch {
        // Un fallo puntual de red no corta la espera; se reintenta en el próximo ciclo.
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [step, token, onPaid]);

  const startPayment = async () => {
    if (!token || !purchase || !canPay || creating) {
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const session =
        purchase.kind === 'pass'
          ? await billingApi.buyPass(token, purchase.plan.code)
          : await billingApi.createTopUp(token, Math.round(amountUsd * 100));
      setStep({ kind: 'waiting', session });
      if (session.simulatorUrl) {
        window.open(session.simulatorUrl, '_blank', 'noopener');
      } else {
        yappyRef.current?.pay(session);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : localize('com_eia_topup_create_error'));
    } finally {
      setCreating(false);
    }
  };

  const title =
    purchase?.kind === 'pass'
      ? localize('com_eia_pass_buy_title')
      : localize('com_eia_topup_title');

  return (
    <OGDialog open={purchase !== null} onOpenChange={(open) => !open && onClose()}>
      <OGDialogContent className="w-11/12 max-w-md">
        <OGDialogHeader>
          <OGDialogTitle>{title}</OGDialogTitle>
        </OGDialogHeader>

        {step.kind === 'choose' && purchase?.kind === 'pass' && (
          <div className="border-border-light flex flex-col gap-1 rounded-xl border p-4">
            <p className="text-text-primary text-lg font-semibold">
              {localize('com_eia_pass_name_price', {
                name: purchase.plan.name,
                price: purchase.plan.price,
              })}
            </p>
            <p className="text-text-secondary text-sm">
              {localize('com_eia_pass_terms', {
                days: purchase.plan.durationDays,
                allowance: purchase.plan.weeklyAllowance,
              })}
            </p>
          </div>
        )}

        {step.kind === 'choose' && purchase?.kind === 'topup' && (
          <div className="flex flex-col gap-3">
            <p className="text-text-secondary text-sm">{localize('com_eia_topup_description')}</p>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_AMOUNTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAmount(String(value))}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    amount === String(value)
                      ? 'border-text-primary bg-surface-active text-text-primary'
                      : 'border-border-medium text-text-secondary hover:bg-surface-hover',
                  )}
                >
                  ${value}
                </button>
              ))}
            </div>
            <label className="text-text-secondary flex flex-col gap-1 text-sm">
              {localize('com_eia_topup_custom_amount')}
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(',', '.'))}
                className="border-border-medium text-text-primary rounded-lg border bg-transparent px-3 py-2"
              />
              <span className="text-xs">
                {localize('com_eia_topup_range', { min: MIN_USD, max: MAX_USD })}
              </span>
            </label>
          </div>
        )}

        {step.kind === 'choose' && (
          <div className="flex flex-col gap-2 pt-2">
            {error && <p className="text-text-destructive text-sm">{error}</p>}
            <YappyButton ref={yappyRef} onClick={startPayment} disabled={!canPay || creating} />
            <p className="text-text-secondary text-center text-xs">
              {localize('com_eia_yappy_secure_note')}
            </p>
          </div>
        )}

        {step.kind === 'waiting' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Spinner className="size-6" />
            <p className="text-text-primary text-sm">{localize('com_eia_topup_waiting')}</p>
            <p className="text-text-secondary text-xs">{localize('com_eia_topup_waiting_hint')}</p>
            {step.session.simulatorUrl && (
              <a
                href={step.session.simulatorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-secondary flex items-center gap-1 text-xs underline"
              >
                <ExternalLink className="size-3" aria-hidden="true" />
                {localize('com_eia_topup_open_simulator')}
              </a>
            )}
          </div>
        )}

        {step.kind === 'done' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            {step.status === 'PAID' ? (
              <>
                <CheckCircle2 className="text-surface-submit size-8" aria-hidden="true" />
                <p className="text-text-primary text-sm">
                  {purchase?.kind === 'pass'
                    ? localize('com_eia_pass_activated')
                    : localize('com_eia_topup_paid', { amount: step.amount })}
                </p>
              </>
            ) : (
              <>
                <XCircle className="text-text-secondary size-8" aria-hidden="true" />
                <p className="text-text-primary text-sm">{localize('com_eia_topup_failed')}</p>
              </>
            )}
            <Button variant="outline" onClick={onClose}>
              {localize('com_ui_close')}
            </Button>
          </div>
        )}
      </OGDialogContent>
    </OGDialog>
  );
}
