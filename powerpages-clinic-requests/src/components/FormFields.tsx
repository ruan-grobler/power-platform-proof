import type { ChangeEvent, HTMLAttributes, ReactElement, ReactNode } from 'react';

/** Joins the ids of the hint and error so screen readers read both after the label. */
export const describedBy = (id: string, hasHint: boolean, hasError: boolean): string | undefined => {
  const ids = [hasHint ? `${id}-hint` : '', hasError ? `${id}-error` : ''].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
};

export const FieldError = ({ id, message }: { id: string; message?: string }): ReactElement | null =>
  message ? (
    <p id={`${id}-error`} className="field__error">
      <span className="visually-hidden">Error: </span>
      {message}
    </p>
  ) : null;

interface BaseFieldProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}

interface TextFieldProps extends BaseFieldProps {
  type?: 'text' | 'email' | 'tel' | 'date';
  autoComplete?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  min?: string;
  max?: string;
  maxLength?: number;
  width?: 'full' | 'medium' | 'short';
}

export const TextField = ({
  id,
  label,
  hint,
  error,
  value,
  required = true,
  onChange,
  onBlur,
  type = 'text',
  autoComplete,
  inputMode,
  min,
  max,
  maxLength,
  width = 'full',
}: TextFieldProps): ReactElement => (
  <div className={`field${error ? ' field--error' : ''}`}>
    <label className="field__label" htmlFor={id}>
      {label}
    </label>
    {hint ? (
      <p id={`${id}-hint`} className="field__hint">
        {hint}
      </p>
    ) : null}
    <FieldError id={id} message={error} />
    <input
      id={id}
      name={id}
      className={`input input--${width}`}
      type={type}
      value={value}
      required={required}
      autoComplete={autoComplete}
      inputMode={inputMode}
      min={min}
      max={max}
      maxLength={maxLength}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, Boolean(hint), Boolean(error))}
      onChange={(event: ChangeEvent<HTMLInputElement>): void => onChange(event.target.value)}
      onBlur={onBlur}
    />
  </div>
);

interface TextAreaFieldProps extends BaseFieldProps {
  maxLength: number;
  rows?: number;
}

export const TextAreaField = ({
  id,
  label,
  hint,
  error,
  value,
  required = true,
  onChange,
  onBlur,
  maxLength,
  rows = 4,
}: TextAreaFieldProps): ReactElement => {
  const remaining = maxLength - value.length;
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="field__hint">
          {hint}
        </p>
      ) : null}
      <FieldError id={id} message={error} />
      <textarea
        id={id}
        name={id}
        className="input input--full textarea"
        rows={rows}
        value={value}
        required={required}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, Boolean(hint), Boolean(error))}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>): void => onChange(event.target.value)}
        onBlur={onBlur}
      />
      <p className={`field__counter${remaining < 50 ? ' field__counter--low' : ''}`} aria-hidden="true">
        {remaining} characters left
      </p>
    </div>
  );
};
