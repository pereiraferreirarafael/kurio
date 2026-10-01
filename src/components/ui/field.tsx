import { type ComponentProps, useId } from 'react'
import { cn } from '@/lib/utils'

type FieldProps = Omit<ComponentProps<'input'>, 'id'> & { label: string; error?: string }

/** Campo com label visível e erro associado por aria-describedby. */
export function TextField({ label, error, className, ...props }: FieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-body font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'h-10 border border-border-strong bg-card px-4 text-body text-foreground placeholder:text-muted-foreground/70',
          error && 'border-destructive',
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-caption text-destructive">
          <span aria-hidden="true">✕ </span>
          {error}
        </p>
      ) : null}
    </div>
  )
}
