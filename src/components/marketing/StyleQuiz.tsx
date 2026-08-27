'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Sparkles, Shirt, Palette, MapPin, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface QuizStep {
  id: string;
  question: string;
  subtitle?: string;
  icon: React.ElementType;
  options: { value: string; label: string; emoji?: string; description?: string }[];
  multi?: boolean;
}

const QUIZ_STEPS: QuizStep[] = [
  {
    id: 'occasion',
    question: 'What场合场合 (occasion) are you shopping for?',
    subtitle: 'We will curate picks based on where you will wear it.',
    icon: MapPin,
    options: [
      { value: 'work', label: 'Office & Workwear', emoji: '💼', description: 'Polished, professional looks' },
      { value: 'casual', label: 'Casual & Everyday', emoji: '🌿', description: 'Relaxed, everyday comfort' },
      { value: 'festive', label: 'Festive & Celebrations', emoji: '✨', description: 'Bold, celebratory pieces' },
      { value: 'wedding', label: 'Weddings & Events', emoji: '💒', description: 'Statement formal wear' },
      { value: 'travel', label: 'Travel &度假', emoji: '✈️', description: 'Packable, versatile pieces' },
    ],
  },
  {
    id: 'style',
    question: 'What is your style vibe?',
    subtitle: 'Pick what speaks to you — there are no wrong answers.',
    icon: Shirt,
    options: [
      { value: 'minimal', label: 'Minimal & Clean', emoji: '◻️', description: 'Less is more' },
      { value: 'streetwear', label: 'Streetwear & Urban', emoji: '🏙️', description: 'Bold, urban energy' },
      { value: 'classic', label: 'Classic & Timeless', emoji: '🏛️', description: 'Never goes out of style' },
      { value: 'bohemian', label: 'Bohemian & Free', emoji: '🪶', description: 'Flowy, expressive' },
      { value: 'avant-garde', label: 'Avant-garde', emoji: '🔮', description: 'Pushing boundaries' },
    ],
  },
  {
    id: 'colors',
    question: 'What colors do you gravitate towards?',
    subtitle: 'Select all that resonate with you.',
    icon: Palette,
    multi: true,
    options: [
      { value: 'neutrals', label: 'Neutrals', emoji: '🤍', description: 'Black, white, beige, grey' },
      { value: 'earth-tones', label: 'Earth Tones', emoji: '🪨', description: 'Rust, olive, terracotta' },
      { value: 'pastels', label: 'Pastels', emoji: '🌸', description: 'Soft pinks, blues, greens' },
      { value: 'bold', label: 'Bold & Bright', emoji: '🔥', description: 'Red, cobalt, emerald' },
      { value: 'monochrome', label: 'All Black', emoji: '🖤', description: 'Head-to-toe noir' },
    ],
  },
  {
    id: 'fit',
    question: 'How do you like your clothes to fit?',
    subtitle: 'This helps us recommend the right silhouettes.',
    icon: Shirt,
    options: [
      { value: 'relaxed', label: 'Relaxed & Oversized', emoji: '☁️', description: 'Loose, comfortable' },
      { value: 'regular', label: 'Regular Fit', emoji: '📐', description: 'Not too tight, not too loose' },
      { value: 'slim', label: 'Slim & Tailored', emoji: '✂️', description: 'Clean, fitted lines' },
      { value: 'mixed', label: 'Mix & Match', emoji: '🎲', description: 'Varies by piece' },
    ],
  },
];

interface StyleQuizProps {
  onComplete: (preferences: Record<string, string | string[]>) => void;
}

export function StyleQuiz({ onComplete }: StyleQuizProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [isAnimating, setIsAnimating] = useState(false);

  const step = QUIZ_STEPS[currentStep];
  const isLast = currentStep === QUIZ_STEPS.length - 1;
  const canProceed = step.multi
    ? (answers[step.id] as string[])?.length > 0
    : !!answers[step.id];

  const handleSelect = useCallback(
    (value: string) => {
      if (step.multi) {
        const current = (answers[step.id] as string[]) || [];
        const updated = current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value];
        setAnswers((prev) => ({ ...prev, [step.id]: updated }));
      } else {
        setAnswers((prev) => ({ ...prev, [step.id]: value }));
      }
    },
    [step, answers]
  );

  const handleNext = () => {
    if (isLast) {
      onComplete(answers);
    } else {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
        setIsAnimating(false);
      }, 200);
    }
  };

  const handleBack = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep((prev) => prev - 1);
      setIsAnimating(false);
    }, 200);
  };

  const Icon = step.icon;

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {QUIZ_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                i <= currentStep ? 'bg-accent' : 'bg-line'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-center mb-8">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
                <Icon className="w-6 h-6 text-accent" aria-hidden="true" />
              </div>
              <h2 className="u-display text-2xl md:text-3xl text-ink mb-2">{step.question}</h2>
              {step.subtitle && (
                <p className="text-sm text-muted">{step.subtitle}</p>
              )}
            </div>

            <div className={`grid ${step.options.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'} gap-3`}>
              {step.options.map((option) => {
                const isSelected = step.multi
                  ? ((answers[step.id] as string[]) || []).includes(option.value)
                  : answers[step.id] === option.value;

                return (
                  <motion.button
                    key={option.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelect(option.value)}
                    className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? 'border-accent bg-accent/5 shadow-md'
                        : 'border-line hover:border-ink/30 bg-paper'
                    }`}
                    aria-pressed={isSelected}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                        <Check className="w-3 h-3 text-paper" aria-hidden="true" />
                      </div>
                    )}
                    {option.emoji && (
                      <span className="text-2xl mb-2 block" aria-hidden="true">{option.emoji}</span>
                    )}
                    <h3 className="font-medium text-sm text-ink">{option.label}</h3>
                    {option.description && (
                      <p className="text-xs text-muted mt-1">{option.description}</p>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-10">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className="flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors disabled:opacity-30 u-focus"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            Back
          </button>

          <span className="text-xs text-muted">
            {currentStep + 1} / {QUIZ_STEPS.length}
          </span>

          <Button
            onClick={handleNext}
            disabled={!canProceed || isAnimating}
            className="gap-2"
          >
            {isLast ? (
              <>
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                Get my picks
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
