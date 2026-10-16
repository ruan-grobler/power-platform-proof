import type { RequestStatus, TimeWindow } from '../domain/types';

/**
 * Everything that ties this app to the Dataverse schema lives here.
 * If your publisher prefix is not "cr", or Dataverse generated different
 * choice values, change them in this one file. SETUP.md explains each name.
 */
export const DATAVERSE = {
  /** Table logical name. Used in site settings and table permissions. */
  tableLogicalName: 'cr_appointmentrequest',
  /** EntitySetName. Used in /_api/ URLs. */
  entitySetName: 'cr_appointmentrequests',
  columns: {
    id: 'cr_appointmentrequestid',
    name: 'cr_name',
    phone: 'cr_phone',
    email: 'cr_email',
    preferredDate: 'cr_preferreddate',
    timeWindow: 'cr_timewindow',
    reason: 'cr_reason',
    popiaConsent: 'cr_popiaconsent',
    consentTimestamp: 'cr_consenttimestamp',
    consentVersion: 'cr_consentversion',
    status: 'cr_status',
    /** OData property for reading or filtering the Contact lookup. */
    contactValue: '_cr_contact_value',
    createdOn: 'createdon',
  },
  /** Navigation property used with @odata.bind to set the Contact lookup. Case sensitive. */
  contactNavigationProperty: 'cr_Contact',
  contactEntitySetName: 'contacts',
  /** Choice values for cr_timewindow. */
  timeWindowValues: {
    morning: 100000000,
    afternoon: 100000001,
    'late-afternoon': 100000002,
  } satisfies Record<TimeWindow, number>,
  /** Choice values for cr_status. New must be the column default. */
  statusValues: {
    New: 100000000,
    Confirmed: 100000001,
    Declined: 100000002,
  } satisfies Record<RequestStatus, number>,
} as const;

export const FORMATTED_VALUE_SUFFIX = '@OData.Community.Display.V1.FormattedValue';
