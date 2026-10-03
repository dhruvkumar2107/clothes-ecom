import { Suspense } from 'react';
import ProductsClient from './ProductsClient';

export const revalidate = 30;

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh]" />}>
      <ProductsClient />
    </Suspense>
  );
}