import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variantStyles = {
      primary: 'bg-[#0248FF] text-white hover:bg-[#0238CC] active:bg-[#0228AA]',
      secondary: 'bg-[#5287FF] text-white hover:bg-[#4277EE] active:bg-[#3267DD]',
      outline: 'border-2 border-[#0248FF] text-[#0248FF] hover:bg-[#0248FF] hover:text-white',
      ghost: 'text-[#0248FF] hover:bg-[#0248FF]/10',
    }

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    }

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-[#0248FF] focus:ring-offset-2',
          'disabled:opacity-50 disabled:pointer-events-none',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        style={{ fontFamily: 'Roboto, Noto Sans KR, sans-serif' }}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'
