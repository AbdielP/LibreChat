/**
 * estudiante-ia-app: cliente de billing-api para el navegador.
 * Se autentica con el token de sesión de LibreChat (billing-api lo verifica con el mismo JWT_SECRET).
 */
const BILLING_API_URL =
  (import.meta.env.VITE_BILLING_API_URL as string | undefined) ?? 'http://localhost:4000';

export type OrderStatus = 'PENDING' | 'PAID' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';

export interface Usage {
  /** false sin forma de pago configurada: no se muestra "Recargar" (el saldo lo carga el admin). */
  topupsEnabled: boolean;
  pass: {
    planName: string;
    endsAt: string;
    week: { number: number; resetsAt: string; percentUsed: number };
  } | null;
  /**
   * Saldo en USD con 2 decimales. balance = saldo real (truncado a centavos);
   * held = reservado por mensajes en curso (redondeado hacia arriba); available = balance - held.
   */
  wallet: {
    balance: string;
    held: string;
    available: string;
    heldMicros: string;
    availableMicros: string;
  };
  /** Consumo por día, del más antiguo al más reciente. */
  history: { day: string; spentMicros: string; messages: number }[];
  /** Gasto por modelo en los últimos 30 días, de mayor a menor. */
  byModel: { model: string; spentMicros: string; messages: number }[];
  /** Últimas recargas acreditadas. */
  topups: { at: string; amount: string }[];
  updatedAt: string;
}

/** Modelo con el costo de un mensaje típico, para estimar cuánto rinde el saldo. */
export interface ModelEstimate {
  modelKey: string;
  displayName: string;
  tier: 'ECONOMY' | 'STANDARD' | 'ADVANCED';
  typicalMessageMicros: string;
}

/** Cuántos mensajes típicos alcanza a pagar un monto (en micro-USD). */
export function estimateMessages(availableMicros: string | number, model: ModelEstimate): number {
  const typical = Number(model.typicalMessageMicros);
  return typical > 0 ? Math.floor(Number(availableMicros) / typical) : 0;
}

export interface Plan {
  code: string;
  name: string;
  price: string;
  durationDays: number;
  weeklyAllowance: string;
}

/** Datos que el botón de Yappy necesita para continuar el pago (evento eventPayment). */
export interface PaymentSession {
  orderId: string;
  transactionId: string;
  token: string;
  documentName: string;
  /** Solo en desarrollo: página del simulador de Yappy. */
  simulatorUrl: string | null;
}

/** Lo que costó un mensaje y en qué se fue (resumen bajo cada respuesta). */
export interface MessageCost {
  messageId: string;
  chargedMicros: string;
  models: string[];
  calls: number;
  webSearches: number;
  tools: string[];
  dataAnalysis: boolean;
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
  getUsage: (token: string) => request<Usage>('/me/usage', token),
  getPlans: (token: string) => request<Plan[]>('/me/plans', token),
  getModels: (token: string) => request<ModelEstimate[]>('/me/models', token),
  /** Qué está haciendo el mensaje en curso (ej. "Creando el archivo…"), o null. */
  getActivity: (token: string) => request<{ status: string | null }>('/me/activity', token),
  getMessageCosts: (token: string, ids: string[]) =>
    request<MessageCost[]>(
      `/me/message-costs?ids=${ids.map(encodeURIComponent).join(',')}`,
      token,
    ),
  createTopUp: (token: string, amountCents: number) =>
    request<PaymentSession>('/me/topups', token, {
      method: 'POST',
      body: JSON.stringify({ amountCents }),
    }),
  buyPass: (token: string, planCode: string) =>
    request<PaymentSession>('/me/passes', token, {
      method: 'POST',
      body: JSON.stringify({ planCode }),
    }),
  /** Estado de cualquier orden propia (recarga o pase). */
  getOrder: (token: string, orderId: string) =>
    request<{ orderId: string; status: OrderStatus; amount: string }>(
      `/me/topups/${encodeURIComponent(orderId)}`,
      token,
    ),
};

/** micro-USD → "$0.0123" (4 decimales si es menos de un centavo, si no 2). */
export function formatMicros(micros: string): string {
  const usd = Number(micros) / 1_000_000;
  return `$${usd.toFixed(usd > 0 && usd < 0.01 ? 4 : 2)}`;
}
