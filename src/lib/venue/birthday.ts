function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Whether `today` (the venue's own date) is a day-and-month birthday. A 29
 * February birthday is celebrated on 1 March in other years.
 */
export function isBirthdayToday(month: number | null, day: number | null, today: { year: number; month: number; day: number }): boolean {
  if (!month || !day) return false;
  const [m, d] = month === 2 && day === 29 && !isLeapYear(today.year) ? [3, 1] : [month, day];
  return m === today.month && d === today.day;
}
