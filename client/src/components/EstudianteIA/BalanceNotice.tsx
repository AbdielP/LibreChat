import { memo, useState } from 'react';
import type { Purchase } from './Checkout';
import { useAccount } from './useAccount';
import { useLocalize } from '~/hooks';
import Checkout from './Checkout';

/** Sin forma de pago, la recarga se pide por la página de contacto. */
const CONTACT_URL = '/legal/contacto.html';

/**
 * estudiante-ia-app: aviso sobre la caja de texto cuando se acabó el saldo,
 * para que no se entere recién al enviar.
 */
function BalanceNotice() {
  const localize = useLocalize();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const { data, isEmpty, refresh } = useAccount();

  // Saldo bajo ya se ve en la cartera y se avisa una vez en el chat: aquí, solo sin saldo.
  if (!data || !isEmpty) {
    return null;
  }

  const canTopUp = data.topupsEnabled;
  const free = data.freeTier;
  const freeLeft = free?.eligible ? Math.max(free.limit - free.used, 0) : null;
  let text = localize('com_eia_notice_low', { amount: data.wallet.balance });
  if (isEmpty) {
    text = localize('com_eia_notice_empty');
    if (freeLeft != null && freeLeft > 0) {
      text = localize('com_eia_notice_free_left', { count: freeLeft });
    } else if (freeLeft === 0) {
      text = localize('com_eia_notice_free_used');
    }
  }

  return (
    <>
      <div
        role="status"
        className="text-text-primary mx-auto flex w-full max-w-3xl items-center justify-center gap-2 px-4 pb-2 text-sm xl:max-w-4xl"
      >
        <span className={isEmpty ? 'text-text-warning font-medium' : undefined}>{text}</span>
        {canTopUp ? (
          <button
            type="button"
            onClick={() => setPurchase({ kind: 'topup' })}
            className="text-link font-medium hover:underline"
          >
            {localize('com_eia_topup_cta')}
          </button>
        ) : (
          <a
            href={CONTACT_URL}
            target="_blank"
            rel="noreferrer"
            className="text-link font-medium hover:underline"
          >
            {localize('com_eia_notice_ask_topup')}
          </a>
        )}
      </div>
      <Checkout purchase={purchase} onClose={() => setPurchase(null)} onPaid={refresh} />
    </>
  );
}

export default memo(BalanceNotice);
