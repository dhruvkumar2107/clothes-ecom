'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { SmartImage } from '@/components/ui/SmartImage';
import { useCartStore, useToast } from '@/app/providers';
import { Button } from '@/components/ui/Button';
import { X, Plus, Minus, Trash2, Heart, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { apiGet, apiPatch, apiDelete } from '@/lib/api-client';
import type { CartView } from '@/lib/cart';

export function CartDrawer() {
  const { drawerOpen, closeDrawer, setCount } = useCartStore();
  const { toast } = useToast();
  const [cart, setCart] = useState<CartView | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadCart = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<CartView>('/api/cart');
      setCart(data);
      setCount(data?.totals.itemCount ?? 0);
    } catch { setCart(null); } finally { setLoading(false); }
  }, [setCount]);

  useEffect(() => {
    if (drawerOpen) loadCart();
  }, [drawerOpen, loadCart]);

  const updateQty = useCallback(async (itemId: string, qty: number) => {
    setUpdating(itemId);
    try {
      if (qty === 0) {
        await apiDelete('/api/cart', { itemId });
      } else {
        await apiPatch('/api/cart', { itemId, qty });
      }
      await loadCart();
    } catch (error: any) { toast({ title: 'Error', message: error.message || 'Failed to update cart', tone: 'danger' }); } finally { setUpdating(null); }
  }, [loadCart, toast]);

  const removeItem = useCallback(async (itemId: string) => {
    try { await apiDelete('/api/cart', { itemId }); await loadCart(); toast({ title: 'Removed', message: 'Item removed from bag', tone: 'success' }); } catch { toast({ title: 'Error', message: 'Failed to remove item', tone: 'danger' }); }
  }, [loadCart, toast]);

  const saveForLater = useCallback(async (itemId: string) => {
    try { await apiDelete('/api/cart', { itemId, action: 'saveForLater' }, { body: JSON.stringify({ itemId, saved: true }) }); await loadCart(); toast({ title: 'Saved', message: 'Item saved for later', tone: 'success' }); } catch { toast({ title: 'Error', message: 'Failed to save item', tone: 'danger' }); }
  }, [loadCart, toast]);

  if (!drawerOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-ink/50 z-[90] animate-in" onClick={closeDrawer} aria-hidden="true" />
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-paper z-[100] flex flex-col shadow-xl animate-in-right" role="dialog" aria-label="Shopping bag" aria-modal="true">
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h2 className="u-display text-xl font-medium">
            Shopping Bag
            {cart && cart.lines.length > 0 && (
              <span className="ml-2 text-sm text-muted font-normal">({cart.totals.unitCount} items)</span>
            )}
          </h2>
          <button onClick={closeDrawer} className="w-10 h-10 rounded-md hover:bg-ink-2 flex items-center justify-center transition-colors u-focus" aria-label="Close bag">
            <X className="w-5 h-5 text-ink" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-3 pb-4 border-b border-line last:border-0">
                  <div className="w-20 h-28 rounded-md bg-paper-2 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-paper-2 rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-paper-2 rounded animate-pulse" />
                    <div className="h-3 w-1/3 bg-paper-2 rounded animate-pulse" />
                    <div className="flex gap-2 mt-2">
                      <div className="h-8 w-8 bg-paper-2 rounded animate-pulse" />
                      <div className="h-8 w-8 bg-paper-2 rounded animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : !cart || cart.lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-20 h-20 rounded-full bg-ink/5 flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
              </div>
              <p className="u-display text-lg mb-2">Your bag is empty</p>
              <p className="text-muted text-sm mb-6">Looks like you haven&apos;t added anything yet.</p>
              <Link href="/products" onClick={closeDrawer}><Button className="w-full sm:w-auto">Start Shopping</Button></Link>
            </div>
          ) : (
            <>
              {cart.notices.length > 0 && (
                <div className="mb-4 space-y-2" role="status" aria-live="polite">
                  {cart.notices.map((notice, i) => <div key={i} className="p-3 bg-warning/10 border border-warning/20 rounded-md text-sm text-warning">{notice.message}</div>)}
                </div>
              )}
              {cart.issues.length > 0 && (
                <div className="mb-4 space-y-2" role="alert" aria-live="assertive">
                  {cart.issues.map((issue, i) => <div key={i} className="p-3 bg-danger/10 border border-danger/20 rounded-md text-sm text-danger">{issue.message}</div>)}
                </div>
              )}
              <ul className="space-y-4" role="list" aria-label="Cart items">
                {cart.lines.map((item) => (
                  <li key={item.cartItemId ?? item.key} className="flex gap-3 pb-4 border-b border-line last:border-0">
                    <Link href={'/products/' + item.productSlug} className="relative w-20 h-28 flex-shrink-0 rounded-md overflow-hidden bg-paper-2" aria-label={'View ' + item.productName}>
                      {item.imageUrl ? (
                        <SmartImage src={item.imageUrl} alt="" fill className="object-cover" sizes="80px" loading="lazy" placeholder="blur" blurDataURL="data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc4MCcgaGVpZ2h0PSc5Nic+PHJlY3Qgd2lkdGg9JzEwMCUnIGhlaWdodD0nMTAwJScgZmlsbD0nI2Y0ZjJlYycvPjwvc3ZnPg==" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                      )}
                      {item.exceedsStock && <div className="absolute inset-0 bg-danger/80 flex items-center justify-center"><span className="text-paper text-xs font-medium">Out of Stock</span></div>}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link href={'/products/' + item.productSlug} className="font-medium text-sm text-ink hover:text-accent transition-colors line-clamp-2" onClick={closeDrawer}>{item.productName}</Link>
                      <div className="flex items-center gap-2 text-xs text-muted mt-1 flex-wrap">
                        <span>Size: {item.size}</span><span aria-hidden="true">·</span>
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full border border-line/50 inline-block" style={{ backgroundColor: (item as any).colorHex || '#666' }} aria-hidden="true" />
                          <span>{item.color}</span>
                        </div>
                      </div>
                      {item.priceChanged && item.priceWas !== null && <p className="text-xs text-danger mt-1">Price updated: was {formatCurrency(item.priceWas)}</p>}
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center border border-line rounded-md overflow-hidden">
                          <button onClick={() => updateQty(item.cartItemId ?? item.key ?? '', item.qty - 1)} disabled={updating === (item.cartItemId ?? item.key ?? '') || item.qty <= 1} className="w-10 h-10 flex items-center justify-center hover:bg-ink-2 transition-colors disabled:opacity-50 u-focus" aria-label="Decrease quantity">
                            <Minus className="w-4 h-4 text-ink" aria-hidden="true" />
                          </button>
                          <span className="w-10 text-center text-sm font-medium tabular-nums">{item.qty}</span>
                          <button onClick={() => updateQty(item.cartItemId ?? item.key ?? '', item.qty + 1)} disabled={updating === (item.cartItemId ?? item.key ?? '') || item.qty >= item.available || item.qty >= 10} className="w-10 h-10 flex items-center justify-center hover:bg-ink-2 transition-colors disabled:opacity-50 u-focus" aria-label="Increase quantity">
                            <Plus className="w-4 h-4 text-ink" aria-hidden="true" />
                          </button>
                        </div>
                        <div className="flex flex-col items-end ml-auto">
                          <span className="font-medium text-sm text-ink tabular-nums">{formatCurrency(item.lineTotal)}</span>
                          {item.discount > 0 && <span className="text-xs text-positive line-through">{formatCurrency(item.unitPrice * item.qty)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <button onClick={() => saveForLater(item.cartItemId ?? item.key ?? '')} className="text-xs text-muted hover:text-ink transition-colors flex items-center gap-1 u-focus"><Heart className="w-3.5 h-3.5" aria-hidden="true" />Save for later</button>
                        <button onClick={() => removeItem(item.cartItemId ?? item.key ?? '')} className="text-xs text-muted hover:text-danger transition-colors flex items-center gap-1 u-focus"><Trash2 className="w-3.5 h-3.5" aria-hidden="true" />Remove</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {cart && cart.lines.length > 0 && (
            <div className="mt-6 space-y-3 border-t border-line pt-4">
              <div className="flex justify-between text-sm"><span className="text-muted">Subtotal ({cart.totals.unitCount} items)</span><span className="font-medium tabular-nums">{formatCurrency(cart.totals.subtotal)}</span></div>
              {cart.totals.couponDiscount > 0 && <div className="flex justify-between text-sm text-positive"><span>Discount</span><span>{'\u2212'}{formatCurrency(cart.totals.couponDiscount)}</span></div>}
              {cart.totals.loyaltyDiscount > 0 && <div className="flex justify-between text-sm text-positive"><span>Points redeemed</span><span>{'\u2212'}{formatCurrency(cart.totals.loyaltyDiscount)}</span></div>}
              <div className="flex justify-between text-sm"><span>Shipping</span><span className={cart.totals.shippingTotal === 0 ? 'text-positive font-medium' : ''}>{cart.totals.shippingTotal === 0 ? 'Free' : formatCurrency(cart.totals.shippingTotal)}</span></div>
              {cart.totals.codFee > 0 && <div className="flex justify-between text-sm"><span>COD handling</span><span>{formatCurrency(cart.totals.codFee)}</span></div>}
              <div className="flex justify-between text-sm text-muted border-t border-line pt-2"><span>Tax (incl.)</span><span className="tabular-nums">{formatCurrency(cart.totals.taxTotal)}</span></div>
              {cart.totals.roundOff !== 0 && <div className="flex justify-between text-sm text-muted"><span>Round off</span><span>{cart.totals.roundOff > 0 ? '+' : ''}{formatCurrency(cart.totals.roundOff)}</span></div>}
              <div className="flex justify-between text-lg font-medium border-t border-line pt-2"><span>Total</span><span className="tabular-nums">{formatCurrency(cart.totals.grandTotal)}</span></div>
              {cart.totals.walletApplied > 0 && <div className="flex justify-between text-sm text-positive"><span>Wallet applied</span><span>{'\u2212'}{formatCurrency(cart.totals.walletApplied)}</span></div>}
              <div className="flex justify-between text-lg font-semibold text-accent border-t border-line pt-2"><span>To Pay</span><span className="tabular-nums">{formatCurrency(cart.totals.amountDue)}</span></div>
              {cart.totals.totalSavings > 0 && <p className="text-xs text-positive text-center font-medium">You saved {formatCurrency(cart.totals.totalSavings)} today!</p>}
            </div>
          )}
        </div>

        {cart && cart.lines.length > 0 && (
          <div className="p-4 border-t border-line space-y-3">
            <Link href="/cart" onClick={closeDrawer} className="block"><Button variant="outline" className="w-full justify-center gap-2"><ChevronRight className="w-4 h-4" aria-hidden="true" />View &amp; Edit Bag</Button></Link>
            <Link href="/checkout" onClick={closeDrawer} className="block"><Button className="w-full justify-center gap-2" disabled={cart.issues.length > 0}>Proceed to Checkout<ChevronRight className="w-4 h-4" aria-hidden="true" /></Button></Link>
            <p className="text-xs text-muted text-center">Secure checkout {'\u2022'} Free shipping on orders above {'\u20B9'}2,999 {'\u2022'} Easy returns</p>
          </div>
        )}
      </aside>
    </>
  );
}
