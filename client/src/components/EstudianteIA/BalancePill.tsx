import { memo, useState } from 'react';
import { Wallet } from 'lucide-react';
import { TooltipAnchor } from '@librechat/client';
import { useWallet } from './useWallet';
import TopUpDialog from './TopUpDialog';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

/**
 * estudiante-ia-app: saldo del estudiante en la barra superior.
 * Discreto a propósito (sin animaciones): solo cambia de color cuando el saldo
 * está bajo. Al hacer clic abre la recarga.
 */
function BalancePill() {
  const localize = useLocalize();
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError, isLow, refresh } = useWallet();

  let label = `$${data?.available ?? '0.00'}`;
  if (isLoading) {
    label = '…';
  }
  if (isError) {
    label = localize('com_eia_balance_unavailable');
  }
  const tooltip = isLow
    ? localize('com_eia_balance_low_tooltip')
    : localize('com_eia_balance_tooltip');

  return (
    <>
      <TooltipAnchor
        description={tooltip}
        render={
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={localize('com_eia_balance_aria', { amount: label })}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors',
              isLow
                ? 'border-border-medium text-text-warning hover:bg-surface-hover'
                : 'border-border-light text-text-primary hover:bg-surface-hover bg-transparent',
            )}
          >
            <Wallet className="size-4" aria-hidden="true" />
            <span className="tabular-nums">{label}</span>
            {isLow && <span className="hidden sm:inline">· {localize('com_eia_topup_cta')}</span>}
          </button>
        }
      />
      <TopUpDialog open={open} onOpenChange={setOpen} onPaid={refresh} />
    </>
  );
}

export default memo(BalancePill);
