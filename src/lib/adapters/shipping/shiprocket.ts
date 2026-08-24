import type { Paise } from '../../money';
import { gatewayFetch } from '../http';
import {
  GatewayError,
  type ServiceabilityResult,
  type ShipmentCreateInput,
  type ShipmentResult,
  type ShippingProvider,
  type TrackingEvent,
} from '../types';

/**
 * Shiprocket — courier aggregator.
 *
 * Docs: https://apidocs.shiprocket.in/
 *
 * Four properties of this API shape the driver:
 *
 *   • **Rupees and kilograms, not paise and grams.** Every amount crossing this
 *     boundary is converted exactly once, here. Weight goes out in kg with three
 *     decimals because Shiprocket silently floors a 0-decimal weight to 0 and
 *     then rejects the shipment.
 *   • **Creating a shipment is two calls.** `/orders/create/adhoc` registers the
 *     order and returns a `shipment_id`; the AWB only exists after
 *     `/courier/assign/awb`. A driver that stops after the first call hands back
 *     a shipment with no tracking number, which looks like success and isn't.
 *   • **Cancellation needs the order id, labels need the shipment id.** They are
 *     different numbers, so `providerShipmentId` carries both as `order:shipment`
 *     rather than forcing every caller to store two fields.
 *   • **The token lasts 10 days.** It is cached across hot reloads; logging in on
 *     every request would burn the login rate limit within a page load.
 */

const API_BASE = 'https://apiv2.shiprocket.in/v1/external';
/** Shiprocket tokens are valid for 10 days; refresh with a day of headroom. */
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000;

interface ShiprocketConfig {
  email: string;
  password: string;
  pickupLocation: string;
  pickupPincode: string;
}

interface SrCourier {
  courier_company_id?: number;
  courier_name?: string;
  rate?: number | string;
  freight_charge?: number | string;
  cod_charges?: number | string;
  cod?: number;
  estimated_delivery_days?: string | number;
  etd?: string;
  is_surface?: boolean;
}

interface SrServiceability {
  status?: number;
  data?: {
    available_courier_companies?: SrCourier[];
    recommended_courier_company_id?: number;
  };
}

interface SrOrderCreated {
  order_id?: number;
  shipment_id?: number;
  status?: string;
  status_code?: number;
  awb_code?: string | null;
  courier_name?: string | null;
  message?: string;
}

interface SrAwbAssigned {
  awb_assign_status?: number;
  response?: {
    data?: {
      awb_code?: string;
      courier_name?: string;
      courier_company_id?: number;
      shipment_id?: number;
      applied_weight?: number;
      freight_charges?: number | string;
      routing_code?: string;
    };
  };
  message?: string;
}

interface SrTrackActivity {
  date?: string;
  status?: string;
  activity?: string;
  location?: string;
}

interface SrTracking {
  tracking_data?: {
    track_status?: number;
    shipment_status?: number | string;
    shipment_track?: { current_status?: string; delivered_date?: string | null }[];
    shipment_track_activities?: SrTrackActivity[];
    error?: string;
  };
}

/** Cached across hot reloads so a dev session does not re-login on every save. */
const store = globalThis as unknown as {
  __shiprocketToken?: { value: string; expiresAt: number };
};

function toRupees(paise: Paise): number {
  return Number((paise / 100).toFixed(2));
}

function toPaise(rupees: number | string | undefined): Paise {
  if (rupees === undefined || rupees === null) return 0;
  const n = typeof rupees === 'number' ? rupees : Number.parseFloat(rupees);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Shiprocket bills in kilograms; three decimals keeps a 250g parcel from flooring to 0. */
function toKg(grams: number): number {
  return Number((Math.max(grams, 50) / 1000).toFixed(3));
}

/** Shiprocket's free-text statuses → our shipment vocabulary. */
function normalizeStatus(raw: string | undefined): string {
  const s = (raw ?? '').toLowerCase();
  if (!s) return 'manifested';
  if (s.includes('delivered')) return 'delivered';
  if (s.includes('out for delivery')) return 'out_for_delivery';
  if (s.includes('rto') || s.includes('return')) return 'rto';
  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('lost') || s.includes('damage')) return 'exception';
  if (s.includes('undelivered') || s.includes('failed')) return 'delivery_failed';
  if (s.includes('pickup') && s.includes('generated')) return 'pickup_scheduled';
  if (s.includes('picked')) return 'picked_up';
  if (s.includes('transit') || s.includes('shipped') || s.includes('reached')) return 'in_transit';
  return 'in_transit';
}

