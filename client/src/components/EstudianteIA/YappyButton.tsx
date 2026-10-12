import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Spinner } from '@librechat/client';
import type { PaymentSession } from './api';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

/** Botón oficial de Yappy (web component). Pruebas por defecto; producción vía env. */
const YAPPY_CDN_URL =
  (import.meta.env.VITE_YAPPY_CDN_URL as string | undefined) ??
  'https://bt-cdn-uat.yappycloud.com/v1/cdn/web-component-btn-yappy.js';

type YappyElement = HTMLElement & {
  /** Continúa el pago con los datos de la orden creada en el backend. */
  eventPayment?: (
    session: Pick<PaymentSession, 'transactionId' | 'token' | 'documentName'>,
  ) => void;
};

let scriptPromise: Promise<void> | null = null;

/**
 * El botón oficial trae `padding: 0` y su texto queda pegado al borde. Como es un
 * componente de terceros (sin clases que podamos pasarle), se le da aire con una
 * regla acotada a nuestro contenedor `[data-eia-yappy]`, sin tocar sus colores ni su marca.
 */
const YAPPY_STYLE_ID = 'eia-yappy-style';
const YAPPY_STYLE = `[data-eia-yappy] .yappy-button { padding: 0 1.5rem; gap: 0.5rem; min-height: 3rem; }`;

function ensureYappyStyle() {
  if (document.getElementById(YAPPY_STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = YAPPY_STYLE_ID;
  style.textContent = YAPPY_STYLE;
  document.head.appendChild(style);
}

/** Carga el script del botón una sola vez por página. */
function loadYappyScript(): Promise<void> {
  ensureYappyStyle();
  if (customElements.get('btn-yappy')) {
    return Promise.resolve();
  }
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = YAPPY_CDN_URL;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('No se pudo cargar el botón de Yappy'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export interface YappyButtonHandle {
  /** Entrega la orden al botón para que Yappy continúe el pago real. */
  pay: (session: PaymentSession) => void;
}

interface YappyButtonProps {
  /** Se llama al pulsar el botón: aquí se crea la orden en billing-api. */
  onClick: () => void;
  disabled?: boolean;
}

/**
 * estudiante-ia-app: botón oficial de Yappy con su marca. El clic llega a
 * `onClick` (evento eventClick del componente); luego `pay()` le pasa la orden.
 * En desarrollo, con el simulador, no se llama a `pay()`.
 */
const YappyButton = forwardRef<YappyButtonHandle, YappyButtonProps>(function YappyButton(
  { onClick, disabled = false },
  ref,
) {
  const localize = useLocalize();
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<YappyElement | null>(null);
  const onClickRef = useRef(onClick);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  onClickRef.current = onClick;

  useImperativeHandle(ref, () => ({
    pay: (session) => elementRef.current?.eventPayment?.(session),
  }));

  useEffect(() => {
    let cancelled = false;
    const handleClick = () => onClickRef.current();

    loadYappyScript()
      .then(() => {
        if (cancelled || !containerRef.current) {
          return;
        }
        const element = document.createElement('btn-yappy') as YappyElement;
        element.setAttribute('theme', 'blue');
        element.setAttribute('rounded', 'true');
        element.addEventListener('eventClick', handleClick);
        containerRef.current.replaceChildren(element);
        elementRef.current = element;
        setStatus('ready');
      })
      .catch(() => !cancelled && setStatus('error'));

    return () => {
      cancelled = true;
      elementRef.current?.removeEventListener('eventClick', handleClick);
      elementRef.current = null;
    };
  }, []);

  return (
    <div className="flex min-h-11 w-full items-center justify-center">
      {status === 'loading' && <Spinner className="size-5" />}
      {status === 'error' && (
        <p className="text-text-destructive text-sm">{localize('com_eia_yappy_unavailable')}</p>
      )}
      <div
        ref={containerRef}
        data-eia-yappy=""
        aria-disabled={disabled}
        className={cn('w-full', disabled && 'pointer-events-none opacity-50')}
      />
    </div>
  );
});

export default YappyButton;
