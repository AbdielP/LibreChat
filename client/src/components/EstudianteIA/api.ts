/**
 * estudiante-ia-app: cliente de billing-api para el navegador.
 * Se autentica con el token de sesión de LibreChat (billing-api lo verifica con el mismo JWT_SECRET).
 */
const BILLING_API_URL =
  (import.meta.env.VITE_BILLING_API_URL as string | undefined) ?? 'http://localhost:4000';

export interface Wallet {
  /** Saldo en USD con 2 decimales, truncado a centavos. */
  balance: string;
  available: string;
}

export type TopUpStatus = 'PENDING' | 'PAID' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';

export interface TopUpOrder {
  orderId: string;
  transactionId: string;
  token: string;
  documentName: string;
  /** Solo en desarrollo: página del simulador de Yappy. */
  simulatorUrl: string | null;
}

export class BillingApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'BillingApiError';
  }
}

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BILLING_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  if (!res.ok) {
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    throw new BillingApiError(
      res.status,
      message ?? 'No se pudo conectar con el servicio de saldo',
    );
  }
  return body as T;
}

export const billingApi = {
  getWallet: (token: string) => request<Wallet>('/me/balance', token),
  createTopUp: (token: string, amountCents: number) =>
    request<TopUpOrder>('/me/topups', token, {
      method: 'POST',
      body: JSON.stringify({ amountCents }),
    }),
  getTopUp: (token: string, orderId: string) =>
    request<{ orderId: string; status: TopUpStatus; amount: string }>(
      `/me/topups/${encodeURIComponent(orderId)}`,
      token,
    ),
};
