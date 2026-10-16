import type { MouseEvent, ReactElement, Ref } from 'react';
import type { FieldName, ValidationErrors } from '../domain/validation';

interface ErrorSummaryProps {
  errors: ValidationErrors;
  order: readonly FieldName[];
  /** Maps a field to the id of the element that should get focus. */
  targetId: (field: FieldName) => string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Lists every problem at the top of the form. It gets focus after a failed
 * submit, and each link moves focus to the field that needs fixing.
 */
export const ErrorSummary = ({ errors, order, targetId, ref }: ErrorSummaryProps): ReactElement | null => {
  const fields = order.filter((field) => errors[field]);
  if (fields.length === 0) {
    return null;
  }

  const focusField = (event: MouseEvent<HTMLAnchorElement>, field: FieldName): void => {
    event.preventDefault();
    const element = document.getElementById(targetId(field));
    if (element) {
      element.focus();
      element.scrollIntoView({ block: 'center' });
    }
  };

  return (
    <div className="error-summary" ref={ref} tabIndex={-1} role="alert" aria-labelledby="error-summary-title">
      <h2 id="error-summary-title" className="error-summary__title">
        {fields.length === 1 ? 'There is a problem with 1 answer' : `There are problems with ${fields.length} answers`}
      </h2>
      <ul className="error-summary__list">
        {fields.map((field) => (
          <li key={field}>
            <a href={`#${targetId(field)}`} onClick={(event): void => focusField(event, field)}>
              {errors[field]}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};
