import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, ChevronRight, Package, Truck, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Order Confirmed',
  description: 'Your order has been placed successfully',
};

interface SuccessPageProps {
  searchParams: Promise<{ order?: string }>;
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const { order } = await searchParams;

  if (!order) {
    return (
      <div className="py-16 md:py-24 min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-accent mx-auto mb-4" />
          <h1 className="u-display text-3xl mb-2">Order Confirmed!</h1>
          <p className="text-muted">Thank you for your purchase. Your order details have been sent to your email.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-16 md:py-24 min-h-[60vh]">
      <div className="u-container">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-accent/10 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-accent" />
          </div>
          <h1 className="u-display text-3xl md:text-4xl mb-2">Order Confirmed!</h1>
          <p className="text-muted mb-8">Thank you for your purchase. We've sent the order details to your email.</p>

          <div className="bg-paper rounded-lg border border-line p-6 mb-8 text-left">
            <div className="flex items-center gap-3 mb-4">
              <span className="u-label">Order Number</span>
              <span className="font-mono font-medium text-lg text-ink">{order}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="u-label">Status</span>
              <span className="px-3 py-1 bg-success/10 text-success text-sm rounded-full font-medium">Confirmed</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <div className="p-4 bg-paper rounded-lg border border-line text-center">
              <Package className="w-6 h-6 text-accent mx-auto mb-2" />
              <p className="u-label mb-1">Order Placed</p>
              <p className="text-sm text-muted">We've received your order</p>
            </div>
            <div className="p-4 bg-paper rounded-lg border border-line text-center">
              <Truck className="w-6 h-6 text-accent mx-auto mb-2" />
              <p className="u-label mb-1">Ships Soon</p>
              <p className="text-sm text-muted">We'll notify you when it ships</p>
            </div>
            <div className="p-4 bg-paper rounded-lg border border-line text-center">
              <Mail className="w-6 h-6 text-accent mx-auto mb-2" />
              <p className="u-label mb-1">Email Confirmation</p>
              <p className="text-sm text-muted">Check your inbox for details</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/account/orders/${order}`}>
              <Button className="w-full sm:w-auto gap-2">
                View Order Details
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/products">
              <Button variant="outline" className="w-full sm:w-auto">
                Continue Shopping
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}