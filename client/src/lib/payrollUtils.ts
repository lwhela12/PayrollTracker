export function calculateHoursFromTimecard(timeIn: string, timeOut: string, lunchMinutes: number = 0): {
  totalMinutes: number;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
} {
  if (!timeIn || !timeOut) {
    return { totalMinutes: 0, totalHours: 0, regularHours: 0, overtimeHours: 0 };
  }

  const startTime = parseTime(timeIn);
  const endTime = parseTime(timeOut);
  
  if (startTime === null || endTime === null) {
    return { totalMinutes: 0, totalHours: 0, regularHours: 0, overtimeHours: 0 };
  }

  let totalMinutes = endTime - startTime;
  
  // Handle overnight shifts
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60; // Add 24 hours in minutes
  }
  
  // Subtract lunch break
  totalMinutes -= lunchMinutes;
  
  if (totalMinutes < 0) {
    totalMinutes = 0;
  }

  const totalHours = totalMinutes / 60;
  
  const regularHours = totalHours;
  const overtimeHours = 0;

  return {
    totalMinutes,
    totalHours: Math.round(totalHours * 100) / 100,
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeHours: 0,
  };
}

export function parseTime(timeString: string): number | null {
  if (!timeString) return null;
  
  const [hours, minutes] = timeString.split(':').map(Number);
  
  if (isNaN(hours) || isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  
  return hours * 60 + minutes;
}

export function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function calculateWeeklyHours(timecards: any[]): {
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalHours: number;
  weeklyOvertimeHours: number;
} {
  const regularHours = timecards.reduce((sum, tc) => sum + parseFloat(tc.regularHours || '0'), 0);
  const overtimeHours = timecards.reduce((sum, tc) => sum + parseFloat(tc.overtimeHours || '0'), 0);
  const totalHours = regularHours + overtimeHours;
  
  // Calculate weekly overtime (anything over 40 hours total)
  const weeklyOvertimeHours = Math.max(0, totalHours - 40);
  const adjustedRegularHours = Math.min(totalHours, 40);
  
  return {
    totalRegularHours: Math.round(adjustedRegularHours * 100) / 100,
    totalOvertimeHours: Math.round((overtimeHours + weeklyOvertimeHours) * 100) / 100,
    totalHours: Math.round(totalHours * 100) / 100,
    weeklyOvertimeHours: Math.round(weeklyOvertimeHours * 100) / 100,
  };
}

export function calculateMileage(startOdometer: number, endOdometer: number): number {
  if (!startOdometer || !endOdometer || endOdometer < startOdometer) {
    return 0;
  }
  return endOdometer - startOdometer;
}

export function calculateMileageReimbursement(miles: number, rate: number = 0.655): number {
  return Math.round(miles * rate * 100) / 100;
}

export function calculateGrossPay(
  regularHours: number,
  overtimeHours: number,
  ptoHours: number,
  holidayHours: number,
  regularRate: number,
  overtimeRate?: number
): {
  regularPay: number;
  overtimePay: number;
  ptoPay: number;
  holidayPay: number;
  totalGrossPay: number;
} {
  const effectiveOvertimeRate = overtimeRate || (regularRate * 1.5);
  
  const regularPay = regularHours * regularRate;
  const overtimePay = overtimeHours * effectiveOvertimeRate;
  const ptoPay = ptoHours * regularRate;
  const holidayPay = holidayHours * regularRate;
  
  const totalGrossPay = regularPay + overtimePay + ptoPay + holidayPay;
  
  return {
    regularPay: Math.round(regularPay * 100) / 100,
    overtimePay: Math.round(overtimePay * 100) / 100,
    ptoPay: Math.round(ptoPay * 100) / 100,
    holidayPay: Math.round(holidayPay * 100) / 100,
    totalGrossPay: Math.round(totalGrossPay * 100) / 100,
  };
}

export function validateTimeEntry(timeIn: string, timeOut: string): {
  isValid: boolean;
  error?: string;
} {
  if (!timeIn || !timeOut) {
    return { isValid: false, error: "Both time in and time out are required" };
  }
  
  const startMinutes = parseTime(timeIn);
  const endMinutes = parseTime(timeOut);
  
  if (startMinutes === null || endMinutes === null) {
    return { isValid: false, error: "Invalid time format" };
  }
  
  // Allow overnight shifts, so don't validate that end > start
  return { isValid: true };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

export function formatHours(hours: number): string {
  return hours.toFixed(2);
}
