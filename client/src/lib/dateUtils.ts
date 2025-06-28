import { format, differenceInDays, isAfter, isBefore, addDays, startOfDay } from "date-fns";

export function formatDate(date: string | Date): string {
  if (!date) return '';
  
  let dateObj: Date;
  if (typeof date === 'string') {
    // Parse date string as UTC to avoid timezone shifts
    const [year, month, day] = date.split('-').map(Number);
    dateObj = new Date(Date.UTC(year, month - 1, day));
  } else {
    dateObj = date;
  }
  
  if (isNaN(dateObj.getTime())) return '';
  
  // Use custom formatting to avoid timezone issues in date-fns
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const utcMonth = dateObj.getUTCMonth();
  const utcDay = dateObj.getUTCDate();
  const utcYear = dateObj.getUTCFullYear();
  
  return `${monthNames[utcMonth]} ${utcDay.toString().padStart(2, '0')}, ${utcYear}`;
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
  // Parse both dates as UTC to avoid timezone shifts
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const start = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));
  return differenceInDays(end, start) + 1;
}

export function getPayPeriodProgress(startDate: string, endDate: string) {
  // Add null checks to prevent errors with undefined dates
  if (!startDate || !endDate) {
    return {
      percentage: 0,
      completedDays: 0,
      totalDays: 0,
      isComplete: false,
      isActive: false
    };
  }
  
  // Parse dates as UTC to avoid timezone shifts
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const start = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));
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
  // Parse dates as UTC to avoid timezone shifts
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const start = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));
  
  return !isBefore(today, start) && !isAfter(today, end);
}

export function getNextWednesday(date: Date = new Date()): Date {
  // Create a new date in UTC to avoid timezone issues
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayOfWeek = utcDate.getUTCDay();
  const daysUntilWednesday = (3 + 7 - dayOfWeek) % 7;
  const targetDate = new Date(utcDate);
  targetDate.setUTCDate(utcDate.getUTCDate() + (daysUntilWednesday === 0 ? 7 : daysUntilWednesday));
  return targetDate;
}

export function createBiWeeklyPayPeriod(startDate: Date) {
  // Ensure we're working with UTC dates to avoid timezone shifts
  const utcStartDate = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()));
  const endDate = addDays(utcStartDate, 13); // 14 days total (bi-weekly)
  const payDate = addDays(endDate, 7); // Pay date is one week after period ends
  return {
    startDate: format(utcStartDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd'),
    payDate: format(payDate, 'yyyy-MM-dd')
  };
}

export function getDayOfWeek(date: string): string {
  // Parse date string as UTC to avoid timezone shifts
  const [year, month, day] = date.split('-').map(Number);
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  
  // Use custom day calculation to avoid timezone issues in date-fns
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return dayNames[dateObj.getUTCDay()];
}

export function getShortDayOfWeek(date: string): string {
  const dateObj = new Date(date);
  return format(dateObj, 'EEE');
}
