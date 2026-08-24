'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface DropdownItem {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
  separator?: boolean;
  disabled?: boolean;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export const Dropdown = ({ trigger, items, align = 'right', className }: DropdownProps) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
    if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div className={cn('relative inline-block', className)} onKeyDown={handleKeyDown}>
      <div ref={triggerRef}>{trigger}</div>

      {open && (
        <div
          ref={dropdownRef}
          className={cn(
            'absolute z-[50] mt-1.5 min-w-[180px] bg-paper border border-line rounded-md shadow-lg overflow-hidden animate-rise',
            align === 'right' ? 'right-0' : 'left-0'
          )}
          role="menu"
        >
          {items.map((item, index) => (
            <DropdownItemComponent key={index} item={item} onClose={() => setOpen(false)} />
          ))}
        </div>
      )}
    </div>
  );
};

const DropdownItemComponent = ({ item, onClose }: { item: DropdownItem; onClose: () => void }) => {
  if (item.separator) {
    return <hr className="border-line my-1" aria-hidden="true" />;
  }

  const handleClick = () => {
    if (item.disabled) return;
    item.onClick?.();
    if (!item.href) onClose();
  };

  const content = (
    <div className={cn('flex items-center gap-3 px-3 py-2 text-sm', item.danger && 'text-danger', item.disabled && 'opacity-50 cursor-not-allowed')}>
      {item.icon && <span className="flex-shrink-0" aria-hidden="true">{item.icon}</span>}
      <span className="flex-1">{item.label}</span>
    </div>
  );

  if (item.href) {
    return (
      <a href={item.href} onClick={handleClick} className="block" role="menuitem" tabIndex={-1}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={handleClick} disabled={item.disabled} className="w-full text-left" role="menuitem" tabIndex={-1}>
      {content}
    </button>
  );
};

Dropdown.displayName = 'Dropdown';