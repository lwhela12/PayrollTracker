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

export function calculateWeeklyOvertime(entries: TimeEntry[], weekStartsOn: number) {
  const buckets = new Map<string, number>()
  for (const e of entries) {
    const week = startOfWeek(new Date(e.timeIn), { weekStartsOn })
    const key = week.toISOString()
    const hours = hoursFromEntry(e)
    buckets.set(key, (buckets.get(key) || 0) + hours)
  }
  let regularHours = 0
  let overtimeHours = 0
  for (const hours of buckets.values()) {
    regularHours += Math.min(hours, 40)
    overtimeHours += Math.max(0, hours - 40)
  }
  return { regularHours, overtimeHours }
}

export function isHolidayEligible(hireDate: string | Date, holidayDate: string | Date): boolean {
  const hire = typeof hireDate === 'string' ? new Date(hireDate) : hireDate
  const holiday = typeof holidayDate === 'string' ? new Date(holidayDate) : holidayDate
  const diff = differenceInMinutes(holiday, hire)
  return diff >= 90 * 24 * 60
}
