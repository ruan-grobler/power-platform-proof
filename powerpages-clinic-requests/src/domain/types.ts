export type TimeWindow = 'morning' | 'afternoon' | 'late-afternoon';

export type RequestStatus = 'New' | 'Confirmed' | 'Declined';

/** Raw values as typed into the form. Everything is a string or boolean. */
export interface AppointmentRequestInput {
  fullName: string;
  phone: string;
  email: string;
  preferredDate: string;
  timeWindow: TimeWindow | '';
  reason: string;
  popiaConsent: boolean;
}

/** Cleaned, validated values that are safe to send to Dataverse. */
export interface NormalisedAppointmentRequest {
  fullName: string;
  /** E.164 format, for example +27825550134. */
  phone: string;
  /** Lower case. */
  email: string;
  /** ISO date only, YYYY-MM-DD. */
  preferredDate: string;
  timeWindow: TimeWindow;
  reason: string;
  popiaConsent: true;
}

/** A request as shown on the "My requests" page. */
export interface AppointmentRequest {
  id: string;
  reference: string;
  fullName: string;
  phone: string;
  email: string;
  preferredDate: string;
  timeWindow: TimeWindow | null;
  reason: string;
  status: RequestStatus | 'Unknown';
  /** Label to show when the status value is not one we recognise. */
  statusLabel: string;
  createdOn: string;
}

/** The signed-in Power Pages user (a Dataverse contact). */
export interface PortalUser {
  contactId: string;
  firstName: string;
  lastName: string;
  email: string;
  userName: string;
}
