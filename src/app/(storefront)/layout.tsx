import { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { SearchOverlay } from '@/components/search/SearchOverlay';
import { MobileNavDrawer } from '@/components/layout/MobileNavDrawer';

export const metadata: Metadata = {
  title: 'LUMEN&CO — Light as couture',
  description: 'Future-facing luxury fashion. Engineered fabrics, sculptural silhouettes, and limited drops — shipped across India.',
};

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main-content" className="flex-1" role="main">
        {children}
      </main>
      <Footer />
      <CartDrawer />
      <SearchOverlay />
      <MobileNavDrawer />
    </div>
  );
}