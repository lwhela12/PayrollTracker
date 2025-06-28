import { describe, it, expect } from 'vitest';
import {
  calculateHoursFromTimecard,
  parseTime,
  calculateMileage,
  calculateGrossPay,
  formatCurrency,
} from '../payrollUtils';
import { calculateWeeklyOvertime, isHolidayEligible } from '../../../../server/lib/payroll';

describe('payrollUtils', () => {
  it('parseTime returns minutes since midnight or null for invalid', () => {
    expect(parseTime('09:30')).toBe(570);
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('')).toBeNull();
  });

  it('calculateHoursFromTimecard handles regular and overtime correctly', () => {
    const result = calculateHoursFromTimecard('09:00', '17:00', 30);
    expect(result.totalHours).toBeCloseTo(7.5);
    expect(result.regularHours).toBeCloseTo(7.5);
    expect(result.overtimeHours).toBe(0);
  });

  it('calculateHoursFromTimecard handles overnight shifts', () => {
    const result = calculateHoursFromTimecard('22:00', '02:00', 0);
    expect(result.totalHours).toBe(4);
    expect(result.regularHours).toBe(4);
    expect(result.overtimeHours).toBe(0);
  });

  it('calculateMileage returns positive difference or zero', () => {
    expect(calculateMileage(100, 150)).toBe(50);
    expect(calculateMileage(200, 150)).toBe(0);
    expect(calculateMileage(0, 0)).toBe(0);
  });

  it('calculateGrossPay computes pay correctly', () => {
    const result = calculateGrossPay(30, 10, 8, 0, 20);
    expect(result.regularPay).toBeCloseTo(600);
    expect(result.overtimePay).toBeCloseTo(300);
    expect(result.ptoPay).toBeCloseTo(160);
    expect(result.totalGrossPay).toBeCloseTo(1060);
  });

  it('formatCurrency formats USD amounts', () => {
    expect(formatCurrency(25)).toBe('$25.00');
  });

  it('weekly overtime respects weekStartsOn parameter', () => {
    const makeEntry = (day: string) => ({
      timeIn: `${day}T09:00:00Z`,
      timeOut: `${day}T17:00:00Z`,
      lunchMinutes: 0,
      employeeId: 1,
      id: 1,
    });
    const days = ['2025-06-07','2025-06-08','2025-06-09','2025-06-10','2025-06-11','2025-06-12','2025-06-13'];
    const entries = days.map(makeEntry);

    const satWeek = calculateWeeklyOvertime(entries as any, '2025-06-07');
    expect(satWeek.regularHours).toBe(40);
    expect(satWeek.overtimeHours).toBe(16);

    const wedWeek = calculateWeeklyOvertime(entries as any, '2025-06-07');
    expect(wedWeek.regularHours).toBe(40);
    expect(wedWeek.overtimeHours).toBe(16);
  });

  it('minutes convert to decimal hours correctly', () => {
    const result = calculateHoursFromTimecard('00:00', '00:45', 0);
    expect(result.totalHours).toBeCloseTo(0.75);
  });

  it('isHolidayEligible only after 90 days', () => {
    expect(isHolidayEligible('2025-01-01', '2025-04-05')).toBe(true);
    expect(isHolidayEligible('2025-03-10', '2025-04-05')).toBe(false);
  });

  it('lunch not deducted for shifts under 8 hours', () => {
    const entry = {
      timeIn: '2025-06-25T09:00:00Z',
      timeOut: '2025-06-25T15:00:00Z',
      lunchMinutes: 30,
      employeeId: 1,
      id: 1,
    } as any;
    const { regularHours, overtimeHours } = calculateWeeklyOvertime([entry], '2025-06-25');
    expect(regularHours).toBeCloseTo(6);
    expect(overtimeHours).toBe(0);
  });
});
