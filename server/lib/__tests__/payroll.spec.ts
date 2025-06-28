import { describe, it, expect } from 'vitest'
import { calculateWeeklyOvertime, isHolidayEligible } from '../payroll'

const baseEntry = {
  id: 1,
  employeeId: 1,
  timeIn: new Date('2024-06-01T08:00:00Z').toISOString(),
  timeOut: new Date('2024-06-01T16:00:00Z').toISOString(),
  lunchMinutes: 30,
  notes: null as any,
}

describe('calculateWeeklyOvertime', () => {
  it('computes no overtime for 40 hours', () => {
    const entries = Array.from({ length: 5 }).map((_, i) => ({
      ...baseEntry,
      id: i,
      timeIn: new Date(`2024-06-${i+1}T08:00:00Z`).toISOString(),
      timeOut: new Date(`2024-06-${i+1}T16:30:00Z`).toISOString(),
    }))
    const result = calculateWeeklyOvertime(entries as any, '2024-06-01')
    expect(result.regularHours).toBeCloseTo(40)
    expect(result.overtimeHours).toBe(0)
  })

  it('computes overtime when weekly hours exceed 40', () => {
    const entries = Array.from({ length: 6 }).map((_, i) => ({
      ...baseEntry,
      id: i,
      timeIn: new Date(`2024-06-${i+1}T08:00:00Z`).toISOString(),
      timeOut: new Date(`2024-06-${i+1}T17:00:00Z`).toISOString(),
    }))
    const result = calculateWeeklyOvertime(entries as any, '2024-06-01')
    expect(result.regularHours).toBeCloseTo(40)
    expect(result.overtimeHours).toBeCloseTo(4)
  })
})

describe('isHolidayEligible', () => {
  it('returns true when hire date is more than 90 days before holiday', () => {
    const hire = '2024-01-01'
    const holiday = '2024-04-05'
    expect(isHolidayEligible(hire, holiday)).toBe(true)
  })
  it('returns false when hire date less than 90 days', () => {
    const hire = '2024-01-01'
    const holiday = '2024-03-01'
    expect(isHolidayEligible(hire, holiday)).toBe(false)
  })
})
