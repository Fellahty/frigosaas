import { Timestamp } from 'firebase/firestore';

/**
 * Safely converts a Firestore Timestamp to a Date object
 * @param timestamp - Firestore Timestamp, null, or undefined
 * @returns Date object or undefined if timestamp is invalid
 */
export const safeToDate = (timestamp: Timestamp | null | undefined): Date | undefined => {
  if (!timestamp || typeof timestamp.toDate !== 'function') {
    return undefined;
  }
  return timestamp.toDate();
};

/**
 * Safely formats a Firestore Timestamp to a localized date string
 * @param timestamp - Firestore Timestamp, null, or undefined
 * @param locale - Locale string (default: 'fr-FR')
 * @param options - Intl.DateTimeFormatOptions (default: French date format)
 * @returns Formatted date string or '-' if timestamp is invalid
 */
export const formatTimestamp = (
  timestamp: Timestamp | null | undefined,
  locale: string = 'fr-FR',
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  }
): string => {
  const date = safeToDate(timestamp);
  if (!date) {
    return '-';
  }
  return date.toLocaleDateString(locale, options);
};

/**
 * Safely formats a Firestore Timestamp to a localized date and time string
 * @param timestamp - Firestore Timestamp, null, or undefined
 * @param locale - Locale string (default: 'fr-FR')
 * @param options - Intl.DateTimeFormatOptions (default: French date and time format)
 * @returns Formatted date and time string or '-' if timestamp is invalid
 */
export const formatTimestampWithTime = (
  timestamp: Timestamp | null | undefined,
  locale: string = 'fr-FR',
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }
): string => {
  const date = safeToDate(timestamp);
  if (!date) {
    return '-';
  }
  return date.toLocaleDateString(locale, options);
};
