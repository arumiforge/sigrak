import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from '~/lib/utils'

/**
 * shadcn/ui button restyled to the SIGRAK tokens (design system,
 * Components → Actions): primary, secondary (outline), text (ghost and
 * link) and destructive. Every size keeps a 44 px touch target on
 * phones; `sm` shrinks to 36 px only from the md breakpoint up.
 */
const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-semibold whitespace-nowrap',
    'transition-colors duration-150 outline-none select-none',
    'focus-visible:ring-[3px] focus-visible:ring-brand/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
    'disabled:pointer-events-none disabled:opacity-55',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-brand text-on-brand hover:bg-brand-strong active:bg-brand-strong',
        destructive: 'bg-danger text-on-danger hover:bg-danger/90',
        outline:
          'border border-line-strong/60 bg-surface text-text hover:border-brand hover:bg-brand-tint hover:text-brand-strong',
        secondary: 'bg-brand-tint text-brand-strong hover:bg-brand-tint/70',
        ghost: 'text-text hover:bg-surface-hover',
        link: 'h-auto px-0 text-brand-strong underline-offset-4 hover:underline',
      },
      size: {
        'default': 'h-11 px-4 has-[>svg]:px-3.5',
        'sm': 'h-11 px-3 has-[>svg]:px-2.5 md:h-9',
        'lg': 'h-12 px-6 text-base has-[>svg]:px-5',
        'icon': 'size-11',
        'icon-sm': 'size-11 md:size-9',
        // shadcn names kept for blocks that use them; still 44 px on phones.
        'xs': 'h-11 px-2.5 text-xs md:h-8',
        'icon-xs': 'size-11 md:size-8',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
