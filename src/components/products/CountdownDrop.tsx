'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Bell, Check, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { apiPost } from '@/lib/api-client';
import { useToast } from '@/app/providers';

interface CountdownDropProps {
  id: string;
  name: string;
  tagline?: string;
  heroImage: string;
  launchAt: string;
  slug: string;
  totalProducts?: number;
  waitlistCount?: number;
}

function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculate = () => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}

export function CountdownDrop({
  id,
  name,
  tagline,
  heroImage,
  launchAt,
  slug,
  totalProducts = 0,
  waitlistCount = 0,
}: CountdownDropProps) {
  const { toast } = useToast();
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isLaunched, setIsLaunched] = useState(false);

  const timeLeft = useCountdown(launchAt);

  useEffect(() => {
    const now = new Date().getTime();
    const target = new Date(launchAt).getTime();
    setIsLaunched(target <= now);
  }, [launchAt]);

  const handleJoinWaitlist = useCallback(async () => {
    if (joined || loading) return;
    setLoading(true);
    try {
      await apiPost('/api/waitlist', { dropId: id });
      setJoined(true);
      toast({ title: "You're on the list!", message: "We'll notify you when this drop goes live.", tone: 'success' });
    } catch {
      toast({ title: 'Error', message: 'Failed to join waitlist. Please try again.', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [id, joined, loading, toast]);

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-xl bg-ink text-paper"
    >
      {/* Background image */}
      <div className="absolute inset-0">
        <Image
          src={heroImage}
          alt=""
          fill
          className="object-cover opacity-40"
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/40" />
      </div>

      <div className="relative p-8 md:p-12">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-accent" aria-hidden="true" />
          <span className="u-label text-accent">Limited Drop</span>
        </div>

        <h3 className="u-display text-3xl md:text-4xl mb-2">{name}</h3>
        {tagline && <p className="text-paper/60 text-lg mb-6">{tagline}</p>}

        {!isLaunched ? (
          <>
            {/* Countdown */}
            <div className="flex gap-4 mb-8" role="timer" aria-label="Countdown to launch">
              {[
                { value: timeLeft.days, label: 'Days' },
                { value: timeLeft.hours, label: 'Hours' },
                { value: timeLeft.minutes, label: 'Mins' },
                { value: timeLeft.seconds, label: 'Secs' },
              ].map((unit) => (
                <div key={unit.label} className="text-center">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg bg-paper/10 border border-paper/20 flex items-center justify-center mb-2">
                    <span className="text-2xl md:text-3xl font-mono font-bold text-paper">
                      {pad(unit.value)}
                    </span>
                  </div>
                  <span className="text-[10px] text-paper/50 uppercase tracking-wider">{unit.label}</span>
                </div>
              ))}
            </div>

            {/* Waitlist */}
            <div className="flex flex-wrap items-center gap-4">
              <Button
                onClick={handleJoinWaitlist}
                disabled={joined || loading}
                className={`gap-2 ${joined ? 'bg-success text-paper' : ''}`}
              >
                {joined ? (
                  <>
                    <Check className="w-4 h-4" aria-hidden="true" />
                    On the waitlist
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4" aria-hidden="true" />
                    {loading ? 'Joining...' : 'Join the waitlist'}
                  </>
                )}
              </Button>
              <span className="text-sm text-paper/50">
                {waitlistCount + (joined ? 1 : 0)} people waiting
              </span>
            </div>

            {totalProducts > 0 && (
              <p className="text-xs text-paper/40 mt-4">
                {totalProducts} pieces will be available at launch
              </p>
            )}
          </>
        ) : (
          <div>
            <p className="text-accent text-sm font-medium mb-4">Now live!</p>
            <Link href={`/collections/${slug}`}>
              <Button className="gap-2">
                Shop the drop
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
}
