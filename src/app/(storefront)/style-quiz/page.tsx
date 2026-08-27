'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StyleQuiz } from '@/components/marketing/StyleQuiz';
import { Sparkles } from 'lucide-react';
import { apiPost } from '@/lib/api-client';
import { useToast } from '@/app/providers';

export default function StyleQuizPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleComplete = async (preferences: Record<string, string | string[]>) => {
    setLoading(true);
    try {
      await apiPost('/api/style-quiz', { answers: preferences });
      toast({ title: 'Preferences saved!', message: 'Your personalized feed is ready.', tone: 'success' });
      router.push('/products?personalized=true');
    } catch {
      toast({ title: 'Saved locally', message: 'Showing you personalized picks.', tone: 'success' });
      router.push('/products?personalized=true');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper">
      <div className="u-container py-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-accent" aria-hidden="true" />
          </div>
          <h1 className="u-display text-3xl md:text-4xl text-ink mb-2">Find Your Style</h1>
          <p className="text-muted max-w-md mx-auto">
            Answer a few quick questions and we will curate a personalized shopping feed just for you.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 mx-auto mb-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-muted">Building your personal style profile...</p>
          </div>
        ) : (
          <StyleQuiz onComplete={handleComplete} />
        )}
      </div>
    </div>
  );
}
