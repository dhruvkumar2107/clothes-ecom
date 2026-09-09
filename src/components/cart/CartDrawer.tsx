'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { SmartImage } from '@/components/ui/SmartImage';
import { useCartStore, useToast } from '@/app/providers';
import { X, Plus, Minus, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { apiGet, apiPatch, apiDelete } from '@/lib/api-client';
import type { CartView } from '@/lib/cart';

const FREE_SHIPPING_THRESHOLD = 299900;

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

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

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

  if (!drawerOpen) return null;

  const subtotal = cart?.totals.subtotal ?? 0;
  const shippingProgress = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const amountToFreeShipping = Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/40 z-[90] animate-fade-in backdrop-blur-sm"
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className="fixed right-0 top-0 h-full w-full max-w-[420px] bg-paper z-[100] flex flex-col shadow-2xl animate-slide-in-right"
        role="dialog"
        aria-label="Shopping bag"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div>
            <h2 className="u-display text-lg">Shopping Bag</h2>
            {cart && cart.lines.length > 0 && (
              <p className="text-xs text-muted mt-0.5">{cart.totals.unitCount} {cart.totals.unitCount === 1 ? 'item' : 'items'}</p>
            )}
          </div>
          <button
            onClick={closeDrawer}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-paper-2 transition-colors u-focus"
            aria-label="Close bag"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Free Shipping Progress */}
        {cart && cart.lines.length > 0 && amountToFreeShipping > 0 && (
          <div className="px-6 py-3 border-b border-line">
            <p className="text-xs text-muted mb-2">
              Add <span className="font-medium text-ink">{formatCurrency(amountToFreeShipping)}</span> more for free shipping
            </p>
            <div className="h-1 bg-paper-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-ink transition-all duration-500 rounded-full"
                style={{ width: `${shippingProgress}%` }}
              />
            </div>
          </div>
        )}

        {cart && cart.lines.length > 0 && amountToFreeShipping <= 0 && (
          <div className="px-6 py-3 border-b border-line bg-success/5">
            <p className="text-xs text-success font-medium">You qualify for free shipping</p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 space-y-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-20 h-28 rounded bg-paper-2 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-paper-2 rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-paper-2 rounded animate-pulse" />
                    <div className="h-3 w-1/3 bg-paper-2 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : !cart || cart.lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <div className="w-16 h-16 rounded-full bg-paper-2 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <p className="u-display text-lg mb-1">Your bag is empty</p>
              <p className="text-sm text-muted mb-6">Discover our latest collection</p>
              <Link
                href="/products"
                onClick={closeDrawer}
                className="btn-primary text-xs"
              >
                Start Shopping
              </Link>
            </div>
          ) : (
            <div className="p-6">
              {/* Issues */}
              {cart.issues.length > 0 && (
                <div className="mb-4 space-y-2" role="alert">
                  {cart.issues.map((issue, i) => (
                    <div key={i} className="p-3 bg-danger/5 border border-danger/10 rounded text-xs text-danger">
                      {issue.message}
                    </div>
                  ))}
                </div>
              )}

              {/* Cart Items */}
              <ul className="space-y-5" role="list" aria-label="Cart items">
                {cart.lines.map((item) => (
                  <li key={item.cartItemId ?? item.key} className="flex gap-4">
                    {/* Image */}
                    <Link
                      href={'/products/' + item.productSlug}
                      className="relative w-[72px] h-[96px] flex-shrink-0 rounded overflow-hidden bg-paper-2"
                      onClick={closeDrawer}
                      aria-label={'View ' + item.productName}
                    >
                      {item.imageUrl ? (
                        <SmartImage
                          src={item.imageUrl}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="72px"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      {item.exceedsStock && (
                        <div className="absolute inset-0 bg-danger/80 flex items-center justify-center">
                          <span className="text-paper text-[10px] font-medium">Out of Stock</span>
                        </div>
                      )}
                    </Link>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <Link
                        href={'/products/' + item.productSlug}
                        className="text-sm font-medium text-ink line-clamp-1 hover:underline"
                        onClick={closeDrawer}
                      >
                        {item.productName}
                      </Link>

                      <div className="flex items-center gap-2 text-xs text-muted mt-1">
                        <span>{item.size}</span>
                        <span className="text-line-2">·</span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-3 h-3 rounded-full border border-line/50"
                            style={{ backgroundColor: (item as any).colorHex || '#666' }}
                            aria-hidden="true"
                          />
                          <span>{item.color}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        {/* Quantity Controls */}
                        <div className="flex items-center border border-line rounded">
                          <button
                            onClick={() => updateQty(item.cartItemId ?? item.key ?? '', item.qty - 1)}
                            disabled={updating === (item.cartItemId ?? item.key ?? '') || item.qty <= 1}
                            className="w-8 h-8 flex items-center justify-center hover:bg-paper-2 transition-colors disabled:opacity-30 u-focus"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" aria-hidden="true" />
                          </button>
                          <span className="w-8 text-center text-xs font-medium tabular-nums">{item.qty}</span>
                          <button
                            onClick={() => updateQty(item.cartItemId ?? item.key ?? '', item.qty + 1)}
                            disabled={updating === (item.cartItemId ?? item.key ?? '') || item.qty >= item.available || item.qty >= 10}
                            className="w-8 h-8 flex items-center justify-center hover:bg-paper-2 transition-colors disabled:opacity-30 u-focus"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3 h-3" aria-hidden="true" />
                          </button>
                        </div>

                        {/* Price */}
                        <span className="text-sm font-medium tabular-nums">{formatCurrency(item.lineTotal)}</span>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => removeItem(item.cartItemId ?? item.key ?? '')}
                        className="text-[11px] text-muted hover:text-danger transition-colors mt-2 flex items-center gap-1 u-focus"
                      >
                        <Trash2 className="w-3 h-3" aria-hidden="true" />
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        {cart && cart.lines.length > 0 && (
          <div className="border-t border-line p-6 space-y-4">
            {/* Summary */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="font-medium tabular-nums">{formatCurrency(cart.totals.subtotal)}</span>
              </div>
              {cart.totals.couponDiscount > 0 && (
                <div className="flex justify-between text-sm text-success">
                  <span>Discount</span>
                  <span>{'\u2212'}{formatCurrency(cart.totals.couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted">Shipping</span>
                <span className={cart.totals.shippingTotal === 0 ? 'text-success font-medium' : ''}>
                  {cart.totals.shippingTotal === 0 ? 'Free' : formatCurrency(cart.totals.shippingTotal)}
                </span>
              </div>
              <div className="flex justify-between text-base font-medium pt-2 border-t border-line">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(cart.totals.grandTotal)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Link href="/checkout" onClick={closeDrawer} className="block">
                <button className="btn-primary w-full text-xs" disabled={cart.issues.length > 0}>
                  Checkout
                </button>
              </Link>
              <Link href="/cart" onClick={closeDrawer} className="block">
                <button className="btn-secondary w-full text-xs">
                  View Bag
                </button>
              </Link>
            </div>

            <p className="text-[10px] text-muted text-center">
              Secure checkout · Free shipping above ₹2,999 · 14-day returns
            </p>
          </div>
        )}
      </aside>
    </>
  );
}
