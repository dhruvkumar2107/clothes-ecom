import crypto from 'node:crypto';
import type { Paise } from '../../money';
import {
  GatewayError,
  type ServiceabilityResult,
  type ShipmentCreateInput,
  type ShipmentResult,
  type ShippingProvider,
  type TrackingEvent,
} from '../types';

/**
 * Mock shipping provider (Shiprocket / Delhivery shaped).
 *
 * Two things make this useful rather than decorative:
 *
 *   • **Serviceability is computed, not always-true.** Rates come from real
 *     weight slabs and postal-zone distance, COD is genuinely unavailable to the
 *     island circles and to a documented "no-COD" prefix set, and a malformed
 *     pincode is rejected. So the checkout serviceability check, the COD toggle
 *     and the shipping-fee line all have something real to react to.
 *   • **Tracking is stateless and survives a restart.** The AWB itself encodes
 *     the dispatch timestamp and the shipment's flags, so `track()` can
 *     reconstruct a plausible event timeline from the number alone — no in-memory
 *     map to lose. That means an order placed before a dev-server restart still
 *     has a working tracking page, which is exactly where a naive mock breaks.
 *
 * The timeline is compressed to minutes rather than days so the full
 * pickup → in-transit → out-for-delivery → delivered sequence is observable in
 * one sitting. `SPEED_FACTOR` is the single knob if you want real durations.
 */

/** 1 = compressed dev timeline (minutes). 1440 ≈ real-world days. */
const SPEED_FACTOR = 1;
const MINUTE = 60_000;

/** Seconds since 2020-01-01, so an AWB stays 12 digits into the 2050s. */
const AWB_EPOCH = Date.UTC(2020, 0, 1) / 1000;

const COURIERS = [
  { code: '11', name: 'Bluedart Express', speed: 1.0, premium: 1.35 },
  { code: '22', name: 'Delhivery Surface', speed: 1.4, premium: 1.0 },
  { code: '33', name: 'Ecom Express', speed: 1.3, premium: 1.05 },
  { code: '44', name: 'XpressBees', speed: 1.5, premium: 0.95 },
] as const;

/**
 * Island and remote circles: reachable, but slower and prepaid-only. These are
 * genuine COD exclusions for most Indian couriers, not invented ones.
 */
const NO_COD_PREFIXES = ['744', '682', '796', '797', '798', '799'];
const REMOTE_PREFIXES = ['744', '682', '796', '797', '798', '799', '190', '191', '192', '193', '194'];

function isValidPincode(pincode: string): boolean {
  return /^[1-9]\d{5}$/.test(pincode);
}

function startsWithAny(pincode: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pincode.startsWith(p));
}

/**
 * Postal-zone distance. India's first pincode digit maps to a postal circle
 * group, so the absolute difference is a decent stand-in for freight distance —
 * which is exactly how courier rate cards are built (local / zonal / national).
 */
function zoneDistance(from: string, to: string): number {
  if (from.slice(0, 3) === to.slice(0, 3)) return 0; // same city
  if (from[0] === to[0]) return 1; // same circle
  return 2 + Math.min(2, Math.abs(Number(from[0]) - Number(to[0])) - 1);
}

/** Courier rate cards are billed in 500g slabs, always rounded up. */
function billableSlabs(weightGrams: number): number {
  return Math.max(1, Math.ceil(Math.max(weightGrams, 1) / 500));
}

function freightFor(courierPremium: number, slabs: number, zone: number): Paise {
  const base = 4900 + zone * 1500; // ₹49 local, up to ₹109 national
  const perExtraSlab = 2500 + zone * 700;
  const raw = base + (slabs - 1) * perExtraSlab;
  return Math.round(raw * courierPremium);
}

/** Couriers charge the higher of a flat COD fee or a percentage of the value. */
function codChargeFor(declaredValue: Paise): Paise {
  return Math.max(3900, Math.round(declaredValue * 0.0175));
}

// ── AWB encoding ────────────────────────────────────────────────────────────

interface AwbFacts {
  courier: (typeof COURIERS)[number];
  dispatchedAt: number;
  cod: boolean;
  remote: boolean;
}

