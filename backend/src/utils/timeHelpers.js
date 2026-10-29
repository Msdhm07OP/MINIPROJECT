import { parse, format, addMinutes, isAfter, isBefore, isEqual } from 'date-fns';

/**
 * Operating hours constants
 */
export const OPERATING_HOURS = {
  START: '08:00',
  END: '22:00'
};

export const BUFFER_MINUTES = 30;

/**
 * Parse time string to Date object for a given date
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {string} timeStr - Time in HH:MM format
 * @returns {Date}
 */
export const parseDateTime = (dateStr, timeStr) => {
  return parse(`${dateStr} ${timeStr}`, 'yyyy-MM-dd HH:mm', new Date());
};

/**
 * Format Date object to time string
 * @param {Date} date
 * @returns {string} Time in HH:MM format
 */
export const formatTime = (date) => {
  return format(date, 'HH:mm');
};

/**
 * Calculate reserved interval with setup and cleanup buffers
 * @param {string} dateStr - Event date
 * @param {string} startTime - Event start time
 * @param {string} endTime - Event end time
 * @returns {object} { reservedStart: string, reservedEnd: string }
 */
export const calculateReservedInterval = (dateStr, startTime, endTime) => {
  const eventStart = parseDateTime(dateStr, startTime);
  const eventEnd = parseDateTime(dateStr, endTime);

  const reservedStart = addMinutes(eventStart, -BUFFER_MINUTES);
  const reservedEnd = addMinutes(eventEnd, BUFFER_MINUTES);

  return {
    reservedStart: formatTime(reservedStart),
    reservedEnd: formatTime(reservedEnd)
  };
};

/**
 * Check if two time intervals overlap using half-open interval rule
 * A.start < B.end AND B.start < A.end
 * @param {string} dateStr - Date for comparison
 * @param {string} start1 - First interval start time
 * @param {string} end1 - First interval end time
 * @param {string} start2 - Second interval start time
 * @param {string} end2 - Second interval end time
 * @returns {boolean}
 */
export const checkIntervalOverlap = (dateStr, start1, end1, start2, end2) => {
  const interval1Start = parseDateTime(dateStr, start1);
  const interval1End = parseDateTime(dateStr, end1);
  const interval2Start = parseDateTime(dateStr, start2);
  const interval2End = parseDateTime(dateStr, end2);

  // Half-open interval overlap: A.start < B.end AND B.start < A.end
  return isBefore(interval1Start, interval2End) && isBefore(interval2Start, interval1End);
};

/**
 * Check if reserved interval falls within operating hours
 * @param {string} reservedStart - Reserved start time
 * @param {string} reservedEnd - Reserved end time
 * @returns {boolean}
 */
export const isWithinOperatingHours = (reservedStart, reservedEnd) => {
  const dummyDate = '2024-01-01'; // Date doesn't matter, just comparing times

  const start = parseDateTime(dummyDate, reservedStart);
  const end = parseDateTime(dummyDate, reservedEnd);
  const opStart = parseDateTime(dummyDate, OPERATING_HOURS.START);
  const opEnd = parseDateTime(dummyDate, OPERATING_HOURS.END);

  // Reserved start must be >= 08:00 AND reserved end must be <= 22:00
  return (isAfter(start, opStart) || isEqual(start, opStart)) &&
         (isBefore(end, opEnd) || isEqual(end, opEnd));
};

/**
 * Validate time string format (HH:MM)
 * @param {string} timeStr
 * @returns {boolean}
 */
export const isValidTimeFormat = (timeStr) => {
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeStr);
};

/**
 * Validate date string format (YYYY-MM-DD)
 * @param {string} dateStr
 * @returns {boolean}
 */
export const isValidDateFormat = (dateStr) => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return false;

  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date);
};

/**
 * Check if start time is before end time
 * @param {string} dateStr
 * @param {string} startTime
 * @param {string} endTime
 * @returns {boolean}
 */
export const isStartBeforeEnd = (dateStr, startTime, endTime) => {
  const start = parseDateTime(dateStr, startTime);
  const end = parseDateTime(dateStr, endTime);
  return isBefore(start, end);
};
