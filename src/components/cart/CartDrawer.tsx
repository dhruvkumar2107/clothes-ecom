'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCartStore, useToast } from '@/app/providers';
import { Button } from '@/components/ui/Button';
import { X, Plus, Minus, Trash2, Heart, ChevronRight, Loader2, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/lib/utils';
import { apiGet, apiDelete } from '@/lib/api-client';
import type { CartView } from '@/lib/cart';

export function CartDrawer() {
  const { drawerOpen, closeDrawer, setCount, refresh } = useCartStore();
  const { toast } = useToast();
  const [cart, setCart] = useState<CartView | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (drawerOpen) {
      loadCart();
    }
  }, [drawerOpen]);

  const loadCart = async () => {
    setLoading(true);
    try {
      const data = await apiGet<CartView>('/api/cart');
      setCart(data);
      setCount(data?.totals.itemCount ?? 0);
    } catch {
      setCart(null);
    } finally {
      setLoading(false);
    }
  };

  const updateQty = async (itemId: string, qty: number) => {
    setUpdating(itemId);
    try {
      const params: Record<string, string> = { itemId };
      if (qty === 0) params.action = 'remove';
      await apiDelete('/api/cart', params, { body: JSON.stringify({ itemId, qty }) });
      await loadCart();
    } catch (error: any) {
      toast({ title: 'Error', message: error.message || 'Failed to update cart', tone: 'danger' });
    } finally {
      setUpdating(null);
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      await apiDelete('/api/cart', { itemId });
      await loadCart();
      toast({ title: 'Removed', message: 'Item removed from bag', tone: 'success' });
    } catch {
      toast({ title: 'Error', message: 'Failed to remove item', tone: 'danger' });
    }
  };

  const saveForLater = async (itemId: string) => {
    try {
      await apiDelete('/api/cart', { itemId, action: 'saveForLater' }, { body: JSON.stringify({ itemId, saved: true }) });
      await loadCart();
      toast({ title: 'Saved', message: 'Item saved for later', tone: 'success' });
    } catch {
      toast({ title: 'Error', message: 'Failed to save item', tone: 'danger' });
    }
  };

  if (!drawerOpen) return null;

  const getColorHex = (color: string): string => {
    const colorMap: Record<string, string> = {
      'black': '#000000',
      'white': '#ffffff',
      'navy': '#1a237e',
      'charcoal': '#36454f',
      'grey': '#808080',
      'gray': '#808080',
      'silver': '#c0c0c0',
      'beige': '#f5f5dc',
      'cream': '#fffdd0',
      'ivory': '#fffff0',
      'brown': '#8b4513',
      'tan': '#d2b48c',
      'camel': '#c19a6b',
      'red': '#ff0000',
      'maroon': '#800000',
      'burgundy': '#800020',
      'pink': '#ffc0cb',
      'rose': '#ff66cc',
      'orange': '#ffa500',
      'rust': '#b7410e',
      'yellow': '#ffff00',
      'gold': '#ffd700',
      'mustard': '#ffdb58',
      'green': '#008000',
      'olive': '#808000',
      'sage': '#8c8b7a',
      'forest': '#228b22',
      'mint': '#98ff98',
      'blue': '#0000ff',
      'teal': '#008080',
      'cyan': '#00ffff',
      'sky': '#87ceeb',
      'indigo': '#4b0082',
      'violet': '#ee82ee',
      'purple': '#800080',
      'lavender': '#e6e6fa',
    };
    const normalized = color.toLowerCase().trim();
    return colorMap[normalized] || '#666666';
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-ink/50 z-[90] animate-in"
        onClick={closeDrawer}
        aria-hidden="true"
      />
      <aside
        className="fixed right-0 top-0 h-full w-full max-w-md bg-paper z-[100] flex flex-col shadow-xl animate-in-right"
        role="dialog"
        aria-label="Shopping bag"
        aria-modal="true"
      >
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h2 className="u-display text-xl font-medium">Shopping Bag</h2>
          <button
            onClick={closeDrawer}
            className="w-10 h-10 rounded-md hover:bg-ink-2 flex items-center justify-center transition-colors u-focus"
            aria-label="Close bag"
          >
            <X className="w-5 h-5 text-ink" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-accent animate-spin" aria-hidden="true" />
            </div>
          ) : !cart || cart.lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <svg className="w-16 h-16 text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <p className="u-display text-lg mb-2">Your bag is empty</p>
              <p className="text-muted text-sm mb-6">Looks like you haven't added anything yet.</p>
              <Link href="/products" onClick={closeDrawer}>
                <Button className="w-full sm:w-auto">Start Shopping</Button>
              </Link>
            </div>
          ) : (
            <>
              {cart.notices.length > 0 && (
                <div className="mb-4 space-y-2" role="status" aria-live="polite">
                  {cart.notices.map((notice, i) => (
                    <div key={i} className="p-3 bg-warning/10 border border-warning/20 rounded-md text-sm text-warning">
                      {notice.message}
                    </div>
                  ))}
                </div>
              )}

              {cart.issues.length > 0 && (
                <div className="mb-4 space-y-2" role="alert" aria-live="assertive">
                  {cart.issues.map((issue, i) => (
                    <div key={i} className="p-3 bg-danger/10 border border-danger/20 rounded-md text-sm text-danger">
                      {issue.message}
                    </div>
                  ))}
                </div>
              )}

              <ul className="space-y-4" role="list" aria-label="Cart items">
                <AnimatePresence>
                {cart.lines.map((item, index) => (
                  <motion.li
                    key={item.cartItemId ?? item.key}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20, height: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex gap-3 pb-4 border-b border-line last:border-0"
                  >
                    <Link
                      href={`/products/${item.productSlug}`}
                      className="relative w-20 h-28 flex-shrink-0 rounded-md overflow-hidden bg-paper-2"
                      aria-label={`View ${item.productName}`}
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      {item.exceedsStock && (
                        <div className="absolute inset-0 bg-danger/80 flex items-center justify-center">
                          <span className="text-paper text-xs font-medium">Out of Stock</span>
                        </div>
                      )}
                    </Link>

                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/products/${item.productSlug}`}
                        className="font-medium text-sm text-ink hover:text-accent transition-colors line-clamp-2"
                        onClick={closeDrawer}
                      >
                        {item.productName}
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-muted mt-1 flex-wrap">
                        <span>Size: {item.size}</span>
                        <span>•</span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-4 h-4 rounded-full border border-line/50 inline-block"
                            style={{ backgroundColor: getColorHex(item.color) }}
                            aria-hidden="true"
                          />
                          <span>{item.color}</span>
                        </div>
                      </div>
                      {item.priceChanged && item.priceWas !== null && (
                        <p className="text-xs text-danger mt-1">
                          Price updated: was {formatCurrency(item.priceWas)}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center border border-line rounded-md overflow-hidden">
                          <button
                            onClick={() => updateQty(item.cartItemId ?? item.key ?? '', item.qty - 1)}
                            disabled={updating === (item.cartItemId ?? item.key ?? '') || item.qty <= 1}
                            className="w-10 h-10 flex items-center justify-center hover:bg-ink-2 transition-colors disabled:opacity-50 u-focus"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-4 h-4 text-ink" aria-hidden="true" />
                          </button>
                          <span className="w-10 text-center text-sm font-medium">{item.qty}</span>
                          <button
                            onClick={() => updateQty(item.cartItemId ?? item.key ?? '', item.qty + 1)}
                            disabled={updating === (item.cartItemId ?? item.key ?? '') || item.qty >= item.available || item.qty >= 10}
                            className="w-10 h-10 flex items-center justify-center hover:bg-ink-2 transition-colors disabled:opacity-50 u-focus"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-4 h-4 text-ink" aria-hidden="true" />
                          </button>
                        </div>

                        <div className="flex flex-col items-end ml-auto">
                          <span className="font-medium text-sm text-ink">
                            {formatCurrency(item.lineTotal)}
                          </span>
                          {item.discount > 0 && (
                            <span className="text-xs text-positive line-through">
                              {formatCurrency(item.unitPrice * item.qty)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-2">
                        <button
                          onClick={() => saveForLater(item.cartItemId ?? item.key ?? '')}
                          className="text-xs text-muted hover:text-ink transition-colors flex items-center gap-1 u-focus"
                        >
                          <Heart className="w-3.5 h-3.5" aria-hidden="true" />
                          Save for later
                        </button>
                        <button
                          onClick={() => removeItem(item.cartItemId ?? item.key ?? '')}
                          className="text-xs text-muted hover:text-danger transition-colors flex items-center gap-1 u-focus"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          Remove
                        </button>
                      </div>
                    </div>
                  </motion.li>
                ))}
                </AnimatePresence>
              </ul>
            </>
          )}

          {/* Totals */}
          {cart && cart.lines.length > 0 && (
            <div className="mt-6 space-y-3 border-t border-line pt-4">
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

              <div className="flex justify-between text-lg font-medium border-t border-line pt-2">
                <span>Total</span>
                <span>{formatCurrency(cart.totals.grandTotal)}</span>
              </div>

              {cart.totals.walletApplied > 0 && (
                <div className="flex justify-between text-sm text-positive">
                  <span>Wallet applied</span>
                  <span>−{formatCurrency(cart.totals.walletApplied)}</span>
                </div>
              )}

              <div className="flex justify-between text-lg font-semibold text-accent border-t border-line pt-2">
                <span>To Pay</span>
                <span>{formatCurrency(cart.totals.amountDue)}</span>
              </div>

              {cart.totals.totalSavings > 0 && (
                <p className="text-xs text-positive text-center">
                  You saved {formatCurrency(cart.totals.totalSavings)} today!
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {cart && cart.lines.length > 0 && (
          <div className="p-4 border-t border-line space-y-3">
            <Link href="/cart" onClick={closeDrawer} className="block">
              <Button variant="outline" className="w-full justify-center gap-2">
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
                View & Edit Bag
              </Button>
            </Link>
            <Link href="/checkout" onClick={closeDrawer} className="block">
              <Button className="w-full justify-center gap-2" disabled={cart.issues.length > 0}>
                Proceed to Checkout
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </Button>
            </Link>
            <p className="text-xs text-muted text-center">
              Secure checkout • Free shipping on orders above ₹2,999 • Easy returns
            </p>
          </div>
        )}
      </aside>
    </>
  );
}