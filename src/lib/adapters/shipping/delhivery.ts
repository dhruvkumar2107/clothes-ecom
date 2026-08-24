import type { Paise } from '../../money';
import { formEncode, gatewayFetch } from '../http';
import {
  GatewayError,
  type ServiceabilityResult,
  type ShipmentCreateInput,
  type ShipmentResult,
  type ShippingProvider,
  type TrackingEvent,
} from '../types';

/**
 * Delhivery — direct courier integration.
 *
 * Docs: https://one.delhivery.com/developer-portal
 *
 * Delhivery's API predates most conventions and has three quirks that a driver
 * must accommodate rather than fight:
 *
 *   • **Shipment creation is form-encoded JSON.** The body is
 *     `format=json&data=<url-encoded JSON>`, not a JSON request. Posting real
 *     JSON gets a 200 with an empty package list — success-shaped silence, the
 *     worst possible failure mode.
 *   • **Weight is in grams, amounts in rupees.** The opposite unit choice from
 *     Shiprocket's kilograms, which is exactly why unit conversion lives at the
 *     driver boundary and nowhere else.
 *   • **The waybill *is* the shipment id.** There is no separate order handle, so
 *     `providerShipmentId` and `awb` are the same string — simpler than
 *     Shiprocket, and worth stating so nobody "fixes" it later.
 *
 * Auth is a static token in an `Authorization: Token …` header — no login call,
 * no expiry.
 */

interface DelhiveryConfig {
  apiToken: string;
  baseUrl: string;
  clientName: string;
  pickupPincode: string;
}

interface DlPostalCode {
  pin?: number | string;
  district?: string;
  state_code?: string;
  /** "Y"/"N" — cash on delivery accepted. */
  cod?: string;
  /** "Y"/"N" — prepaid accepted. */
  pre_paid?: string;
  /** "Y"/"N" — cash (part-payment) accepted. */
  cash?: string;
  /** "Y"/"N" — reverse pickup available. */
  pickup?: string;
  /** "Y"/"N" — express/air. */
  is_oda?: string;
  max_amount?: number;
  remarks?: string;
}

interface DlServiceability {
  delivery_codes?: { postal_code?: DlPostalCode }[];
}

interface DlPackage {
  status?: string;
  waybill?: string;
  refnum?: string;
  remarks?: string[];
  cod_amount?: number;
  payment?: string;
  serviceable?: boolean;
  sort_code?: string | null;
  client?: string;
}

interface DlCreateResponse {
  success?: boolean;
  packages?: DlPackage[];
  rmk?: string;
  error?: string | string[];
  upload_wbn?: string;
}

interface DlScan {
  ScanDetail?: {
    Scan?: string;
    ScanDateTime?: string;
    ScannedLocation?: string;
    Instructions?: string;
    StatusDateTime?: string;
    StatusCode?: string;
  };
}

interface DlTracking {
  ShipmentData?: {
    Shipment?: {
      AWB?: string;
      Status?: {
        Status?: string;
        StatusDateTime?: string;
        StatusLocation?: string;
        Instructions?: string;
        StatusType?: string;
      };
      Scans?: DlScan[];
      PickUpDate?: string | null;
      ExpectedDeliveryDate?: string | null;
    };
  }[];
  Error?: string;
}

function toRupees(paise: Paise): number {
  return Number((paise / 100).toFixed(2));
}

/** "Y"/"y"/true → true. Delhivery is inconsistent about which it sends. */
function yes(flag: string | boolean | undefined): boolean {
  if (typeof flag === 'boolean') return flag;
  return (flag ?? '').toUpperCase() === 'Y';
}

