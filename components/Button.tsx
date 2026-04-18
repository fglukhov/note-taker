import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = {
  variant?: ButtonVariant;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'>;

const baseClass =
  'inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-lg border-0 px-[1.5rem] py-[0.5rem] font-semibold transition-[transform,filter,background-color] duration-100 ease-out disabled:cursor-not-allowed disabled:opacity-60 disabled:transform-none';

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-blue-500 text-white hover:brightness-[0.95]',
  danger: 'bg-rose-500 text-white hover:brightness-[0.95]',
  secondary:
    'border border-solid border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.06)] text-[rgba(0,0,0,0.85)] hover:bg-[rgba(0,0,0,0.08)]',
  ghost:
    'border border-solid border-[rgba(0,0,0,0.14)] bg-transparent text-[rgba(0,0,0,0.85)] hover:bg-[rgba(0,0,0,0.04)]',
};

function cn(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = 'primary', type = 'button', className, children, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(baseClass, variantClass[variant], className)}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
