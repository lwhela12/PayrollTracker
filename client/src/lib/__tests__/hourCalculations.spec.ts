import { describe, it, expect } from 'vitest';
import { calculateHoursFromTimecard } from '../payrollUtils';

describe('Hour Calculations - Half Hour Bug Detection', () => {
  describe('Half-hour shifts (30 minutes = 0.5 hours)', () => {
    it('should calculate 0.50 hours for 9:00 AM to 9:30 AM', () => {
      const result = calculateHoursFromTimecard('09:00', '09:30', 0);
      expect(result.totalHours).toBe(0.5);
      expect(result.totalHours).not.toBe(0.3);
      expect(result.totalHours.toFixed(2)).toBe('0.50');
    });

    it('should calculate 0.50 hours for 2:00 PM to 2:30 PM', () => {
      const result = calculateHoursFromTimecard('14:00', '14:30', 0);
      expect(result.totalHours).toBe(0.5);
      expect(result.totalHours.toFixed(2)).toBe('0.50');
    });

    it('should calculate 0.50 hours for 11:30 AM to 12:00 PM', () => {
      const result = calculateHoursFromTimecard('11:30', '12:00', 0);
      expect(result.totalHours).toBe(0.5);
      expect(result.totalHours.toFixed(2)).toBe('0.50');
    });

    it('should calculate 0.50 hours for 5:30 PM to 6:00 PM', () => {
      const result = calculateHoursFromTimecard('17:30', '18:00', 0);
      expect(result.totalHours).toBe(0.5);
      expect(result.totalHours.toFixed(2)).toBe('0.50');
    });
  });

  describe('Full shifts with 30-minute lunch (should end in .50)', () => {
    it('should calculate 7.50 hours for 9:00 AM to 5:00 PM with 30 min lunch', () => {
      const result = calculateHoursFromTimecard('09:00', '17:00', 30);
      expect(result.totalHours).toBe(7.5);
      expect(result.totalHours.toFixed(2)).toBe('7.50');
      expect(result.totalHours).not.toBe(7.3);
    });

    it('should calculate 7.50 hours for 8:00 AM to 4:00 PM with 30 min lunch', () => {
      const result = calculateHoursFromTimecard('08:00', '16:00', 30);
      expect(result.totalHours).toBe(7.5);
      expect(result.totalHours.toFixed(2)).toBe('7.50');
    });

    it('should calculate 8.50 hours for 8:00 AM to 5:00 PM with 30 min lunch', () => {
      const result = calculateHoursFromTimecard('08:00', '17:00', 30);
      expect(result.totalHours).toBe(8.5);
      expect(result.totalHours.toFixed(2)).toBe('8.50');
    });
  });

  describe('Various minute values that should produce .XX hours', () => {
    it('15 minutes should equal 0.25 hours (not 0.15)', () => {
      const result = calculateHoursFromTimecard('09:00', '09:15', 0);
      expect(result.totalHours).toBe(0.25);
      expect(result.totalHours).not.toBe(0.15);
    });

    it('45 minutes should equal 0.75 hours (not 0.45)', () => {
      const result = calculateHoursFromTimecard('09:00', '09:45', 0);
      expect(result.totalHours).toBe(0.75);
      expect(result.totalHours).not.toBe(0.45);
    });

    it('20 minutes should equal 0.33 hours', () => {
      const result = calculateHoursFromTimecard('09:00', '09:20', 0);
      expect(result.totalHours).toBeCloseTo(0.33, 2);
      expect(result.totalHours).not.toBe(0.2);
    });

    it('90 minutes should equal 1.50 hours', () => {
      const result = calculateHoursFromTimecard('09:00', '10:30', 0);
      expect(result.totalHours).toBe(1.5);
      expect(result.totalHours.toFixed(2)).toBe('1.50');
    });
  });

  describe('Overnight shifts', () => {
    it('should handle overnight shift correctly (11:00 PM to 12:30 AM = 1.5 hours)', () => {
      const result = calculateHoursFromTimecard('23:00', '00:30', 0);
      expect(result.totalHours).toBe(1.5);
      expect(result.totalHours.toFixed(2)).toBe('1.50');
    });

    it('should handle overnight shift with 30 min lunch', () => {
      const result = calculateHoursFromTimecard('22:00', '06:00', 30);
      expect(result.totalHours).toBe(7.5);
      expect(result.totalHours.toFixed(2)).toBe('7.50');
    });
  });

  describe('Edge cases and decimal precision', () => {
    it('should not lose precision in calculation chain', () => {
      // Test that multiple operations don't cause rounding errors
      const result = calculateHoursFromTimecard('09:00', '09:30', 0);
      const doubled = result.totalHours * 2;
      expect(doubled).toBe(1.0);
      expect(doubled).not.toBe(0.6); // Would happen if 0.3 was stored
    });

    it('should maintain precision when formatting with toFixed(2)', () => {
      const result = calculateHoursFromTimecard('09:00', '09:30', 0);
      const formatted = Number(result.totalHours.toFixed(2));
      expect(formatted).toBe(0.5);
      expect(result.totalHours.toFixed(2)).toBe('0.50');
      expect(result.totalHours.toFixed(2)).not.toBe('0.30');
    });

    it('should handle very short shifts (1 minute)', () => {
      const result = calculateHoursFromTimecard('09:00', '09:01', 0);
      expect(result.totalHours).toBeCloseTo(0.02, 2);
    });

    it('should handle exact hour boundaries', () => {
      const result = calculateHoursFromTimecard('09:00', '10:00', 0);
      expect(result.totalHours).toBe(1.0);
      expect(result.totalHours.toFixed(2)).toBe('1.00');
    });
  });

  describe('Lunch break edge cases', () => {
    it('should correctly subtract 30 min lunch from 8 hour shift', () => {
      const result = calculateHoursFromTimecard('09:00', '17:00', 30);
      expect(result.totalHours).toBe(7.5);
      expect(result.totalHours.toFixed(1)).toBe('7.5');
      expect(result.totalHours.toFixed(2)).toBe('7.50');
    });

    it('should handle 60 minute lunch correctly', () => {
      const result = calculateHoursFromTimecard('09:00', '18:00', 60);
      expect(result.totalHours).toBe(8.0);
      expect(result.totalHours.toFixed(2)).toBe('8.00');
    });

    it('should handle 45 minute lunch correctly', () => {
      const result = calculateHoursFromTimecard('09:00', '18:00', 45);
      expect(result.totalHours).toBe(8.25);
      expect(result.totalHours.toFixed(2)).toBe('8.25');
    });
  });

  describe('Real-world scenarios from user reports', () => {
    it('Scenario: Standard 9-5 with 30 min lunch', () => {
      const result = calculateHoursFromTimecard('09:00', '17:00', 30);
      expect(result.totalHours).toBe(7.5);
      // This is the critical check - ensure it's .5 not .3
      const decimal = result.totalHours - Math.floor(result.totalHours);
      expect(decimal).toBe(0.5);
      expect(decimal).not.toBe(0.3);
    });

    it('Scenario: Part-time 4.5 hour shift', () => {
      const result = calculateHoursFromTimecard('13:00', '17:30', 0);
      expect(result.totalHours).toBe(4.5);
      expect(result.totalHours.toFixed(2)).toBe('4.50');
    });

    it('Scenario: Split shift with 30 min break', () => {
      // First shift: 6:00 AM - 10:00 AM = 4 hours
      const shift1 = calculateHoursFromTimecard('06:00', '10:00', 0);
      // Second shift: 2:00 PM - 6:30 PM = 4.5 hours
      const shift2 = calculateHoursFromTimecard('14:00', '18:30', 0);
      const total = shift1.totalHours + shift2.totalHours;
      
      expect(total).toBe(8.5);
      expect(total.toFixed(2)).toBe('8.50');
      expect(total).not.toBeCloseTo(8.3, 1);
    });
  });
});
