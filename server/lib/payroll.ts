import { startOfWeek, differenceInMinutes } from 'date-fns'
import type { TimeEntry } from '@shared/schema'

function hoursFromEntry(entry: TimeEntry): number {
  if (!entry.timeOut) return 0
  const start = new Date(entry.timeIn)
  const end = new Date(entry.timeOut)
  let minutes = (end.getTime() - start.getTime()) / 60000
  if (minutes < 0) {
    minutes += 24 * 60
  }
  if (entry.lunchMinutes && minutes / 60 >= 8) {
    minutes -= entry.lunchMinutes
  }
  if (minutes < 0) minutes = 0
  return Math.round((minutes / 60) * 100) / 100
}

export function calculateWeeklyOvertime(entries: TimeEntry[], payPeriodStartDate: string) {
  const buckets = new Map<string, number>()
  const periodStart = new Date(payPeriodStartDate)
  
  for (const e of entries) {
    const entryDate = new Date(e.timeIn)
    
    // Calculate days since pay period start
    const daysSinceStart = Math.floor((entryDate.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000))
    
    // Determine which payroll week (0 = first week, 1 = second week)
    const payrollWeek = Math.floor(daysSinceStart / 7)
    
    // Create week key based on payroll week number
    const weekKey = `week-${payrollWeek}`
    
    const hours = hoursFromEntry(e)
    buckets.set(weekKey, (buckets.get(weekKey) || 0) + hours)
  }
  
  let regularHours = 0
  let overtimeHours = 0
  
  // Calculate overtime for each payroll week separately
  buckets.forEach((hours, weekKey) => {
    regularHours += Math.min(hours, 40)
    overtimeHours += Math.max(0, hours - 40)
  })
  
  return { regularHours, overtimeHours }
}

export function isHolidayEligible(hireDate: string | Date, holidayDate: string | Date): boolean {
  const hire = typeof hireDate === 'string' ? new Date(hireDate) : hireDate
  const holiday = typeof holidayDate === 'string' ? new Date(holidayDate) : holidayDate
  const diff = differenceInMinutes(holiday, hire)
  return diff >= 90 * 24 * 60
}