/**
 * Shiprocket timestamps arrive as `YYYY-MM-DD HH:mm:ss` in IST with no zone
 * marker. Parsing that as UTC shifts every tracking event 5½ hours, which is
 * enough to show a delivery before its dispatch.
 */
function parseIstDate(value: string | undefined): Date {
  if (!value) return new Date();
  const iso = value.trim().replace(' ', 'T');
  const withZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}+05:30`;
  const parsed = new Date(withZone);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/** `order:shipment` — see the class docstring. */
function packId(orderId: number | string, shipmentId: number | string): string {
  return `${orderId}:${shipmentId}`;
}

function unpackId(packed: string): { orderId: string; shipmentId: string } {
  const [orderId, shipmentId] = packed.split(':');
  if (!orderId || !shipmentId) {
    throw new GatewayError({
      code: 'BAD_REQUEST_ERROR',
      message: `shiprocket: malformed shipment reference "${packed}" (expected order:shipment)`,
      provider: 'shiprocket',
      retryable: false,
    });
  }
  return { orderId, shipmentId };
}

export class ShiprocketShipping implements ShippingProvider {
  readonly name = 'shiprocket';
  readonly mode = 'live' as const;
  readonly label = 'Shiprocket';

  private readonly config: ShiprocketConfig;

  constructor(config: ShiprocketConfig) {
    this.config = config;
  }

  private async token(): Promise<string> {
    const cached = store.__shiprocketToken;
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const response = await gatewayFetch<{ token?: string; message?: string }>({
      provider: 'shiprocket',
      url: `${API_BASE}/auth/login`,
      method: 'POST',
      body: { email: this.config.email, password: this.config.password },
      timeoutMs: 15_000,
    });

    const value = response.data.token;
    if (!value) {
      throw new GatewayError({
        code: 'AUTH_FAILED',
        message: `shiprocket: login failed — ${response.data.message ?? 'no token returned'}`,
        provider: 'shiprocket',
        retryable: false,
      });
    }

    store.__shiprocketToken = { value, expiresAt: Date.now() + TOKEN_TTL_MS };
    return value;
  }

  private async call<T>(init: {
    path: string;
    method?: 'GET' | 'POST';
    body?: unknown;
    idempotencyKey?: string;
    timeoutMs?: number;
    expectStatuses?: number[];
  }): Promise<T> {
    const bearerToken = await this.token();

    const response = await gatewayFetch<T>({
      provider: 'shiprocket',
      url: `${API_BASE}${init.path}`,
      method: init.method ?? 'GET',
      bearerToken,
      body: init.body,
      idempotencyKey: init.idempotencyKey,
      timeoutMs: init.timeoutMs ?? 20_000,
      expectStatuses: init.expectStatuses,
    });

    return response.data;
  }

  async checkServiceability(input: {
    fromPincode: string;
    toPincode: string;
    weightGrams: number;
    cod: boolean;
    declaredValue: Paise;
  }): Promise<ServiceabilityResult> {
    const query = new URLSearchParams({
      pickup_postcode: input.fromPincode || this.config.pickupPincode,
      delivery_postcode: input.toPincode,
      cod: input.cod ? '1' : '0',
      weight: String(toKg(input.weightGrams)),
      declared_value: String(toRupees(input.declaredValue)),
    }).toString();

    const data = await this.call<SrServiceability>({
      // 404 is Shiprocket's answer for "nobody delivers there" — a legitimate
      // result, not a transport failure.
      path: `/courier/serviceability/?${query}`,
      expectStatuses: [200, 404, 422],
      timeoutMs: 12_000,
    });

    const list = data.data?.available_courier_companies ?? [];

    if (list.length === 0) {
      return {
        serviceable: false,
        codAvailable: false,
        prepaidAvailable: false,
        expressAvailable: false,
        etaDays: null,
        couriers: [],
      };
    }

    const couriers = list
      .map((c) => ({
        name: c.courier_name ?? 'Courier',
        etaDays: Math.max(1, Math.round(Number(c.estimated_delivery_days ?? 3) || 3)),
        rate: toPaise(c.rate ?? c.freight_charge),
        codCharge: toPaise(c.cod_charges),
      }))
      .sort((a, b) => a.etaDays - b.etaDays || a.rate - b.rate);

    return {
      serviceable: true,
      codAvailable: list.some((c) => c.cod === 1),
      prepaidAvailable: true,
      // Air/express carriers are the non-surface ones in Shiprocket's grid.
      expressAvailable: list.some((c) => c.is_surface === false),
      etaDays: couriers[0]?.etaDays ?? null,
      couriers,
    };
  }

  async createShipment(input: ShipmentCreateInput): Promise<ShipmentResult> {
    const [firstName, ...rest] = input.consignee.name.trim().split(/\s+/);
    const subTotal = input.items.reduce((sum, i) => sum + toRupees(i.unitPrice) * i.qty, 0);

    const created = await this.call<SrOrderCreated>({
      path: '/orders/create/adhoc',
      method: 'POST',
      // The order number is unique, so a timed-out create is safe to retry.
      idempotencyKey: `shipment:${input.orderNumber}`,
      timeoutMs: 30_000,
      expectStatuses: [200, 201, 422],
      body: {
        order_id: input.orderNumber,
        order_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
        pickup_location: input.pickupLocation ?? this.config.pickupLocation,
        billing_customer_name: firstName,
        billing_last_name: rest.join(' ') || firstName,
        billing_address: input.consignee.line1,
        billing_address_2: input.consignee.line2 ?? '',
        billing_city: input.consignee.city,
        billing_pincode: input.consignee.pincode,
        billing_state: input.consignee.state,
        billing_country: input.consignee.country || 'India',
        billing_email: input.consignee.email ?? '',
        billing_phone: input.consignee.phone.replace(/\D/g, '').slice(-10),
        shipping_is_billing: true,
        order_items: input.items.map((i) => ({
          name: i.name.slice(0, 100),
          sku: i.sku,
          units: i.qty,
          selling_price: toRupees(i.unitPrice),
          hsn: i.hsn ?? '',
        })),
        payment_method: input.codAmount > 0 ? 'COD' : 'Prepaid',
        sub_total: Number(subTotal.toFixed(2)),
        length: input.dimensionsCm?.length ?? 30,
        breadth: input.dimensionsCm?.breadth ?? 25,
        height: input.dimensionsCm?.height ?? 8,
        weight: toKg(input.weightGrams),
      },
    });

    if (!created.shipment_id || !created.order_id) {
      throw new GatewayError({
        code: String(created.status_code ?? 'ORDER_CREATE_FAILED'),
        message: `shiprocket: ${created.message ?? 'order was created without a shipment id'}`,
        provider: 'shiprocket',
        retryable: false,
        raw: created,
      });
    }

    const providerShipmentId = packId(created.order_id, created.shipment_id);

    // Second call: without this the shipment has no AWB and cannot be tracked,
    // labelled or picked up.
    let awb = created.awb_code ?? null;
    let courierName = created.courier_name ?? null;
    let charges: Paise = 0;

    try {
      const assigned = await this.call<SrAwbAssigned>({
        path: '/courier/assign/awb',
        method: 'POST',
        idempotencyKey: `awb:${created.shipment_id}`,
        timeoutMs: 30_000,
        expectStatuses: [200, 400, 422],
        body: { shipment_id: created.shipment_id },
      });

      const d = assigned.response?.data;
      awb = d?.awb_code ?? awb;
      courierName = d?.courier_name ?? courierName;
      charges = toPaise(d?.freight_charges);
    } catch (error) {
      // The order exists in Shiprocket even when AWB assignment fails (no
      // capacity, wallet empty, courier down). Losing that fact would orphan the
      // order there, so the shipment id is returned with a null AWB and the
      // reason attached — the admin can retry assignment.
      const reason = error instanceof GatewayError ? error.message : String(error);
      return {
        providerShipmentId,
        awb: null,
        courierName: null,
        labelUrl: null,
        manifestUrl: null,
        trackingUrl: null,
        status: 'awb_pending',
        estimatedDeliveryDays: null,
        charges: 0,
        raw: { created, awbError: reason },
      };
    }

    return {
      providerShipmentId,
      awb,
      courierName,
      labelUrl: null,
      manifestUrl: null,
      trackingUrl: awb ? `https://shiprocket.co/tracking/${awb}` : null,
      status: awb ? 'pickup_scheduled' : 'awb_pending',
      estimatedDeliveryDays: null,
      charges,
      raw: { created },
    };
  }

  async generateLabel(providerShipmentId: string): Promise<{ labelUrl: string }> {
    const { shipmentId } = unpackId(providerShipmentId);

    const data = await this.call<{ label_created?: number; label_url?: string; response?: string }>({
      path: '/courier/generate/label',
      method: 'POST',
      idempotencyKey: `label:${shipmentId}`,
      body: { shipment_id: [Number(shipmentId)] },
    });

    if (!data.label_url) {
      throw new GatewayError({
        code: 'LABEL_FAILED',
        message: `shiprocket: ${data.response ?? 'label could not be generated'}`,
        provider: 'shiprocket',
        retryable: true,
        raw: data,
      });
    }
    return { labelUrl: data.label_url };
  }

  async generateManifest(providerShipmentIds: string[]): Promise<{ manifestUrl: string }> {
    const ids = providerShipmentIds.map((id) => Number(unpackId(id).shipmentId));

    const data = await this.call<{ manifest_url?: string; status?: number; response?: string }>({
      path: '/manifests/generate',
      method: 'POST',
      body: { shipment_id: ids },
    });

    if (!data.manifest_url) {
      throw new GatewayError({
        code: 'MANIFEST_FAILED',
        message: `shiprocket: ${data.response ?? 'manifest could not be generated'}`,
        provider: 'shiprocket',
        retryable: true,
        raw: data,
      });
    }
    return { manifestUrl: data.manifest_url };
  }

  async schedulePickup(providerShipmentId: string): Promise<{ scheduledAt: Date }> {
    const { shipmentId } = unpackId(providerShipmentId);

    const data = await this.call<{
      pickup_status?: number;
      response?: { pickup_scheduled_date?: string; data?: string };
      message?: string;
    }>({
      path: '/courier/generate/pickup',
      method: 'POST',
      idempotencyKey: `pickup:${shipmentId}`,
      expectStatuses: [200, 400],
      body: { shipment_id: [Number(shipmentId)] },
    });

    // Shiprocket returns 400 with "Already in Pickup Queue" when a pickup exists.
    // That is success from our point of view, not a failure to surface.
    const scheduled = data.response?.pickup_scheduled_date;
    return { scheduledAt: scheduled ? parseIstDate(scheduled) : new Date() };
  }

  async track(awb: string): Promise<{ status: string; events: TrackingEvent[] }> {
    const data = await this.call<SrTracking>({
      path: `/courier/track/awb/${encodeURIComponent(awb)}`,
      expectStatuses: [200, 404],
      timeoutMs: 12_000,
    });

    const t = data.tracking_data;
    if (!t || t.error) {
      throw new GatewayError({
        code: 'not_found',
        message: `shiprocket: ${t?.error ?? `no tracking data for ${awb}`}`,
        provider: 'shiprocket',
        retryable: false,
        userMessage: 'Tracking information is not available for this shipment yet.',
      });
    }

    const activities = t.shipment_track_activities ?? [];

    const events: TrackingEvent[] = activities
      .map((a) => ({
        status: normalizeStatus(a.status ?? a.activity),
        message: a.activity ?? a.status ?? 'Update',
        location: a.location ?? null,
        occurredAt: parseIstDate(a.date),
      }))
      // Shiprocket returns newest-first; our timeline renders oldest-first.
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    const current = t.shipment_track?.[0]?.current_status;
    const status = current
      ? normalizeStatus(current)
      : (events[events.length - 1]?.status ?? 'manifested');

    return { status, events };
  }

  async cancelShipment(providerShipmentId: string): Promise<{ cancelled: boolean }> {
    const { orderId } = unpackId(providerShipmentId);

    const data = await this.call<{ status?: number; message?: string }>({
      path: '/orders/cancel',
      method: 'POST',
      idempotencyKey: `cancel:${orderId}`,
      expectStatuses: [200, 400, 422],
      body: { ids: [Number(orderId)] },
    });

    const already = /already/i.test(data.message ?? '');
    if (data.status !== 200 && !already) {
      throw new GatewayError({
        code: 'CANCEL_FAILED',
        message: `shiprocket: ${data.message ?? 'shipment could not be cancelled'}`,
        provider: 'shiprocket',
        retryable: false,
        raw: data,
      });
    }
    return { cancelled: true };
  }

  async createReturnPickup(
    input: ShipmentCreateInput & { originalAwb?: string },
  ): Promise<ShipmentResult> {
    const [firstName, ...rest] = input.consignee.name.trim().split(/\s+/);
    const subTotal = input.items.reduce((sum, i) => sum + toRupees(i.unitPrice) * i.qty, 0);

    // A return reverses the direction: the customer is the pickup address and the
    // warehouse is the destination. Shiprocket has a dedicated endpoint for it,
    // and a return is always prepaid — nobody collects cash on a reverse pickup.
    const created = await this.call<SrOrderCreated>({
      path: '/orders/create/return',
      method: 'POST',
      idempotencyKey: `return:${input.orderNumber}`,
      timeoutMs: 30_000,
      expectStatuses: [200, 201, 422],
      body: {
        order_id: `RET-${input.orderNumber}`,
        order_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
        channel_id: '',
        pickup_customer_name: firstName,
        pickup_last_name: rest.join(' ') || firstName,
        pickup_address: input.consignee.line1,
        pickup_address_2: input.consignee.line2 ?? '',
        pickup_city: input.consignee.city,
        pickup_state: input.consignee.state,
        pickup_country: input.consignee.country || 'India',
        pickup_pincode: input.consignee.pincode,
        pickup_email: input.consignee.email ?? '',
        pickup_phone: input.consignee.phone.replace(/\D/g, '').slice(-10),
        shipping_customer_name: 'LUMEN AND CO',
        shipping_address: 'Returns Desk, LUMEN AND CO',
        shipping_city: 'Mumbai',
        shipping_state: 'Maharashtra',
        shipping_country: 'India',
        shipping_pincode: this.config.pickupPincode,
        shipping_phone: '9999999999',
        order_items: input.items.map((i) => ({
          name: i.name.slice(0, 100),
          sku: i.sku,
          units: i.qty,
          selling_price: toRupees(i.unitPrice),
          hsn: i.hsn ?? '',
        })),
        payment_method: 'Prepaid',
        sub_total: Number(subTotal.toFixed(2)),
        length: input.dimensionsCm?.length ?? 30,
        breadth: input.dimensionsCm?.breadth ?? 25,
        height: input.dimensionsCm?.height ?? 8,
        weight: toKg(input.weightGrams),
      },
    });

    if (!created.shipment_id || !created.order_id) {
      throw new GatewayError({
        code: String(created.status_code ?? 'RETURN_CREATE_FAILED'),
        message: `shiprocket: ${created.message ?? 'return pickup was not created'}`,
        provider: 'shiprocket',
        retryable: false,
        raw: created,
      });
    }

    return {
      providerShipmentId: packId(created.order_id, created.shipment_id),
      awb: created.awb_code ?? null,
      courierName: created.courier_name ?? null,
      labelUrl: null,
      manifestUrl: null,
      trackingUrl: created.awb_code ? `https://shiprocket.co/tracking/${created.awb_code}` : null,
      status: 'return_pickup_scheduled',
      estimatedDeliveryDays: null,
      charges: 0,
      raw: { created, direction: 'reverse', originalAwb: input.originalAwb ?? null },
    };
  }
}
