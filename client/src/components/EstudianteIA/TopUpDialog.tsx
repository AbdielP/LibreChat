import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, XCircle } from 'lucide-react';
import {
  Button,
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
  Spinner,
} from '@librechat/client';
import type { TopUpOrder, TopUpStatus } from './api';
import { useAuthContext, useLocalize } from '~/hooks';
import { billingApi } from './api';
import { cn } from '~/utils';

const PRESET_AMOUNTS = [2, 3, 5, 10];
const MIN_USD = 1;
const MAX_USD = 50;
const POLL_INTERVAL_MS = 2_000;

type Step =
  | { kind: 'choose' }
  | { kind: 'creating' }
  | { kind: 'waiting'; order: TopUpOrder }
  | { kind: 'done'; status: TopUpStatus; amount: string };

interface TopUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaid: () => void;
}

/**
 * Recarga de saldo con Yappy. Crea la orden en billing-api y espera la
 * confirmación (que llega a billing-api por el aviso firmado de Yappy).
 * En desarrollo el pago se hace en el simulador; con Yappy real, aquí se
 * montará el botón oficial (web component btn-yappy).
 */
export default function TopUpDialog({ open, onOpenChange, onPaid }: TopUpDialogProps) {
  const localize = useLocalize();
  const { token } = useAuthContext();
  const [amount, setAmount] = useState('3');
  const [step, setStep] = useState<Step>({ kind: 'choose' });
  const [error, setError] = useState<string | null>(null);

  const amountUsd = Number(amount);
  const validAmount =
    Number.isFinite(amountUsd) &&
    amountUsd >= MIN_USD &&
    amountUsd <= MAX_USD &&
    /^\d+(\.\d{1,2})?$/.test(amount);

  useEffect(() => {
    if (!open) {
      setStep({ kind: 'choose' });
      setError(null);
    }
  }, [open]);

  // Mientras se espera el pago, se consulta el estado de la orden.
  useEffect(() => {
    if (step.kind !== 'waiting' || !token) {
      return;
    }
    const timer = setInterval(async () => {
      try {
        const order = await billingApi.getTopUp(token, step.order.orderId);
        if (order.status !== 'PENDING') {
          setStep({ kind: 'done', status: order.status, amount: order.amount });
          if (order.status === 'PAID') {
            onPaid();
          }
        }
      } catch {
        // Un fallo puntual de red no corta la espera; se reintenta en el próximo ciclo.
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [step, token, onPaid]);

  const startPayment = async () => {
    if (!token || !validAmount) {
      return;
    }
    setError(null);
    setStep({ kind: 'creating' });
    try {
      const order = await billingApi.createTopUp(token, Math.round(amountUsd * 100));
      setStep({ kind: 'waiting', order });
      if (order.simulatorUrl) {
        window.open(order.simulatorUrl, '_blank', 'noopener');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : localize('com_eia_topup_create_error'));
      setStep({ kind: 'choose' });
    }
  };

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent className="w-11/12 max-w-md">
        <OGDialogHeader>
          <OGDialogTitle>{localize('com_eia_topup_title')}</OGDialogTitle>
        </OGDialogHeader>

        {(step.kind === 'choose' || step.kind === 'creating') && (
          <div className="flex flex-col gap-4">
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
            {error && <p className="text-text-destructive text-sm">{error}</p>}
            <Button
              onClick={startPayment}
              disabled={!validAmount || step.kind === 'creating'}
              className="w-full"
            >
              {step.kind === 'creating' ? (
                <Spinner className="size-4" />
              ) : (
                localize('com_eia_topup_pay', { amount: validAmount ? amountUsd.toFixed(2) : '--' })
              )}
            </Button>
          </div>
        )}

        {step.kind === 'waiting' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Spinner className="size-6" />
            <p className="text-text-primary text-sm">{localize('com_eia_topup_waiting')}</p>
            <p className="text-text-secondary text-xs">{localize('com_eia_topup_waiting_hint')}</p>
            {step.order.simulatorUrl && (
              <a
                href={step.order.simulatorUrl}
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
                  {localize('com_eia_topup_paid', { amount: step.amount })}
                </p>
              </>
            ) : (
              <>
                <XCircle className="text-text-secondary size-8" aria-hidden="true" />
                <p className="text-text-primary text-sm">{localize('com_eia_topup_failed')}</p>
              </>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {localize('com_ui_close')}
            </Button>
          </div>
        )}
      </OGDialogContent>
    </OGDialog>
  );
}
