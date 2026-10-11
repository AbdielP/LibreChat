import { memo, useState } from 'react';
import { Ticket, Wallet } from 'lucide-react';
import { TooltipAnchor } from '@librechat/client';
import type { Purchase } from './Checkout';
import AccountDialog from './AccountDialog';
import { useAccount } from './useAccount';
import { useLocalize } from '~/hooks';
import Checkout from './Checkout';
import { cn } from '~/utils';

/**
 * estudiante-ia-app: estado de la cuenta en la barra superior. Con pase muestra
 * cuánto queda de la semana; sin pase, el saldo extra. Discreto a propósito: solo
 * cambia de color cuando conviene avisar. Al hacer clic abre "Tu cuenta".
 */
function BalancePill() {
  const localize = useLocalize();
  const [accountOpen, setAccountOpen] = useState(false);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const { data, isLoading, isError, pass, isLow, passNearLimit, refresh } = useAccount();

  let label = `$${data?.wallet.available ?? '0.00'}`;
  if (pass) {
    label = localize('com_eia_pill_pass_left', { percent: 100 - pass.week.percentUsed });
  }
  if (isLoading) {
    label = '…';
  }
  if (isError) {
    label = localize('com_eia_balance_unavailable');
  }
  const warn = isLow || passNearLimit;
  const Icon = pass ? Ticket : Wallet;

  const openCheckout = (next: Purchase) => {
    setAccountOpen(false);
    setPurchase(next);
  };

  return (
    <>
      <TooltipAnchor
        description={
          warn ? localize('com_eia_balance_low_tooltip') : localize('com_eia_account_tooltip')
        }
        render={
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            aria-label={localize('com_eia_balance_aria', { amount: label })}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors',
              warn
                ? 'border-border-medium text-text-warning hover:bg-surface-hover'
                : 'border-border-light text-text-primary hover:bg-surface-hover bg-transparent',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className="tabular-nums">{label}</span>
          </button>
        }
      />
      <AccountDialog
        open={accountOpen}
        onOpenChange={setAccountOpen}
        usage={data}
        onBuy={openCheckout}
      />
      <Checkout purchase={purchase} onClose={() => setPurchase(null)} onPaid={refresh} />
    </>
  );
}

export default memo(BalancePill);
