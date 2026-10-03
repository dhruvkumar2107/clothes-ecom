'use client';

import { useState, useCallback } from 'react';
import { AlertCircle, CheckCircle, Loader2, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/app/providers';

interface SizeRecommendation {
  size: string;
  confidence: number;
  reason: string;
}

interface SizeAssistantProps {
  productId: string;
  initialHeight?: number;
  initialWeight?: number;
  initialFit?: 'slim' | 'regular' | 'oversized' | 'relaxed';
}

export function SizeAssistant({ productId, initialHeight, initialWeight, initialFit }: SizeAssistantProps) {
  const [height, setHeight] = useState<number | null>(initialHeight ?? null);
  const [weight, setWeight] = useState<number | null>(initialWeight ?? null);
  const [fit, setFit] = useState<string | null>(initialFit ?? null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [recommendation, setRecommendation] = useState<SizeRecommendation | null>(null);
  const { toast } = useToast();

  const handleCalculate = useCallback(async () => {
    if (!height || !weight || !fit) {
      toast({ title: 'Incomplete', message: 'Please provide height, weight, and preferred fit', tone: 'warning' });
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      let recommendedSize: string;
      let confidence: number;
      let reason: string;

      const bodyIndex = weight / Math.pow(height / 100, 2);

      if (fit === 'slim') {
        if (bodyIndex < 18.5) {
          recommendedSize = 'XS';
          confidence = 75;
          reason = 'Based on your BMI and slim fit recommendation';
        } else if (bodyIndex < 25) {
          recommendedSize = 'S';
          confidence = 85;
          reason = 'True to size for slim fit';
        } else {
          recommendedSize = 'M';
          confidence = 65;
          reason = 'Consider sizing up for comfort in slim fit';
        }
      } else if (fit === 'oversized') {
        recommendedSize = 'L';
        confidence = 80;
        reason = 'Oversized fit designed for relaxed wear';
      } else if (fit === 'relaxed') {
        if (bodyIndex < 23) {
          recommendedSize = 'M';
          confidence = 70;
          reason = 'Relaxed fit with room for layering';
        } else {
          recommendedSize = 'L';
          confidence = 75;
          reason = 'Relaxed fit accommodates broader build';
        }
      } else {
        if (bodyIndex < 18.5) {
          recommendedSize = 'S';
          confidence = 70;
          reason = 'Slim build, regular fit';
        } else if (bodyIndex < 25) {
          recommendedSize = 'M';
          confidence = 85;
          reason = 'True to size for regular fit';
        } else {
          recommendedSize = 'L';
          confidence = 75;
          reason = 'Fuller build, regular fit';
        }
      }

      setRecommendation({
        size: recommendedSize,
        confidence,
        reason,
      });
      setShowResult(true);
    } catch (error) {
      toast({ title: 'Error', message: 'Failed to calculate size recommendation', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [height, weight, fit, toast]);

  const reset = useCallback(() => {
    setHeight(initialHeight ?? null);
    setWeight(initialWeight ?? null);
    setFit(initialFit ?? null);
    setShowQuiz(false);
    setShowResult(false);
    setRecommendation(null);
  }, [initialHeight, initialWeight, initialFit]);

  return (
    <div className="fixed inset-0 bg-ink/90 backdrop-blur-zxl z-[100] flex flex-col p-6 pointer-events-auto">
      <div className="flex items-between justify-between mb-6 border-b border-line">
        <div>
          <h2 className="u-display text-2xl font-light text-ink">Size Assistant</h2>
          <p className="text-paper/60">Find your perfect fit</p>
        </div>
        <button onClick={() => setShowQuiz(false)} className="text-paper hover:text-ink transition-colors" aria-label="Close">
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {showQuiz && !showResult ? (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-paper mb-2">Height (cm)</label>
            <input
              type="number"
              value={height ?? ''}
              onChange={(e) => setHeight(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 rounded-md bg-paper-2 border border-line text-sm text-ink focus:outline-none focus:ring-2 focus:ring-pair"
              min="140"
              max="220"
              aria-label="Height in cm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-paper mb-2">Weight (kg)</label>
            <input
              type="number"
              value={weight ?? ''}
              onChange={(e) => setWeight(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 rounded-md bg-paper-2 border border-line text-sm text-ink focus:outline-none focus:ring-2 focus:ring-pair"
              min="40"
              max="150"
              aria-label="Weight in kg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-paper mb-2">Preferred Fit</label>
            <div className="grid grid-cols-2 gap-2">
              <label key="slim" className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg border ${
                fit === 'slim' ? 'border-ink ring-1 ring-paper/20' : 'border-line hover:border-ink/40'
              } transition-colors">
                <span className="text-[10px] uppercase font-medium tracking-wider">Slim</span>
                <span className="text-sm">Body-hugging</span>
              </label>
              <label key="regular" className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg border ${
                fit === 'regular' ? 'border-ink ring-1 ring-paper/20' : 'border-line hover:border-ink/40'
              } transition-colors">
                <span className="text-[10px] uppercase font-medium tracking-wider">Regular</span>
                <span className="text-sm">Standard fit</span>
              </label>
              <label key="oversized" className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg border ${
                fit === 'oversized' ? 'border-ink ring-1 ring-paper/20' : 'border-line hover:border-ink/40'
              } transition-colors">
                <span className="text-[10px] uppercase font-medium tracking-wider">Oversized</span>
                <span className="text-sm">Relaxed, roomy</span>
              </label>
              <label key="relaxed" className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg border ${
                fit === 'relaxed' ? 'border-ink ring-1 ring-paper/20' : 'border-line hover:border-ink/40'
              } transition-colors">
                <span className="text-[10px] uppercase font-medium tracking-wider">Relaxed</span>
                <span className="text-sm">Room for layering</span>
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {showQuiz && !showResult && (
        <div className="mt-8 pt-8 border-t border-line">
          <button
            onClick={() => setShowResult(true)}
            className="w-full px-6 py-3 rounded-md bg-ink text-paper text-sm font-medium uppercase tracking-wider hover:bg-paper/3 transition-colors"
          >
            Get My Size Recommendation
          </button>
        </div>
      )}

      {showResult && recommendation ? (
        <div className="space-y-6">
          <div>
            <h3 className="u-display text-xl font-light text-ink mb-2">Recommended Size:</h3>
            <div className="text-6xl font-light text-paper">{recommendation.size}</div>
            <p className="text-sm text-paper/60">Confidence: <span className="font-medium text-accent">{recommendation.confidence}%</span></p>
          </div>
          <div>
            <p className="text-paper/70">{recommendation.reason}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowQuiz(false)}
              className="flex-1 px-4 py-2 rounded-md bg-paper text-ink text-sm font-medium hover:bg-paper/3 transition-colors"
            >
              Adjust Measurements
            </button>
            <button
              onClick={() => setShowQuiz(false)}
              className="flex-1 px-4 py-2 rounded-md border border-ink text-ink text-sm font-medium uppercase tracking-wider hover:bg-paper/3 transition-colors"
            >
              Add to Bag
            </button>
          </div>
          <button onClick={() => setShowQuiz(false)} className="absolute top-4 right-4 text-paper/60 hover:text-ink transition-colors">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {!showResult && showQuiz && loading ? (
        <div className="flex flex-col items-center py-12">
          <Loader2 className="w-12 h-12 text-accent mb-4" />
          <p className="text-paper/60">Calculating your size...</p>
        </div>
      ) : null}
    </div>
  );
}