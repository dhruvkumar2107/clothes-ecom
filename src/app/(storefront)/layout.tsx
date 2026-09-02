import { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BottomNav } from '@/components/layout/BottomNav';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { SearchOverlay } from '@/components/search/SearchOverlay';
import { MobileNavDrawer } from '@/components/layout/MobileNavDrawer';
import { Truck, Shield, RotateCcw, Heart } from 'lucide-react';

export const metadata: Metadata = {
  title: 'LUMEN&CO — Light as couture',
  description: 'Future-facing luxury fashion. Engineered fabrics, sculptural silhouettes, and limited drops — shipped across India.',
};

function TrustBar() {
  return (
    <div className="bg-ink text-paper text-center py-1.5 px-4 text-[11px] tracking-wide font-medium uppercase">
      <span className="hidden sm:inline">
        Free shipping on orders above ₹2,999 &middot; 14-day easy returns &middot; Secure payments
      </span>
      <span className="sm:hidden">
        Free shipping above ₹2,999 &middot; Easy returns
      </span>
    </div>
  );
}

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <TrustBar />
      <Header />
      <main id="main-content" className="flex-1 pt-0 pb-14 md:pb-0" role="main">
        {children}
      </main>
      <Footer />
      <BottomNav />
      <CartDrawer />
      <SearchOverlay />
      <MobileNavDrawer />
    </div>
  );
}