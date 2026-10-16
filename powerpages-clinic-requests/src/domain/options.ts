import type { RequestStatus, TimeWindow } from './types';

export interface TimeWindowOption {
  value: TimeWindow;
  label: string;
  hours: string;
}

export const TIME_WINDOWS: readonly TimeWindowOption[] = [
  { value: 'morning', label: 'Morning', hours: '08:00 to 12:00' },
  { value: 'afternoon', label: 'Afternoon', hours: '12:00 to 16:00' },
  { value: 'late-afternoon', label: 'Late afternoon', hours: '16:00 to 18:00' },
];

export const isTimeWindow = (value: string): value is TimeWindow =>
  TIME_WINDOWS.some((option) => option.value === value);

export const timeWindowLabel = (value: TimeWindow | null): string => {
  const option = TIME_WINDOWS.find((item) => item.value === value);
  return option ? `${option.label} (${option.hours})` : 'Any time';
};

export const STATUS_DESCRIPTIONS: Record<RequestStatus | 'Unknown', string> = {
  New: 'We have your request and will call you within one working day.',
  Confirmed: 'Your appointment is booked. We will send a reminder the day before.',
  Declined: 'We could not offer this time. We will call you to suggest another slot.',
  Unknown: 'Please call the clinic for an update on this request.',
};
