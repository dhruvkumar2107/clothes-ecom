import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <main className="flex-1 grid place-items-center py-32">
      <div className="u-container text-center">
        <p className="u-label text-ink/50 mb-4">404</p>
        <h1 className="u-display text-4xl md:text-6xl font-light text-ink mb-6">
          Nothing here
        </h1>
        <p className="text-ink/60 max-w-md mx-auto mb-10 leading-relaxed">
          The page you asked for has moved, sold out, or never existed.
        </p>
        <Link href="/">
          <Button size="lg">Back to the shop</Button>
        </Link>
      </div>
    </main>
  );
}
