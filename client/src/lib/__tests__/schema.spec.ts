import { describe, it, expect } from 'vitest';
import { insertTimecardSchema } from '@shared/schema';

describe('insertTimecardSchema', () => {
  it('validates a correct timecard payload', () => {
    const valid = {
      employeeId: 1,
      payPeriodId: 2,
      workDate: '2025-06-12',
      timeIn: '09:00',
      timeOut: '17:00',
      lunchMinutes: 30,
      regularHours: '8.00',
      overtimeHours: '0.00',
      ptoHours: '0.00',
      holidayHours: '0.00',
      startOdometer: 100,
      endOdometer: 150,
      totalMiles: 50,
      notes: '',
    };
    expect(() => insertTimecardSchema.parse(valid)).not.toThrow();
  });

  it('throws when required fields are missing', () => {
    const invalid = { employeeId: 1 } as any;
    expect(() => insertTimecardSchema.parse(invalid)).toThrow();
  });
});