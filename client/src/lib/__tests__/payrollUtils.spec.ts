import { describe, it, expect } from 'vitest';
import {
  calculateHoursFromTimecard,
  parseTime,
  calculateMileage,
  calculateGrossPay,
  formatCurrency,
} from '../payrollUtils';

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
});
