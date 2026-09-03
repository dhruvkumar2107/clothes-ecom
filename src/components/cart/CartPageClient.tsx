'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SmartImage } from '@/components/ui/SmartImage';
import { useRouter } from 'next/navigation';
import { Plus, Minus, Trash2, Heart, ChevronRight, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatCurrency } from '@/lib/utils';
import { apiGet, apiPatch, apiDelete } from '@/lib/api-client';
import { useCartStore, useToast } from '@/app/providers';
import type { CartView } from '@/lib/cart';
import type { PricedLine, CartTotals } from '@/lib/pricing';

interface CartItem extends PricedLine {
  // Add client-specific fields if needed
  id: string; // alias for cartItemId
}

interface CartPageClientProps {
  initialCart: CartView;
}

export function CartPageClient({ initialCart }: CartPageClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { setCount } = useCartStore();
  const [cart, setCart] = useState<CartView>(initialCart);
  const [updating, setUpdating] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  useEffect(() => {
    setCount(cart.totals.itemCount);
  }, [cart.totals.itemCount, setCount]);

  const updateQty = async (itemId: string, qty: number) => {
    setUpdating(itemId);
    try {
      if (qty === 0) {
        await apiDelete('/api/cart', { itemId });
      } else {
        await apiPatch('/api/cart', { itemId, qty });
      }
      await refreshCart();
    } catch (error: any) {
      toast({ title: 'Error', message: error.message || 'Failed to update quantity', tone: 'danger' });
    } finally {
      setUpdating(null);
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      await apiDelete('/api/cart', { itemId });
      await refreshCart();
      toast({ title: 'Removed', message: 'Item removed from bag', tone: 'success' });
    } catch {
      toast({ title: 'Error', message: 'Failed to remove item', tone: 'danger' });
    }
  };

  const saveForLater = async (itemId: string) => {
    try {
      await apiDelete('/api/cart', { itemId, action: 'saveForLater' }, { body: JSON.stringify({ itemId, saved: true }) });
      await refreshCart();
      toast({ title: 'Saved', message: 'Item saved for later', tone: 'success' });
    } catch {
      toast({ title: 'Error', message: 'Failed to save item', tone: 'danger' });
    }
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setApplyingCoupon(true);
    try {
      await apiDelete('/api/cart', { action: 'coupon' }, { body: JSON.stringify({ code: couponCode.trim().toUpperCase() }) });
      await refreshCart();
      toast({ title: 'Coupon applied', message: 'Your coupon has been applied', tone: 'success' });
    } catch (error: any) {
      toast({ title: 'Invalid coupon', message: error.message || 'This coupon is not valid', tone: 'danger' });
    } finally {
      setApplyingCoupon(false);
    }
  };

  const removeCoupon = async () => {
    try {
      await apiDelete('/api/cart', { action: 'coupon' }, { body: JSON.stringify({ code: null }) });
      setCouponCode('');
      await refreshCart();
      toast({ title: 'Coupon removed', message: 'Your coupon has been removed', tone: 'success' });
    } catch {
      toast({ title: 'Error', message: 'Failed to remove coupon', tone: 'danger' });
    }
  };

  const refreshCart = async () => {
    try {
      const data = await apiGet<CartView>('/api/cart');
      setCart(data);
    } catch {
      setCart({ 
        lines: [], 
        totals: { subtotal: 0, discountTotal: 0, couponDiscount: 0, shippingDiscount: 0, loyaltyDiscount: 0, shippingTotal: 0, codFee: 0, taxTotal: 0, roundOff: 0, grandTotal: 0, walletApplied: 0, amountDue: 0, totalSavings: 0, itemCount: 0, unitCount: 0 }, 
        cartId: null, 
        savedForLater: [], 
        notices: [], 
        issues: [],
        note: null,
        coupon: null,
        couponAutoApplied: false,
        tax: { context: { placeOfSupply: '', sellerStateCode: '', pricesIncludeTax: true }, intraState: true, lines: [], cgst: 0, sgst: 0, igst: 0, byRate: [] },
        shipping: { rate: 0, baseRate: 0, freeShipping: false, threshold: 0, amountToFreeShipping: 0, zoneName: null, etaMinDays: 0, etaMaxDays: 0, etaLabel: '—', weightGrams: 0 },
        cod: { available: false, fee: 0, reason: null, selected: false },
        wallet: { balance: 0, applicable: 0, applied: 0, maxPercent: 0 },
        loyalty: { pointsBalance: 0, pointsRedeemed: 0, valueRedeemed: 0, pointsEarned: 0 }
      });
    }
  };

  const proceedToCheckout = () => {
    if (cart.issues.length > 0) {
      toast({ title: 'Cannot proceed', message: 'Please resolve the issues in your bag first', tone: 'warning' });
      return;
    }
    router.push('/checkout');
  };

  if (cart.lines.length === 0 && cart.savedForLater.length === 0) {
    return (
      <div className="py-16 md:py-24">
        <div className="u-container">
          <div className="max-w-md mx-auto text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-ink/10 flex items-center justify-center">
              <svg className="w-10 h-10 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <h1 className="u-display text-3xl mb-3">Your bag is empty</h1>
            <p className="text-muted mb-8">Looks like you haven't added anything yet.</p>
            <Link href="/products">
              <Button size="lg" className="w-full sm:w-auto gap-2">
                Start Shopping
                <ChevronRight className="w-5 h-5" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 md:py-12">
      <div className="u-container">
        <h1 className="u-display text-3xl md:text-4xl mb-8">Shopping Bag</h1>

        {cart.notices.length > 0 && (
          <div className="mb-6 space-y-2" role="status" aria-live="polite">
            {cart.notices.map((notice, i) => (
              <div key={i} className="p-3 bg-warning/10 border border-warning/20 rounded-md text-sm text-warning flex items-center gap-2">
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                {notice.message}
              </div>
            ))}
          </div>
        )}

        {cart.issues.length > 0 && (
          <div className="mb-6 space-y-2" role="alert" aria-live="assertive">
            {cart.issues.map((issue, i) => (
              <div key={i} className="p-3 bg-danger/10 border border-danger/20 rounded-md text-sm text-danger flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {issue.message}
              </div>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cart.lines.map((item) => (
              <article key={item.cartItemId} className="flex gap-4 p-4 bg-paper rounded-lg border border-line">
                <Link href={`/products/${item.productSlug}`} className="relative w-24 h-32 flex-shrink-0 rounded-md overflow-hidden bg-paper-2">
                  {item.imageUrl ? (
                    <SmartImage src={item.imageUrl} alt="" fill className="object-cover" sizes="96px" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </Link>

                <div className="flex-1 min-w-0">
                  <Link href={`/products/${item.productSlug}`} className="font-medium text-ink hover:text-accent transition-colors line-clamp-2 block mb-1">
                    {item.productName}
                  </Link>
                  <div className="flex items-center gap-3 text-sm text-muted mb-2 flex-wrap">
                    <span>Size: {item.size}</span>
                    <span>•</span>
                    <span style={{ color: item.color }}>●</span>
                    <span>{item.color}</span>
                  </div>

                  {item.priceChanged && item.priceWas !== null && (
                    <p className="text-xs text-danger mb-2">
                      Price updated: was {formatCurrency(item.priceWas)}
                    </p>
                  )}

                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center border border-line rounded-md overflow-hidden">
                      <button
                        onClick={() => updateQty(item.key, item.qty - 1)}
                        disabled={updating === item.key || item.qty <= 1}
                        className="w-10 h-10 flex items-center justify-center hover:bg-ink-2 transition-colors disabled:opacity-50 u-focus"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-4 h-4 text-ink" aria-hidden="true" />
                      </button>
                      <span className="w-12 text-center font-medium">{item.qty}</span>
                      <button
                        onClick={() => updateQty(item.key, item.qty + 1)}
                        disabled={updating === item.key || item.qty >= item.available || item.qty >= 10}
                        className="w-10 h-10 flex items-center justify-center hover:bg-ink-2 transition-colors disabled:opacity-50 u-focus"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-4 h-4 text-ink" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={() => saveForLater(item.key)}
                        className="text-sm text-muted hover:text-ink transition-colors flex items-center gap-1 u-focus"
                      >
                        <Heart className="w-4 h-4" aria-hidden="true" />
                        Save
                      </button>
                      <button
                        onClick={() => removeItem(item.key)}
                        className="text-sm text-muted hover:text-danger transition-colors flex items-center gap-1 u-focus"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end min-w-[120px]">
                  <span className="font-semibold text-ink">{formatCurrency(item.lineTotal)}</span>
                  {item.discount > 0 && (
                    <span className="text-sm text-positive line-through">{formatCurrency(item.unitPrice * item.qty)}</span>
                  )}
                </div>
              </article>
            ))}

            {/* Coupon */}
            <div className="p-4 bg-paper rounded-lg border border-line">
              <h3 className="u-label mb-3">Promo Code</h3>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter promo code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="flex-1 text-uppercase"
                  disabled={applyingCoupon}
                />
                <Button onClick={applyCoupon} disabled={applyingCoupon || !couponCode.trim()}>
                  {applyingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                </Button>
              </div>
              {cart.totals.couponDiscount > 0 && (
                <p className="text-sm text-positive mt-2">Coupon applied: −{formatCurrency(cart.totals.couponDiscount)}</p>
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              <div className="bg-paper rounded-lg border border-line p-6">
                <h2 className="u-display text-xl mb-6">Order Summary</h2>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Subtotal ({cart.totals.unitCount} items)</span>
                    <span className="font-medium">{formatCurrency(cart.totals.subtotal)}</span>
                  </div>

                  {cart.totals.couponDiscount > 0 && (
                    <div className="flex justify-between text-sm text-positive">
                      <span>Discount</span>
                      <span>−{formatCurrency(cart.totals.couponDiscount)}</span>
                    </div>
                  )}

                  {cart.totals.loyaltyDiscount > 0 && (
                    <div className="flex justify-between text-sm text-positive">
                      <span>Points redeemed</span>
                      <span>−{formatCurrency(cart.totals.loyaltyDiscount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span>Shipping</span>
                    <span className={cart.totals.shippingTotal === 0 ? 'text-positive' : ''}>
                      {cart.totals.shippingTotal === 0 ? 'Free' : formatCurrency(cart.totals.shippingTotal)}
                    </span>
                  </div>

                  {cart.totals.codFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>COD handling</span>
                      <span>{formatCurrency(cart.totals.codFee)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm text-muted border-t border-line pt-2">
                    <span>Tax (incl.)</span>
                    <span>{formatCurrency(cart.totals.taxTotal)}</span>
                  </div>

                  {cart.totals.roundOff !== 0 && (
                    <div className="flex justify-between text-sm text-muted">
                      <span>Round off</span>
                      <span>{cart.totals.roundOff > 0 ? '+' : ''}{formatCurrency(cart.totals.roundOff)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-lg font-semibold border-t border-line pt-3">
                    <span>Total</span>
                    <span>{formatCurrency(cart.totals.grandTotal)}</span>
                  </div>

                  {cart.totals.walletApplied > 0 && (
                    <div className="flex justify-between text-sm text-positive border-t border-line pt-3">
                      <span>Wallet applied</span>
                      <span>−{formatCurrency(cart.totals.walletApplied)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-xl font-bold text-accent border-t border-line pt-3">
                    <span>To Pay</span>
                    <span>{formatCurrency(cart.totals.amountDue)}</span>
                  </div>
                </div>

                {cart.totals.totalSavings > 0 && (
                  <p className="text-sm text-positive text-center mt-4">
                    You saved {formatCurrency(cart.totals.totalSavings)} today!
                  </p>
                )}

                <Button onClick={proceedToCheckout} className="w-full justify-center gap-2 mt-4" disabled={cart.issues.length > 0}>
                  Proceed to Checkout
                  <ChevronRight className="w-5 h-5" aria-hidden="true" />
                </Button>

                <p className="text-xs text-muted text-center mt-3">
                  Secure checkout • Free shipping on orders above ₹2,999 • Easy returns
                </p>
              </div>

              {/* Saved for later */}
              {cart.savedForLater.length > 0 && (
                <div className="bg-paper rounded-lg border border-line p-4">
                  <h3 className="u-label mb-3">Saved for Later ({cart.savedForLater.length})</h3>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {cart.savedForLater.map((item) => (
                      <div key={item.itemId} className="flex gap-3">
                        <div className="w-16 h-20 flex-shrink-0 rounded overflow-hidden bg-paper-2">
                          {item.imageUrl ? (
                            <SmartImage src={item.imageUrl} alt="" fill className="object-cover" sizes="64px" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-ink truncate">{item.productName}</p>
                          <p className="text-xs text-muted">{item.size} • {item.color}</p>
                          <p className="text-sm text-ink font-medium">{formatCurrency(item.unitPrice)}</p>
                        </div>
                        <button
                          onClick={() => {}}
                          className="text-xs text-accent hover:underline flex-shrink-0"
                        >
                          Move to Bag
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}