function luhnCheck2(digits: string): string {
  // Not a real Luhn — a stable 2-digit checksum, so a mistyped AWB is rejected
  // instead of silently rendering someone else's timeline.
  let sum = 0;
  for (let i = 0; i < digits.length; i++) sum += digits.charCodeAt(i) * (i + 3);
  return String(sum % 97).padStart(2, '0');
}

function encodeAwb(facts: { courierCode: string; at: number; cod: boolean; remote: boolean }): string {
  const ts = String(Math.max(0, Math.floor(facts.at / 1000 - AWB_EPOCH))).padStart(9, '0');
  const flags = String((facts.cod ? 1 : 0) + (facts.remote ? 2 : 0));
  const body = `${facts.courierCode}${ts}${flags}`;
  return `${body}${luhnCheck2(body)}`;
}

function decodeAwb(awb: string): AwbFacts | null {
  if (!/^\d{14}$/.test(awb)) return null;
  const body = awb.slice(0, 12);
  if (luhnCheck2(body) !== awb.slice(12)) return null;

  const courier = COURIERS.find((c) => c.code === body.slice(0, 2));
  if (!courier) return null;

  const seconds = Number(body.slice(2, 11));
  const flags = Number(body[11]);

  return {
    courier,
    dispatchedAt: (seconds + AWB_EPOCH) * 1000,
    cod: (flags & 1) === 1,
    remote: (flags & 2) === 2,
  };
}

// ── shipment id encoding ────────────────────────────────────────────────────

interface ShipmentPayload {
  awb: string;
  courier: string;
  orderNumber: string;
  pincode: string;
  cod: number;
  weight: number;
  createdAt: number;
}

const SHIPMENT_PREFIX = 'shp_mock_';

function encodeShipment(payload: ShipmentPayload): string {
  return `${SHIPMENT_PREFIX}${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}`;
}

function decodeShipment(id: string): ShipmentPayload | null {
  if (!id.startsWith(SHIPMENT_PREFIX)) return null;
  try {
    return JSON.parse(
      Buffer.from(id.slice(SHIPMENT_PREFIX.length), 'base64url').toString('utf8'),
    ) as ShipmentPayload;
  } catch {
    return null;
  }
}

// ── tracking timeline ───────────────────────────────────────────────────────

interface Stage {
  status: string;
  message: string;
  atMinutes: number;
  /**
   * Facility names only. The AWB deliberately does not encode the destination
   * pincode — a tracking number should not leak a customer's address to anyone
   * who guesses it.
   */
  location: string;
}

const STAGES: Stage[] = [
  {
    status: 'pickup_scheduled',
    message: 'Pickup scheduled with the courier',
    atMinutes: 0,
    location: 'Mumbai Fulfilment Centre',
  },
  {
    status: 'picked_up',
    message: 'Shipment picked up',
    atMinutes: 0.5,
    location: 'Mumbai Fulfilment Centre',
  },
  {
    status: 'in_transit',
    message: 'Shipment departed the origin facility',
    atMinutes: 1.5,
    location: 'Bhiwandi Hub',
  },
  {
    status: 'in_transit',
    message: 'Shipment arrived at the destination facility',
    atMinutes: 3,
    location: 'Destination Sorting Centre',
  },
  {
    status: 'out_for_delivery',
    message: 'Out for delivery',
    atMinutes: 4.5,
    location: 'Local Delivery Hub',
  },
  {
    status: 'delivered',
    message: 'Delivered',
    atMinutes: 6,
    location: 'Local Delivery Hub',
  },
];

export class MockShipping implements ShippingProvider {
  readonly name = 'mock';
  readonly mode = 'mock' as const;
  readonly label = 'Mock courier aggregator';

