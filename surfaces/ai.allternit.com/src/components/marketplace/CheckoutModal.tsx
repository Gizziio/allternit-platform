'use client';

import React, { useState } from 'react';
import { X, ShoppingCart, Check, Loader2, CreditCard } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CapabilityPricing } from './CapabilityCard';

export interface CheckoutItem {
  id: string;
  name: string;
  author: string;
  pricing: CapabilityPricing;
  amountCents?: number;
  currency?: string;
  icon?: string;
}

export interface CheckoutModalProps {
  item: CheckoutItem;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (item: CheckoutItem) => void;
  isProcessing?: boolean;
  className?: string;
}

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function CheckoutModal({
  item,
  isOpen,
  onClose,
  onConfirm,
  isProcessing,
  className,
}: CheckoutModalProps) {
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  if (!isOpen) return null;

  const isFree = item.pricing === 'free';
  const canConfirm = isFree || acceptedTerms;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative z-10 w-full max-w-md bg-[var(--bg-elevated)] border border-solid border-[var(--border-subtle)] rounded-2xl shadow-2xl',
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-solid border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center">
              <ShoppingCart size={20} weight="duotone" className="text-[var(--accent-primary)]" />
            </div>
            <h2 className="text-[16px] font-bold text-[var(--text-primary)] m-0">
              {isFree ? 'Install Capability' : 'Checkout'}
            </h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0">
            <X size={18} weight="bold" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Item summary */}
          <div className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-xl border border-white/5">
            <div className="size-12 rounded-xl bg-zinc-700 flex items-center justify-center shrink-0">
              {item.icon ? (
                <span className="text-2xl">{item.icon}</span>
              ) : (
                <span className="text-lg font-bold text-zinc-400">
                  {item.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
                {item.name}
              </h3>
              <p className="text-[12px] text-zinc-500">by {item.author}</p>
            </div>
            <div className="text-right shrink-0">
              {isFree ? (
                <Badge variant="secondary" className="text-[11px]">Free</Badge>
              ) : (
                <div className="text-[16px] font-bold text-[var(--text-primary)]">
                  {item.amountCents && item.currency
                    ? formatPrice(item.amountCents, item.currency)
                    : item.pricing}
                </div>
              )}
            </div>
          </div>

          {/* Pricing breakdown for paid items */}
          {!isFree && (
            <div className="space-y-2">
              <div className="flex justify-between text-[13px]">
                <span className="text-zinc-400">Subtotal</span>
                <span className="text-[var(--text-primary)] font-medium">
                  {item.amountCents && item.currency
                    ? formatPrice(item.amountCents, item.currency)
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-zinc-400">Tax</span>
                <span className="text-[var(--text-primary)] font-medium">Calculated at checkout</span>
              </div>
              <div className="h-px bg-[var(--border-subtle)]" />
              <div className="flex justify-between text-[14px] font-bold">
                <span className="text-[var(--text-primary)]">Total</span>
                <span className="text-[var(--text-primary)]">
                  {item.amountCents && item.currency
                    ? formatPrice(item.amountCents, item.currency)
                    : '—'}
                </span>
              </div>
            </div>
          )}

          {/* Terms checkbox for paid */}
          {!isFree && (
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 size-4 accent-[var(--accent-primary)]"
              />
              <span className="text-[12px] text-zinc-400 leading-relaxed">
                I agree to the Allternit Marketplace Terms of Service. Paid capabilities include a 14-day satisfaction guarantee.
              </span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-solid border-[var(--border-subtle)]">
          <Button variant="ghost" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(item)}
            disabled={!canConfirm || isProcessing}
            className="font-bold h-10 px-6 bg-[var(--accent-primary)] hover:brightness-110"
          >
            {isProcessing ? (
              <>
                <Loader2 size={16} weight="bold" className="mr-2 animate-spin" />
                Processing...
              </>
            ) : isFree ? (
              <>
                <Check size={16} weight="bold" className="mr-2" />
                Install
              </>
            ) : (
              <>
                <CreditCard size={16} weight="bold" className="mr-2" />
                Complete Purchase
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
