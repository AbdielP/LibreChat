import { memo, useState } from 'react';
import type { Purchase } from './Checkout';
import { useAccount } from './useAccount';
import { useLocalize } from '~/hooks';
import Checkout from './Checkout';

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
  // Con mensajes gratis se dice lo que tiene (una cuenta nueva nunca "se quedó sin saldo");
  // el color de advertencia queda para cuando ya no puede escribir.
  const hasFree = freeLeft != null && freeLeft > 0;
  let text = localize('com_eia_notice_empty');
  if (freeLeft === 1) {
    text = localize('com_eia_notice_free_left_one');
  } else if (hasFree) {
    text = localize('com_eia_notice_free_left_other', { count: freeLeft });
  } else if (freeLeft === 0) {
    text = localize('com_eia_notice_free_used');
  }

  return (
    <>
      <div
        role="status"
        className="text-text-primary mx-auto flex w-full max-w-3xl items-center justify-center gap-2 px-4 pb-2 text-sm xl:max-w-4xl"
      >
        <span className={hasFree ? undefined : 'text-text-warning font-medium'}>{text}</span>
        {/* La misma recarga de la cartera (Yappy); sin recargas activas aún no abre nada. */}
        <button
          type="button"
          onClick={canTopUp ? () => setPurchase({ kind: 'topup' }) : undefined}
          className="text-link font-medium hover:underline"
        >
          {localize('com_eia_topup_cta')}
        </button>
      </div>
      <Checkout purchase={purchase} onClose={() => setPurchase(null)} onPaid={refresh} />
    </>
  );
}

export default memo(BalanceNotice);