/** Delhivery's scan text → our shipment vocabulary. */
function normalizeStatus(status: string | undefined, statusType?: string): string {
  const s = (status ?? '').toLowerCase();
  const t = (statusType ?? '').toUpperCase();

  if (s.includes('delivered')) return 'delivered';
  if (s.includes('rto') || t === 'RT') return 'rto';
  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('lost') || s.includes('damaged')) return 'exception';
  if (s.includes('undelivered') || s.includes('not delivered')) return 'delivery_failed';
  if (s.includes('dispatched') || s.includes('out for delivery')) return 'out_for_delivery';
  if (s.includes('in transit') || s.includes('transit') || t === 'UD') return 'in_transit';
  if (s.includes('picked') || s.includes('pickup complete')) return 'picked_up';
  if (s.includes('manifest') || s.includes('pickup scheduled')) return 'pickup_scheduled';
  return 'in_transit';
}

/**
 * Delhivery timestamps are ISO-shaped but zone-less IST (`2026-08-20T14:22:11.000`).
 * Reading them as UTC shifts every scan 5½ hours earlier, which is enough to
 * order a delivery before its own pickup on the tracking timeline.
 */
function parseIstDate(value: string | undefined | null): Date {
  if (!value) return new Date();
  const trimmed = value.trim().replace(' ', 'T');
  const withZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed) ? trimmed : `${trimmed}+05:30`;
  const parsed = new Date(withZone);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export class DelhiveryShipping implements ShippingProvider {
  readonly name = 'delhivery';
  readonly mode = 'live' as const;
  readonly label = 'Delhivery';

  private readonly config: DelhiveryConfig;

  constructor(config: DelhiveryConfig) {
    this.config = config;
  }

  private get headers(): Record<string, string> {
    return { Authorization: `Token ${this.config.apiToken}` };
  }

  private async call<T>(init: {
    path: string;
    method?: 'GET' | 'POST';
    /** JSON body — used by the modern endpoints. */
    body?: unknown;
    /** Form body — used by /api/cmu/create and /api/p/edit. */
    form?: Record<string, string>;
    idempotencyKey?: string;
    timeoutMs?: number;
    expectStatuses?: number[];
  }): Promise<T> {
    const response = await gatewayFetch<T>({
      provider: 'delhivery',
      url: `${this.config.baseUrl}${init.path}`,
      method: init.method ?? 'GET',
      headers: init.form
        ? { ...this.headers, 'Content-Type': 'application/x-www-form-urlencoded' }
        : this.headers,
      body: init.form ? formEncode(init.form) : init.body,
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
    const query = new URLSearchParams({ filter_codes: input.toPincode }).toString();

    const data = await this.call<DlServiceability>({
      path: `/c/api/pin-codes/json/?${query}`,
      expectStatuses: [200, 404],
      timeoutMs: 10_000,
    });

    const pin = data.delivery_codes?.[0]?.postal_code;

    if (!pin) {
      return {
        serviceable: false,
        codAvailable: false,
        prepaidAvailable: false,
        expressAvailable: false,
        etaDays: null,
        couriers: [],
      };
    }

    // Delhivery's pincode API answers *whether* it delivers, not what it costs —
    // rate cards are contractual and not exposed over the API. Rates therefore
    // come from the shipping-zone table in Settings, and this driver reports the
    // capability flags only. Quoting an invented rate here would put a wrong
    // number on the customer's cart.
    const codAvailable =
      yes(pin.cod) && (!pin.max_amount || toRupees(input.declaredValue) <= pin.max_amount);
    // ODA = out of delivery area: reachable, but on an extended timeline.
    const oda = yes(pin.is_oda);

    return {
      serviceable: true,
      codAvailable,
      prepaidAvailable: yes(pin.pre_paid),
      expressAvailable: !oda,
      etaDays: oda ? 7 : 4,
      couriers: [
        {
          name: oda ? 'Delhivery Surface (ODA)' : 'Delhivery Surface',
          etaDays: oda ? 7 : 4,
          rate: 0,
          codCharge: 0,
        },
      ],
    };
  }

  async createShipment(input: ShipmentCreateInput): Promise<ShipmentResult> {
    const payload = {
      shipments: [
        {
          name: input.consignee.name,
          add: [input.consignee.line1, input.consignee.line2].filter(Boolean).join(', '),
          pin: input.consignee.pincode,
          city: input.consignee.city,
          state: input.consignee.state,
          country: input.consignee.country || 'India',
          phone: input.consignee.phone.replace(/\D/g, '').slice(-10),
          order: input.orderNumber,
          payment_mode: input.codAmount > 0 ? 'COD' : 'Prepaid',
          products_desc: input.items
            .map((i) => `${i.name} x${i.qty}`)
            .join(', ')
            .slice(0, 200),
          hsn_code: input.items[0]?.hsn ?? '',
          cod_amount: toRupees(input.codAmount),
          order_date: new Date().toISOString(),
          total_amount: toRupees(input.declaredValue),
          seller_name: this.config.clientName,
          seller_add: 'LUMEN AND CO, Mumbai',
          quantity: input.items.reduce((sum, i) => sum + i.qty, 0),
          // Grams — see the class docstring.
          weight: Math.max(50, Math.round(input.weightGrams)),
          shipment_length: input.dimensionsCm?.length ?? 30,
          shipment_width: input.dimensionsCm?.breadth ?? 25,
          shipment_height: input.dimensionsCm?.height ?? 8,
        },
      ],
      pickup_location: {
        name: input.pickupLocation ?? this.config.clientName,
        add: 'LUMEN AND CO Fulfilment Centre',
        city: 'Mumbai',
        pin_code: this.config.pickupPincode,
        country: 'India',
        phone: '9999999999',
      },
    };

    const data = await this.call<DlCreateResponse>({
      path: '/api/cmu/create',
      method: 'POST',
      // Form-encoded, with the JSON nested in a `data` field. This is not a
      // mistake; it is what the endpoint requires.
      form: { format: 'json', data: JSON.stringify(payload) },
      idempotencyKey: `shipment:${input.orderNumber}`,
      timeoutMs: 30_000,
      expectStatuses: [200, 400],
    });

    const pkg = data.packages?.[0];
    const remarks = pkg?.remarks?.filter(Boolean).join('; ');

    if (!pkg?.waybill) {
      throw new GatewayError({
        code: 'SHIPMENT_CREATE_FAILED',
        message: `delhivery: ${remarks || data.rmk || (Array.isArray(data.error) ? data.error.join('; ') : data.error) || 'no waybill returned'}`,
        provider: 'delhivery',
        retryable: false,
        raw: data,
        userMessage: 'We could not book a courier for this order. Our team has been notified.',
      });
    }

    // Delhivery can return a waybill and still mark the package unserviceable.
    if (pkg.serviceable === false) {
      throw new GatewayError({
        code: 'not_serviceable',
        message: `delhivery: ${remarks || 'destination is not serviceable'}`,
        provider: 'delhivery',
        retryable: false,
        raw: data,
        userMessage: 'We are unable to deliver to this pincode right now.',
      });
    }

    return {
      // The waybill is the only handle Delhivery gives us.
      providerShipmentId: pkg.waybill,
      awb: pkg.waybill,
      courierName: 'Delhivery',
      labelUrl: null,
      manifestUrl: null,
      trackingUrl: `https://www.delhivery.com/track/package/${pkg.waybill}`,
      status: 'manifested',
      estimatedDeliveryDays: null,
      charges: 0,
      raw: data,
    };
  }

  async generateLabel(providerShipmentId: string): Promise<{ labelUrl: string }> {
    const { url } = await this.packingSlip([providerShipmentId]);
    return { labelUrl: url };
  }

  async generateManifest(providerShipmentIds: string[]): Promise<{ manifestUrl: string }> {
    if (providerShipmentIds.length === 0) {
      throw new GatewayError({
        code: 'BAD_REQUEST_ERROR',
        message: 'delhivery: no waybills to manifest',
        provider: 'delhivery',
        retryable: false,
      });
    }
    // Delhivery has no separate manifest document — a multi-waybill packing slip
    // is what the pickup rider signs against.
    const { url } = await this.packingSlip(providerShipmentIds);
    return { manifestUrl: url };
  }

  private async packingSlip(waybills: string[]): Promise<{ url: string }> {
    const query = new URLSearchParams({ wbns: waybills.join(','), pdf: 'true' }).toString();

    const data = await this.call<{
      packages?: { pdf_download_link?: string; wbn?: string }[];
      packages_found?: number;
      error?: string;
    }>({
      path: `/api/p/packing_slip?${query}`,
      expectStatuses: [200, 404],
      timeoutMs: 25_000,
    });

    const link = data.packages?.find((p) => p.pdf_download_link)?.pdf_download_link;
    if (!link) {
      throw new GatewayError({
        code: 'LABEL_FAILED',
        message: `delhivery: ${data.error ?? 'packing slip not available yet'}`,
        provider: 'delhivery',
        // A slip is unavailable for a few seconds after manifesting, so this is
        // worth retrying rather than surfacing as a hard failure.
        retryable: true,
        raw: data,
      });
    }
    return { url: link };
  }

  async schedulePickup(providerShipmentId: string): Promise<{ scheduledAt: Date }> {
    // Delhivery pickups are requested per *location and slot*, not per shipment —
    // one request covers everything manifested for that day. The waybill is not
    // part of the payload, which is why it is unused here.
    void providerShipmentId;

    const now = new Date();
    // After 15:00 IST the same-day slot is closed, so roll to tomorrow.
    const target = new Date(now);
    if (now.getHours() >= 15) target.setDate(target.getDate() + 1);

    const pickupDate = target.toISOString().slice(0, 10);

    const data = await this.call<{
      pickup_id?: number;
      pickup_date?: string;
      pickup_time?: string;
      error?: string;
      prepaid?: string;
    }>({
      path: '/fm/request/new/',
      method: 'POST',
      body: {
        pickup_location: this.config.clientName,
        pickup_date: pickupDate,
        pickup_time: '11:00:00',
        expected_package_count: 1,
      },
      idempotencyKey: `pickup:${this.config.clientName}:${pickupDate}`,
      expectStatuses: [200, 201, 400],
    });

    if (data.error && !/already/i.test(data.error)) {
      throw new GatewayError({
        code: 'PICKUP_FAILED',
        message: `delhivery: ${data.error}`,
        provider: 'delhivery',
        retryable: true,
        raw: data,
      });
    }

    return {
      scheduledAt: parseIstDate(
        `${data.pickup_date ?? pickupDate}T${data.pickup_time ?? '11:00:00'}`,
      ),
    };
  }

  async track(awb: string): Promise<{ status: string; events: TrackingEvent[] }> {
    const query = new URLSearchParams({ waybill: awb }).toString();

    const data = await this.call<DlTracking>({
      path: `/api/v1/packages/json/?${query}`,
      expectStatuses: [200, 404],
      timeoutMs: 12_000,
    });

    const shipment = data.ShipmentData?.[0]?.Shipment;
    if (!shipment) {
      throw new GatewayError({
        code: 'not_found',
        message: `delhivery: ${data.Error ?? `no tracking data for ${awb}`}`,
        provider: 'delhivery',
        retryable: false,
        userMessage: 'Tracking information is not available for this shipment yet.',
      });
    }

    const events: TrackingEvent[] = (shipment.Scans ?? [])
      .map((s) => s.ScanDetail)
      .filter((d): d is NonNullable<DlScan['ScanDetail']> => Boolean(d))
      .map((d) => ({
        status: normalizeStatus(d.Scan, d.StatusCode),
        message: d.Instructions || d.Scan || 'Update',
        location: d.ScannedLocation ?? null,
        occurredAt: parseIstDate(d.ScanDateTime ?? d.StatusDateTime),
      }))
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    const status = shipment.Status?.Status
      ? normalizeStatus(shipment.Status.Status, shipment.Status.StatusType)
      : (events[events.length - 1]?.status ?? 'manifested');

    return { status, events };
  }

  async cancelShipment(providerShipmentId: string): Promise<{ cancelled: boolean }> {
    const data = await this.call<{ status?: string | boolean; remark?: string; error?: string }>({
      path: '/api/p/edit',
      method: 'POST',
      body: { waybill: providerShipmentId, cancellation: 'true' },
      idempotencyKey: `cancel:${providerShipmentId}`,
      expectStatuses: [200, 400],
    });

    const already = /already|cancelled/i.test(`${data.remark ?? ''} ${data.error ?? ''}`);
    const ok = data.status === true || data.status === 'Success' || already;

    if (!ok) {
      throw new GatewayError({
        code: 'CANCEL_FAILED',
        message: `delhivery: ${data.remark ?? data.error ?? 'shipment could not be cancelled'}`,
        provider: 'delhivery',
        retryable: false,
        raw: data,
      });
    }
    return { cancelled: true };
  }

  async createReturnPickup(
    input: ShipmentCreateInput & { originalAwb?: string },
  ): Promise<ShipmentResult> {
    // Reverse logistics: `payment_mode: "Pickup"` tells Delhivery the consignee
    // address is where the parcel is collected *from*, and the return address is
    // where it goes. A return never carries a COD amount.
    const payload = {
      shipments: [
        {
          name: input.consignee.name,
          add: [input.consignee.line1, input.consignee.line2].filter(Boolean).join(', '),
          pin: input.consignee.pincode,
          city: input.consignee.city,
          state: input.consignee.state,
          country: input.consignee.country || 'India',
          phone: input.consignee.phone.replace(/\D/g, '').slice(-10),
          order: `RET-${input.orderNumber}`,
          payment_mode: 'Pickup',
          products_desc: input.items
            .map((i) => `${i.name} x${i.qty}`)
            .join(', ')
            .slice(0, 200),
          cod_amount: 0,
          order_date: new Date().toISOString(),
          total_amount: toRupees(input.declaredValue),
          quantity: input.items.reduce((sum, i) => sum + i.qty, 0),
          weight: Math.max(50, Math.round(input.weightGrams)),
          return_name: this.config.clientName,
          return_add: 'LUMEN AND CO Returns Desk',
          return_city: 'Mumbai',
          return_state: 'Maharashtra',
          return_country: 'India',
          return_pin: this.config.pickupPincode,
          return_phone: '9999999999',
        },
      ],
      pickup_location: {
        name: this.config.clientName,
        add: 'LUMEN AND CO Fulfilment Centre',
        city: 'Mumbai',
        pin_code: this.config.pickupPincode,
        country: 'India',
        phone: '9999999999',
      },
    };

    const data = await this.call<DlCreateResponse>({
      path: '/api/cmu/create',
      method: 'POST',
      form: { format: 'json', data: JSON.stringify(payload) },
      idempotencyKey: `return:${input.orderNumber}`,
      timeoutMs: 30_000,
      expectStatuses: [200, 400],
    });

    const pkg = data.packages?.[0];
    if (!pkg?.waybill) {
      throw new GatewayError({
        code: 'RETURN_CREATE_FAILED',
        message: `delhivery: ${pkg?.remarks?.join('; ') || data.rmk || 'return pickup was not created'}`,
        provider: 'delhivery',
        retryable: false,
        raw: data,
      });
    }

    return {
      providerShipmentId: pkg.waybill,
      awb: pkg.waybill,
      courierName: 'Delhivery',
      labelUrl: null,
      manifestUrl: null,
      trackingUrl: `https://www.delhivery.com/track/package/${pkg.waybill}`,
      status: 'return_pickup_scheduled',
      estimatedDeliveryDays: null,
      charges: 0,
      raw: { ...data, direction: 'reverse', originalAwb: input.originalAwb ?? null },
    };
  }
}
