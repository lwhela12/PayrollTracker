import { format, differenceInDays, isAfter, isBefore, addDays, startOfDay } from "date-fns";

export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'MMM dd, yyyy');
}

export function formatTime(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minutes} ${ampm}`;
}

export function calculateWorkingDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return differenceInDays(end, start) + 1;
}

export function getPayPeriodProgress(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = startOfDay(new Date());
  
  const totalDays = differenceInDays(end, start) + 1;
  
  if (isBefore(today, start)) {
    return {
      percentage: 0,
      completedDays: 0,
      totalDays,
      isComplete: false,
      isActive: false
    };
  }
  
  if (isAfter(today, end)) {
    return {
      percentage: 100,
      completedDays: totalDays,
      totalDays,
      isComplete: true,
      isActive: false
    };
  }
  
  const completedDays = differenceInDays(today, start) + 1;
  const percentage = Math.round((completedDays / totalDays) * 100);
  
  return {
    percentage,
    completedDays,
    totalDays,
    isComplete: false,
    isActive: true
  };
}

export function isCurrentPayPeriod(startDate: string, endDate: string): boolean {
  const today = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  return !isBefore(today, start) && !isAfter(today, end);
}

export function getNextWednesday(date: Date = new Date()): Date {
  const dayOfWeek = date.getDay();
  const daysUntilWednesday = (3 + 7 - dayOfWeek) % 7;
  return addDays(date, daysUntilWednesday === 0 ? 7 : daysUntilWednesday);
}

export function createBiWeeklyPayPeriod(startDate: Date) {
  const endDate = addDays(startDate, 13); // 14 days total (bi-weekly)
  const payDate = addDays(endDate, 7); // Pay date is one week after period ends
  return {
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd'),
    payDate: format(payDate, 'yyyy-MM-dd')
  };
}

export function getDayOfWeek(date: string): string {
  const dateObj = new Date(date);
  return format(dateObj, 'EEEE');
}

export function getShortDayOfWeek(date: string): string {
  const dateObj = new Date(date);
  return format(dateObj, 'EEE');
}
