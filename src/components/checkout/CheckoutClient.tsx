'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SmartImage } from '@/components/ui/SmartImage';
import { ChevronRight, CreditCard, Smartphone, Landmark, Lock, Loader2, AlertCircle, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select, Label } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { apiPost, apiGet, apiDelete } from '@/lib/api-client';
import { useToast } from '@/app/providers';
import type { CartView } from '@/lib/cart';
import type { CartTotals } from '@/lib/pricing';

interface Address {
  id: string;
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

interface CheckoutClientProps {
  initialCart: CartView;
  addresses: Address[];
  userId: string | null;
}

const PAYMENT_METHODS = [
  { id: 'card', label: 'Credit / Debit Card', icon: CreditCard, description: 'Visa, Mastercard, RuPay, Amex' },
  { id: 'upi', label: 'UPI', icon: Smartphone, description: 'PhonePe, Google Pay, Paytm, BHIM' },
  { id: 'netbanking', label: 'Net Banking', icon: Landmark, description: '50+ banks supported' },
  { id: 'cod', label: 'Cash on Delivery', icon: CreditCard, description: 'Pay when you receive (fee may apply)' },
];

export function CheckoutClient({ initialCart, addresses, userId }: CheckoutClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [cart, setCart] = useState<CartView>(initialCart);
  const [step, setStep] = useState<'address' | 'payment' | 'review'>('address');
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [newAddress, setNewAddress] = useState({
    label: 'home',
    name: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'upi' | 'netbanking' | 'cod'>('card');
  const [processing, setProcessing] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [walletAmount, setWalletAmount] = useState(0);
  const [localAddresses, setLocalAddresses] = useState<Address[]>(addresses);

  // Initialize selected address
  useEffect(() => {
    if (localAddresses.length > 0 && !selectedAddressId) {
      const defaultAddr = localAddresses.find(a => a.isDefault) || localAddresses[0];
      setSelectedAddressId(defaultAddr.id);
    }
  }, [localAddresses, selectedAddressId]);

  // Sync with prop addresses
  useEffect(() => {
    setLocalAddresses(addresses);
  }, [addresses]);

  const refreshCart = async () => {
    try {
      const data = await apiGet<CartView>('/api/cart');
      setCart(data);
    } catch {}
  };

  const handleAddressSelect = (addressId: string) => {
    setSelectedAddressId(addressId);
    setShowNewAddress(false);
  };

  const handleNewAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiPost<{ data: Address }>('/api/account/addresses', newAddress);
      setLocalAddresses(prev => [...prev, res.data]);
      setSelectedAddressId(res.data.id);
      setShowNewAddress(false);
      setNewAddress({ label: 'home', name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' });
      toast({ title: 'Address added', message: 'Your address has been saved', tone: 'success' });
    } catch (error: any) {
      toast({ title: 'Error', message: error.message || 'Failed to add address', tone: 'danger' });
    }
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      await apiDelete('/api/cart', { action: 'coupon', code: couponCode.trim().toUpperCase() });
      await refreshCart();
      toast({ title: 'Coupon applied', message: 'Your coupon has been applied', tone: 'success' });
    } catch (error: any) {
      toast({ title: 'Invalid coupon', message: error.message, tone: 'danger' });
    }
  };

  const goToPayment = () => {
    if (!selectedAddressId && !showNewAddress) {
      toast({ title: 'Select address', message: 'Please choose or add a delivery address', tone: 'warning' });
      return;
    }
    if (showNewAddress && (!newAddress.name || !newAddress.phone || !newAddress.line1 || !newAddress.city || !newAddress.state || !newAddress.pincode)) {
      toast({ title: 'Complete address', message: 'Please fill in all required fields', tone: 'warning' });
      return;
    }
    setStep('payment');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToReview = () => {
    setStep('review');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const placeOrder = async () => {
    if (!selectedAddressId) {
      toast({ title: 'Select address', message: 'Please choose a delivery address', tone: 'warning' });
      return;
    }

    setProcessing(true);
    try {
      const res = await apiPost<{ data: { redirectUrl?: string; paymentIntent?: { id: string } } }>('/api/checkout', {
        addressId: selectedAddressId,
        paymentMethod,
        couponCode: couponCode || null,
        walletRequested: walletAmount,
      });

      if (res.data.redirectUrl) {
        window.location.href = res.data.redirectUrl;
      } else if (res.data.paymentIntent) {
        // Redirect to payment gateway
        const provider = paymentMethod === 'cod' ? 'cod' : 'razorpay';
        // Handle payment gateway redirect
        window.location.href = `/checkout/payment?intent=${res.data.paymentIntent.id}`;
      }
    } catch (error: any) {
      toast({ title: 'Order failed', message: error.message || 'Failed to place order', tone: 'danger' });
    } finally {
      setProcessing(false);
    }
  };

  const selectedAddress = localAddresses.find(a => a.id === selectedAddressId);

  const canProceed = cart.lines.length > 0 && cart.issues.length === 0;

  return (
    <div className="py-8 md:py-12 min-h-screen">
      <div className="u-container">
        {/* Progress Steps */}
        <div className="hidden md:flex items-center justify-center mb-8" role="progressbar" aria-label="Checkout progress">
          {['address', 'payment', 'review'].map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-2 ${['address', 'payment', 'review'].indexOf(step) >= i ? 'text-accent' : 'text-muted'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                  ['address', 'payment', 'review'].indexOf(step) >= i ? 'border-accent bg-accent text-paper' : 'border-line'
                }`}>
                  {['address', 'payment', 'review'].indexOf(step) > i ? <CheckCircle className="w-5 h-5" /> : i + 1}
                </div>
                <span className="u-label hidden sm:inline">{s.charAt(0).toUpperCase() + s.slice(1)}</span>
              </div>
              {i < 2 && <div className={`w-20 h-1 mx-2 ${['address', 'payment', 'review'].indexOf(step) > i ? 'bg-accent' : 'bg-line'}`} />}
            </React.Fragment>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form Steps */}
          <div className="lg:col-span-2 space-y-6">
            {/* Address Step */}
            {step === 'address' && (
              <div className="space-y-6">
                <div>
                  <h2 className="u-display text-2xl mb-2">Delivery Address</h2>
                  <p className="text-muted">Where should we deliver your order?</p>
                </div>

                {localAddresses.length > 0 && (
                  <fieldset className="space-y-3">
                    <legend className="u-label mb-2">Saved Addresses</legend>
                    <div className="grid gap-3" role="radiogroup" aria-label="Select delivery address">
                      {localAddresses.map((addr) => (
                        <label
                          key={addr.id}
                          className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            selectedAddressId === addr.id
                              ? 'border-accent bg-accent/5'
                              : 'border-line hover:border-ink/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="address"
                            value={addr.id}
                            checked={selectedAddressId === addr.id}
                            onChange={() => handleAddressSelect(addr.id)}
                            className="sr-only"
                          />
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              selectedAddressId === addr.id ? 'border-accent bg-accent' : 'border-line'
                            }">
                              {selectedAddressId === addr.id && <CheckCircle className="w-4 h-4 text-paper" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{addr.name}</span>
                                {addr.isDefault && <span className="text-xs px-2 py-0.5 bg-accent/10 text-accent rounded">Default</span>}
                              </div>
                              <p className="text-sm text-muted mt-1">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.state} {addr.pincode}</p>
                              <p className="text-sm text-muted">{addr.phone}</p>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}

                <Button variant="outline" onClick={() => setShowNewAddress(true)} className="w-full justify-center gap-2">
                  <ChevronRight className="w-4 h-4" />
                  Add New Address
                </Button>

                {showNewAddress && (
                  <form onSubmit={handleNewAddressSubmit} className="space-y-4 p-4 border border-line rounded-lg bg-paper-2">
                    <h3 className="u-label mb-2">New Address</h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="new-name">Full Name *</Label>
                        <Input id="new-name" value={newAddress.name} onChange={e => setNewAddress(p => ({ ...p, name: e.target.value }))} required />
                      </div>
                      <div>
                        <Label htmlFor="new-phone">Phone *</Label>
                        <Input id="new-phone" type="tel" value={newAddress.phone} onChange={e => setNewAddress(p => ({ ...p, phone: e.target.value }))} required />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="new-line1">Address Line 1 *</Label>
                      <Input id="new-line1" value={newAddress.line1} onChange={e => setNewAddress(p => ({ ...p, line1: e.target.value }))} required />
                    </div>
                    <div>
                      <Label htmlFor="new-line2">Address Line 2</Label>
                      <Input id="new-line2" value={newAddress.line2} onChange={e => setNewAddress(p => ({ ...p, line2: e.target.value }))} />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="new-city">City *</Label>
                        <Input id="new-city" value={newAddress.city} onChange={e => setNewAddress(p => ({ ...p, city: e.target.value }))} required />
                      </div>
                      <div>
                        <Label htmlFor="new-state">State *</Label>
                        <Input id="new-state" value={newAddress.state} onChange={e => setNewAddress(p => ({ ...p, state: e.target.value }))} required />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="new-pincode">PIN Code *</Label>
                      <Input id="new-pincode" value={newAddress.pincode} onChange={e => setNewAddress(p => ({ ...p, pincode: e.target.value }))} required maxLength={6} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="new-label">Address Type</Label>
                      <Select
                        value={newAddress.label}
                        onChange={e => setNewAddress(p => ({ ...p, label: e.target.value }))}
                        options={[
                          { value: 'home', label: 'Home' },
                          { value: 'work', label: 'Work' },
                          { value: 'other', label: 'Other' }
                        ]}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit">Save Address</Button>
                      <Button type="button" variant="outline" onClick={() => setShowNewAddress(false)}>Cancel</Button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Payment Step */}
            {step === 'payment' && (
              <div className="space-y-6">
                <div>
                  <h2 className="u-display text-2xl mb-2">Payment Method</h2>
                  <p className="text-muted">How would you like to pay?</p>
                </div>

                <fieldset className="space-y-3">
                  <legend className="u-label mb-2">Choose Payment Method</legend>
                  <div className="grid gap-3" role="radiogroup" aria-label="Select payment method">
                    {PAYMENT_METHODS.map((method) => (
                      <label
                        key={method.id}
                        className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all flex items-center gap-4 ${
                          paymentMethod === method.id
                            ? 'border-accent bg-accent/5'
                            : 'border-line hover:border-ink/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment"
                          value={method.id}
                          checked={paymentMethod === method.id}
                          onChange={() => setPaymentMethod(method.id as any)}
                          className="sr-only"
                        />
                        <div className="w-10 h-10 rounded-lg bg-ink/5 flex items-center justify-center flex-shrink-0">
                          <method.icon className="w-5 h-5 text-ink" aria-hidden="true" />
                        </div>
                        <div className="flex-1">
                          <span className="font-medium text-sm">{method.label}</span>
                          <p className="text-xs text-muted">{method.description}</p>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          paymentMethod === method.id ? 'border-accent bg-accent' : 'border-line'
                        }`}>
                          {paymentMethod === method.id && <CheckCircle className="w-4 h-4 text-paper" />}
                        </div>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {/* Wallet */}
                {cart.totals.walletApplied > 0 && (
                  <div className="p-4 bg-paper rounded-lg border border-line">
                    <h3 className="u-label mb-3">Wallet Balance</h3>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted">Available: {formatCurrency(cart.totals.walletApplied)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={cart.totals.walletApplied}
                        value={walletAmount}
                        onChange={e => setWalletAmount(Math.min(parseInt(e.target.value) || 0, cart.totals.walletApplied))}
                        className="w-32"
                        placeholder="Amount"
                      />
                      <span className="text-muted">Use wallet balance</span>
                    </div>
                    <p className="text-xs text-muted mt-2">Max {Math.min(100, cart.totals.walletApplied / cart.totals.grandTotal * 100 | 0)}% of order total can be paid from wallet</p>
                  </div>
                )}

                {/* Coupon */}
                <div className="p-4 bg-paper rounded-lg border border-line">
                  <h3 className="u-label mb-3">Promo Code</h3>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Enter promo code"
                      value={couponCode}
                      onChange={e => setCouponCode(e.target.value)}
                      className="flex-1 text-uppercase"
                    />
                    <Button onClick={applyCoupon} disabled={!couponCode.trim()}>Apply</Button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep('address')} className="flex-1">
                    <ChevronRight className="w-4 h-4 rotate-180" />
                    Back
                  </Button>
                  <Button onClick={goToReview} className="flex-1 justify-center" disabled={!canProceed}>
                    Continue to Review
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Review Step */}
            {step === 'review' && (
              <div className="space-y-6">
                <div>
                  <h2 className="u-display text-2xl mb-2">Review Order</h2>
                  <p className="text-muted">Please review your order before placing it</p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-paper rounded-lg border border-line">
                    <h3 className="u-label mb-3">Delivery Address</h3>
                    {selectedAddress ? (
                      <address className="text-sm text-muted not-italic">
                        {selectedAddress.name}<br />
                        {selectedAddress.line1}{selectedAddress.line2 ? `, ${selectedAddress.line2}` : ''}<br />
                        {selectedAddress.city}, {selectedAddress.state} {selectedAddress.pincode}<br />
                        {selectedAddress.phone}
                      </address>
                    ) : (
                      <p className="text-muted">No address selected</p>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setStep('address')} className="mt-2">
                      <ChevronRight className="w-3 h-3 rotate-180" />
                      Change
                    </Button>
                  </div>

                  <div className="p-4 bg-paper rounded-lg border border-line">
                    <h3 className="u-label mb-3">Payment Method</h3>
                    <p className="text-sm text-muted capitalize">{paymentMethod}</p>
                    <Button variant="ghost" size="sm" onClick={() => setStep('payment')} className="mt-2">
                      <ChevronRight className="w-3 h-3 rotate-180" />
                      Change
                    </Button>
                  </div>

                  <div className="p-4 bg-paper rounded-lg border border-line">
                    <h3 className="u-label mb-3">Order Items</h3>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {cart.lines.map((item) => (
                        <div key={item.key} className="flex gap-3">
                          <div className="w-16 h-20 flex-shrink-0 rounded overflow-hidden bg-paper-2">
                            {item.imageUrl ? (
                              <SmartImage src={item.imageUrl} alt="" fill className="object-cover" sizes="64px" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-ink truncate">{item.productName}</p>
                            <p className="text-xs text-muted">{item.size} • {item.color} • Qty: {item.qty}</p>
                          </div>
                          <span className="font-medium text-sm text-ink">{formatCurrency(item.lineTotal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep('payment')} className="flex-1">
                    <ChevronRight className="w-4 h-4 rotate-180" />
                    Back
                  </Button>
                  <Button onClick={placeOrder} disabled={processing || !canProceed} className="flex-1 justify-center gap-2">
                    {processing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Place Order
                        <Lock className="w-5 h-5" />
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-xs text-muted text-center">
                  By placing this order, you agree to our <Link href="/terms" className="underline">Terms of Service</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.
                </p>
              </div>
            )}
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

                <div className="mt-6 p-4 bg-ink/5 rounded-lg border border-ink/10">
                  <div className="flex items-start gap-2 text-sm text-muted">
                    <Lock className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <p>Secure checkout. Your payment information is encrypted and never stored on our servers.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}