import { memo, useState } from 'react';
import { Wallet } from 'lucide-react';
import { TooltipAnchor } from '@librechat/client';
import type { Purchase } from './Checkout';
import { useAccount } from './useAccount';
import { useLocalize } from '~/hooks';
import Checkout from './Checkout';
import { cn } from '~/utils';

/**
 * estudiante-ia-app: saldo en la barra superior. Al hacer clic abre la recarga.
 * El detalle de consumo vive en Configuración → Uso. Discreto a propósito: solo
 * cambia de color cuando el saldo está bajo.
 */
function BalancePill() {
  const localize = useLocalize();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const { data, isLoading, isError, isLow, refresh } = useAccount();

  // Sin forma de pago (antes de tener Yappy) el saldo solo se muestra: lo carga el admin.
  const canTopUp = data?.topupsEnabled ?? false;
  // Saldo real: una reserva de un mensaje en curso no lo hace "bajar" (el detalle está en Uso).
  let label = `$${data?.wallet.balance ?? '0.00'}`;
  if (isLoading) {
    label = '…';
  }
  if (isError) {
    label = localize('com_eia_balance_unavailable');
  }

  let tooltip = localize('com_eia_balance_readonly_tooltip');
  if (canTopUp) {
    tooltip = isLow ? localize('com_eia_balance_low_tooltip') : localize('com_eia_balance_tooltip');
  }

  return (
    <>
      <TooltipAnchor
        description={tooltip}
        // El ancla pone cursor-pointer; sin recarga, el saldo no parece clicable.
        className={canTopUp ? undefined : 'cursor-default'}
        render={
          <button
            type="button"
            onClick={canTopUp ? () => setPurchase({ kind: 'topup' }) : undefined}
            aria-disabled={!canTopUp}
            aria-label={
              canTopUp
                ? localize('com_eia_balance_aria', { amount: label })
                : localize('com_eia_balance_readonly_aria', { amount: label })
            }
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors',
              isLow && canTopUp
                ? 'border-border-medium text-text-warning hover:bg-surface-hover'
                : 'border-border-light text-text-primary bg-transparent',
              canTopUp && 'hover:bg-surface-hover',
            )}
          >
            <Wallet className="size-4" aria-hidden="true" />
            <span className="tabular-nums">{label}</span>
          </button>
        }
      />
      <Checkout purchase={purchase} onClose={() => setPurchase(null)} onPaid={refresh} />
    </>
  );
}

export default memo(BalancePill);