  async checkServiceability(input: {
    fromPincode: string;
    toPincode: string;
    weightGrams: number;
    cod: boolean;
    declaredValue: Paise;
  }): Promise<ServiceabilityResult> {
    const empty: ServiceabilityResult = {
      serviceable: false,
      codAvailable: false,
      prepaidAvailable: false,
      expressAvailable: false,
      etaDays: null,
      couriers: [],
    };

    if (!isValidPincode(input.toPincode)) return empty;

    const remote = startsWithAny(input.toPincode, REMOTE_PREFIXES);
    const codAvailable = !startsWithAny(input.toPincode, NO_COD_PREFIXES);
    const zone = zoneDistance(input.fromPincode, input.toPincode);
    const slabs = billableSlabs(input.weightGrams);

    const couriers = COURIERS
      .map((c) => {
        const etaDays = Math.max(1, Math.round((1 + zone) * c.speed * (remote ? 2.5 : 1)));
        return {
          name: c.name,
          etaDays,
          rate: freightFor(c.premium, slabs, zone) + (remote ? 5000 : 0),
          codCharge: codAvailable ? codChargeFor(input.declaredValue) : 0,
        };
      })
      .sort((a, b) => a.etaDays - b.etaDays || a.rate - b.rate);

    return {
      serviceable: true,
      codAvailable: codAvailable && input.declaredValue <= 2_500_000,
      prepaidAvailable: true,
      expressAvailable: !remote && zone <= 1,
      etaDays: couriers[0]?.etaDays ?? null,
      couriers,
    };
  }

  async createShipment(input: ShipmentCreateInput): Promise<ShipmentResult> {
    const pincode = input.consignee.pincode;
    if (!isValidPincode(pincode)) {
      throw new GatewayError({
        code: 'BAD_REQUEST_ERROR',
        message: `mock: ${pincode} is not a valid Indian pincode`,
        provider: 'mock',
        retryable: false,
        userMessage: 'That pincode does not look valid. Please check the delivery address.',
      });
    }
    if (input.codAmount > 0 && startsWithAny(pincode, NO_COD_PREFIXES)) {
      throw new GatewayError({
        code: 'cod_not_serviceable',
        message: `mock: COD is not available for ${pincode}`,
        provider: 'mock',
        retryable: false,
        userMessage: 'Cash on delivery is not available at this pincode.',
      });
    }

    const remote = startsWithAny(pincode, REMOTE_PREFIXES);
    // Deterministic courier allocation — the same order always gets the same
    // carrier, so re-reading an order does not shuffle its tracking page.
    const pick =
      crypto.createHash('sha256').update(input.orderNumber).digest()[0] % COURIERS.length;
    const courier = COURIERS[pick];

    const createdAt = Date.now();
    const awb = encodeAwb({
      courierCode: courier.code,
      at: createdAt,
      cod: input.codAmount > 0,
      remote,
    });

    const providerShipmentId = encodeShipment({
      awb,
      courier: courier.name,
      orderNumber: input.orderNumber,
      pincode,
      cod: input.codAmount,
      weight: input.weightGrams,
      createdAt,
    });

    const zone = zoneDistance(input.pickupLocation ?? '400013', pincode);

    return {
      providerShipmentId,
      awb,
      courierName: courier.name,
      // Labels and manifests are generated by our own PDF routes, so the app has
      // zero external asset dependencies.
      labelUrl: `/api/shipping/label/${encodeURIComponent(providerShipmentId)}`,
      manifestUrl: null,
      trackingUrl: `/track/${awb}`,
      status: 'pickup_scheduled',
      estimatedDeliveryDays: Math.max(1, Math.round((1 + zone) * courier.speed * (remote ? 2.5 : 1))),
      charges: freightFor(courier.premium, billableSlabs(input.weightGrams), zone),
      raw: { driver: 'mock', courier: courier.name, zone, remote },
    };
  }

  async generateLabel(providerShipmentId: string): Promise<{ labelUrl: string }> {
    if (!decodeShipment(providerShipmentId)) {
      throw new GatewayError({
        code: 'not_found',
        message: `mock: unknown shipment ${providerShipmentId}`,
        provider: 'mock',
        retryable: false,
      });
    }
    return { labelUrl: `/api/shipping/label/${encodeURIComponent(providerShipmentId)}` };
  }

