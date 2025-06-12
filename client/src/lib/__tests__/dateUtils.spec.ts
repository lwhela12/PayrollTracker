import { describe, it, expect } from 'vitest';
import {
  formatDate,
  getDayOfWeek,
  createBiWeeklyPayPeriod,
  getPayPeriodProgress,
} from '../dateUtils';

describe('dateUtils', () => {
  it('formatDate formats yyyy-MM-dd or Date correctly', () => {
    expect(formatDate('2025-06-12')).toBe('Jun 12, 2025');
    expect(formatDate(new Date('2025-06-12'))).toBe('Jun 12, 2025');
  });

  it('getDayOfWeek returns correct weekday name', () => {
    expect(getDayOfWeek('2025-06-12')).toBe('Thursday');
    expect(getDayOfWeek('2025-06-15')).toBe('Sunday');
  });

  it('createBiWeeklyPayPeriod generates a 14-day period and correct pay date', () => {
    const start = new Date('2025-06-01');
    const { startDate, endDate, payDate } = createBiWeeklyPayPeriod(start);
    expect(startDate).toBe('2025-06-01');
    expect(endDate).toBe('2025-06-14');
    expect(payDate).toBe('2025-06-21');
  });

  it('getPayPeriodProgress returns 0% before period and 100% after', () => {
    const before = getPayPeriodProgress('2099-01-10', '2099-01-20');
    expect(before.percentage).toBe(0);
    const after = getPayPeriodProgress('2000-01-01', '2000-01-02');
    expect(after.percentage).toBe(100);
  });
});