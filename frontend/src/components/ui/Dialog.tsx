import React, { useRef } from 'react';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { KEYS } from '@/lib/keyboard-navigation';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useFocusTrap(containerRef, {
    enabled: !!open,
    initialFocus: !!open,
    returnFocusOnDeactivate: true,
    onEscape: () => onOpenChange?.(false),
  });

  if (!open) return null;

  const handleBackdropKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === KEYS.ESCAPE) {
      e.stopPropagation();
      onOpenChange?.(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange?.(false)}
        onKeyDown={handleBackdropKeyDown}
        aria-hidden="true"
      />
      <div
        ref={containerRef}
        className="relative mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-lg"
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props}>
      {children}
    </div>
  );
}

export function DialogTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-lg leading-none font-semibold tracking-tight', className)} {...props}>
      {children}
    </h3>
  );
}

export function DialogContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('text-muted-foreground text-sm', className)} {...props}>
      {children}
    </div>
  );
}

export function DialogDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)} {...props}>
      {children}
    </p>
  );
}

export const DialogTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  return <button ref={ref} className={className} {...props} />;
});
DialogTrigger.displayName = 'DialogTrigger';