  async generateManifest(providerShipmentIds: string[]): Promise<{ manifestUrl: string }> {
    const ids = providerShipmentIds.filter((id) => decodeShipment(id));
    if (ids.length === 0) {
      throw new GatewayError({
        code: 'BAD_REQUEST_ERROR',
        message: 'mock: no valid shipments to manifest',
        provider: 'mock',
        retryable: false,
      });
    }
    // A manifest is one document covering many shipments — the route reads the
    // id list off the query string.
    const query = new URLSearchParams({ ids: ids.join(',') }).toString();
    return { manifestUrl: `/api/shipping/manifest?${query}` };
  }

  async schedulePickup(providerShipmentId: string): Promise<{ scheduledAt: Date }> {
    const shipment = decodeShipment(providerShipmentId);
    if (!shipment) {
      throw new GatewayError({
        code: 'not_found',
        message: `mock: unknown shipment ${providerShipmentId}`,
        provider: 'mock',
        retryable: false,
      });
    }
    // Couriers cut off same-day pickup in the afternoon; after that it rolls to
    // the next working day. Worth modelling — the packing queue shows this date.
    const now = new Date();
    const next = new Date(now);
    if (now.getHours() >= 15) next.setDate(next.getDate() + 1);
    next.setHours(11, 0, 0, 0);
    return { scheduledAt: next };
  }

  async track(awb: string): Promise<{ status: string; events: TrackingEvent[] }> {
    const facts = decodeAwb(awb);
    if (!facts) {
      throw new GatewayError({
        code: 'not_found',
        message: `mock: ${awb} is not a recognised AWB`,
        provider: 'mock',
        retryable: false,
        userMessage: 'We could not find a shipment with that tracking number.',
      });
    }

    const elapsedMinutes = (Date.now() - facts.dispatchedAt) / MINUTE;
    // Remote destinations take longer, and COD adds a delivery attempt step.
    const pace = SPEED_FACTOR * (facts.remote ? 2.5 : 1);

    const events: TrackingEvent[] = [];
    for (const stage of STAGES) {
      const dueAt = stage.atMinutes * pace;
      if (elapsedMinutes < dueAt) break;
      events.push({
        status: stage.status,
        message: stage.message,
        location: stage.location,
        occurredAt: new Date(facts.dispatchedAt + dueAt * MINUTE),
      });
    }

    if (events.length === 0) {
      events.push({
        status: 'manifested',
        message: 'Shipment details received by the courier',
        location: 'Mumbai Fulfilment Centre',
        occurredAt: new Date(facts.dispatchedAt),
      });
    }

    return { status: events[events.length - 1].status, events };
  }

  async cancelShipment(providerShipmentId: string): Promise<{ cancelled: boolean }> {
    const shipment = decodeShipment(providerShipmentId);
    if (!shipment) {
      throw new GatewayError({
        code: 'not_found',
        message: `mock: unknown shipment ${providerShipmentId}`,
        provider: 'mock',
        retryable: false,
      });
    }
    // Real couriers refuse cancellation once a shipment is out for delivery.
    const elapsedMinutes = (Date.now() - shipment.createdAt) / MINUTE;
    if (elapsedMinutes > STAGES[4].atMinutes * SPEED_FACTOR) {
      throw new GatewayError({
        code: 'cancellation_window_closed',
        message: 'mock: shipment is already out for delivery',
        provider: 'mock',
        retryable: false,
        userMessage: 'This shipment is already out for delivery and can no longer be cancelled.',
      });
    }
    return { cancelled: true };
  }

  async createReturnPickup(
    input: ShipmentCreateInput & { originalAwb?: string },
  ): Promise<ShipmentResult> {
    // A reverse pickup is a shipment in the opposite direction: the customer's
    // address becomes the origin. It is always prepaid — nobody collects cash on
    // a return.
    const forward = await this.createShipment({ ...input, codAmount: 0 });
    return {
      ...forward,
      status: 'return_pickup_scheduled',
      raw: {
        ...(forward.raw as Record<string, unknown>),
        direction: 'reverse',
        originalAwb: input.originalAwb ?? null,
      },
    };
  }
}
