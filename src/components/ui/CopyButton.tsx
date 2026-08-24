'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { useToast } from './Toast';

export interface CopyButtonProps {
  value: string;
  label?: string;
  successMessage?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md';
}

export const CopyButton = ({ value, label = 'Copy', successMessage = 'Copied to clipboard', className, variant = 'outline', size = 'sm' }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast({ message: successMessage, tone: 'success' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ message: 'Failed to copy', tone: 'danger' });
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      icon={copied ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
      className={className}
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
    >
      {copied ? 'Copied!' : label}
    </Button>
  );
};

CopyButton.displayName = 'CopyButton';