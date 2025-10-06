import { describe, it, expect, beforeEach } from 'vitest';

// Mock the TimeEntry type for testing
interface TimeEntry {
  timeIn: string;
  timeOut: string | null;
  lunchMinutes: number | null;
}

// Replicate the server-side calculation logic for testing
function hoursFromEntry(entry: TimeEntry): number {
  if (!entry.timeOut) return 0;
  const start = new Date(entry.timeIn);
  const end = new Date(entry.timeOut);
  let minutes = (end.getTime() - start.getTime()) / 60000;
  if (minutes < 0) {
    minutes += 24 * 60;
  }
  if (entry.lunchMinutes && minutes / 60 >= 8) {
    minutes -= entry.lunchMinutes;
  }
  if (minutes < 0) minutes = 0;
  return Math.round((minutes / 60) * 100) / 100;
}

describe('Server-side Hour Calculations', () => {
  describe('Backend hoursFromEntry function', () => {
    it('should calculate 0.50 hours for 30-minute entry', () => {
      const entry: TimeEntry = {
        timeIn: '2025-01-15T09:00:00',
        timeOut: '2025-01-15T09:30:00',
        lunchMinutes: 0
      };
      const hours = hoursFromEntry(entry);
      expect(hours).toBe(0.5);
      expect(hours.toFixed(2)).toBe('0.50');
      expect(hours).not.toBe(0.3);
    });

    it('should calculate 7.50 hours for 8-hour day with 30 min lunch', () => {
      const entry: TimeEntry = {
        timeIn: '2025-01-15T09:00:00',
        timeOut: '2025-01-15T17:00:00',
        lunchMinutes: 30
      };
      const hours = hoursFromEntry(entry);
      expect(hours).toBe(7.5);
      expect(hours.toFixed(2)).toBe('7.50');
    });

    it('should handle various 30-minute periods throughout the day', () => {
      const testCases = [
        { start: '08:00', end: '08:30' },
        { start: '10:00', end: '10:30' },
        { start: '14:00', end: '14:30' },
        { start: '18:00', end: '18:30' },
        { start: '23:30', end: '00:00' } // Overnight
      ];

      testCases.forEach(({ start, end }) => {
        const [startHour, startMin] = start.split(':');
        const [endHour, endMin] = end.split(':');
        
        const startDate = new Date('2025-01-15');
        startDate.setHours(parseInt(startHour), parseInt(startMin), 0, 0);
        
        const endDate = new Date('2025-01-15');
        endDate.setHours(parseInt(endHour), parseInt(endMin), 0, 0);
        
        // Handle overnight
        if (endDate < startDate) {
          endDate.setDate(endDate.getDate() + 1);
        }

        const entry: TimeEntry = {
          timeIn: startDate.toISOString(),
          timeOut: endDate.toISOString(),
          lunchMinutes: 0
        };

        const hours = hoursFromEntry(entry);
        expect(hours).toBe(0.5);
        expect(hours.toFixed(2)).toBe('0.50');
      });
    });
  });

  describe('Decimal precision in calculations', () => {
    it('minutes / 60 should produce correct decimals', () => {
      const minutes = 30;
      const hours = minutes / 60;
      expect(hours).toBe(0.5);
      expect(hours).not.toBe(0.3);
      expect(hours.toString()).toBe('0.5');
    });

    it('rounding should preserve .5 values', () => {
      const rawHours = 30 / 60;
      const rounded = Math.round(rawHours * 100) / 100;
      expect(rounded).toBe(0.5);
      expect(rounded.toFixed(2)).toBe('0.50');
    });

    it('should handle precision across multiple operations', () => {
      const totalMinutes = 480; // 8 hours
      const lunchMinutes = 30;
      const workMinutes = totalMinutes - lunchMinutes; // 450 minutes
      const hours = workMinutes / 60; // 7.5 hours
      
      expect(hours).toBe(7.5);
      expect(hours % 1).toBe(0.5); // Decimal part should be .5
      expect(hours % 1).not.toBe(0.3);
    });
  });

  describe('Report formatting scenarios', () => {
    it('toFixed(2) should format .5 as .50', () => {
      const hours = 7.5;
      expect(hours.toFixed(2)).toBe('7.50');
      expect(hours.toFixed(2)).not.toBe('7.30');
    });

    it('toFixed(1) should keep .5', () => {
      const hours = 7.5;
      expect(hours.toFixed(1)).toBe('7.5');
      expect(hours.toFixed(1)).not.toBe('7.3');
    });

    it('Number parsing should maintain precision', () => {
      const formatted = '7.50';
      const parsed = Number(formatted);
      expect(parsed).toBe(7.5);
      expect(parsed).not.toBe(7.3);
    });
  });

  describe('Common report values', () => {
    const testValues = [
      { minutes: 30, expected: 0.5, description: 'Half hour' },
      { minutes: 90, expected: 1.5, description: 'Hour and a half' },
      { minutes: 150, expected: 2.5, description: 'Two and a half hours' },
      { minutes: 270, expected: 4.5, description: 'Four and a half hours' },
      { minutes: 450, expected: 7.5, description: 'Seven and a half hours' },
      { minutes: 510, expected: 8.5, description: 'Eight and a half hours' },
    ];

    testValues.forEach(({ minutes, expected, description }) => {
      it(`${description} (${minutes} min) should equal ${expected} hours`, () => {
        const hours = Math.round((minutes / 60) * 100) / 100;
        expect(hours).toBe(expected);
        expect(hours.toFixed(2)).toContain('.50');
        expect(hours.toFixed(2)).not.toContain('.30');
      });
    });
  });
});
