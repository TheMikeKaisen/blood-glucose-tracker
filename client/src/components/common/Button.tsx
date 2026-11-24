import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  className = '',
  ...props
}) => {
  const baseStyles =
    'relative inline-flex items-center justify-center font-medium rounded-xl select-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] px-4 py-2.5 text-sm transition-transform active:scale-[0.98]';

  const variantStyles = {
    primary:
      'bg-teal-700 text-white hover:bg-teal-800 shadow-sm border border-transparent shadow-teal-900/10',
    secondary:
      'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200/60',
    outline:
      'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 shadow-xs',
    ghost:
      'bg-transparent text-slate-600 hover:bg-slate-100/80 border border-transparent',
    danger:
      'bg-rose-600 text-white hover:bg-rose-700 shadow-sm border border-transparent',
  };

  const sizeStyles = {
    sm: 'min-h-[44px] px-3.5 py-2 text-xs',
    md: 'min-h-[44px] px-4 py-2.5 text-sm',
    lg: 'min-h-[50px] px-6 py-3 text-base',
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : icon ? (
        <span className="mr-2 inline-flex items-center">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
};
