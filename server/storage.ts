import {
  users,
  employers,
  employees,
  payPeriods,
  timecards,
  timeEntries,
  ptoEntries,
  reimbursementEntries,
  miscHoursEntries,
  reimbursements,
  reports,
  type User,
  type UpsertUser,
  type Employer,
  type InsertEmployer,
  type Employee,
  type InsertEmployee,
  type PayPeriod,
  type InsertPayPeriod,
  type Timecard,
  type InsertTimecard,
  type InsertTimeEntry,
  type TimeEntry,
  type InsertPtoEntry,
  type PtoEntry,
  type InsertReimbursementEntry,
  type ReimbursementEntry,
  type InsertMiscHoursEntry,
  type MiscHoursEntry,
  type Reimbursement,
  type InsertReimbursement,
  type Report,
  type InsertReport,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, gte, lte, gt, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Employer operations
  createEmployer(employer: InsertEmployer): Promise<Employer>;
  getEmployersByOwner(ownerId: string): Promise<Employer[]>;
  getEmployer(id: number): Promise<Employer | undefined>;
  updateEmployer(id: number, employer: Partial<InsertEmployer>): Promise<Employer>;
  
  // Employee operations
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  createMultipleEmployees(employees: InsertEmployee[]): Promise<{ success: number; failed: number }>;
  getEmployeesByEmployer(employerId: number): Promise<Employee[]>;
  getEmployee(id: number): Promise<Employee | undefined>;
  updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee>;
  deleteEmployee(id: number): Promise<void>;
  
  // Pay period operations
  createPayPeriod(payPeriod: InsertPayPeriod): Promise<PayPeriod>;
  getPayPeriodsByEmployer(employerId: number): Promise<PayPeriod[]>;
  getCurrentPayPeriod(employerId: number): Promise<PayPeriod | undefined>;
  getPayPeriod(id: number): Promise<PayPeriod | undefined>;
  updatePayPeriod(id: number, payPeriod: Partial<InsertPayPeriod>): Promise<PayPeriod>;
  
  // Timecard operations
  createTimecard(timecard: InsertTimecard): Promise<Timecard>;
  getTimecardsByPayPeriod(payPeriodId: number): Promise<Timecard[]>;
  getTimecardsByEmployee(employeeId: number, payPeriodId?: number): Promise<Timecard[]>;
  getTimecard(id: number): Promise<Timecard | undefined>;
  updateTimecard(id: number, timecard: Partial<InsertTimecard>): Promise<Timecard>;
  deleteTimecard(id: number): Promise<void>;

  // Time entry operations
  createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry>;
  getTimeEntriesByEmployee(employeeId: number, start?: string, end?: string): Promise<TimeEntry[]>;
  updateTimeEntry(id: number, entry: Partial<InsertTimeEntry>): Promise<TimeEntry>;
  deleteTimeEntry(id: number): Promise<void>;

  // PTO entry operations
  createPtoEntry(entry: InsertPtoEntry): Promise<PtoEntry>;
  getPtoEntriesByEmployee(employeeId: number): Promise<PtoEntry[]>;
  updatePtoEntry(id: number, entry: Partial<InsertPtoEntry>): Promise<PtoEntry>;
  deletePtoEntry(id: number): Promise<void>;

  // Misc reimbursement entry operations
  createReimbursementEntry(entry: InsertReimbursementEntry): Promise<ReimbursementEntry>;
  getReimbursementEntriesByEmployee(employeeId: number): Promise<ReimbursementEntry[]>;
  updateReimbursementEntry(id: number, entry: Partial<InsertReimbursementEntry>): Promise<ReimbursementEntry>;
  deleteReimbursementEntry(id: number): Promise<void>;

  // Misc hours entry operations
  createMiscHoursEntry(entry: InsertMiscHoursEntry): Promise<MiscHoursEntry>;
  getMiscHoursEntriesByEmployee(employeeId: number): Promise<MiscHoursEntry[]>;
  updateMiscHoursEntry(id: number, entry: Partial<InsertMiscHoursEntry>): Promise<MiscHoursEntry>;
  deleteMiscHoursEntry(id: number): Promise<void>;
  
  // Reimbursement operations
  createReimbursement(reimbursement: InsertReimbursement): Promise<Reimbursement>;
  getReimbursementsByPayPeriod(payPeriodId: number): Promise<Reimbursement[]>;
  getReimbursementsByEmployee(employeeId: number): Promise<Reimbursement[]>;
  updateReimbursement(id: number, reimbursement: Partial<InsertReimbursement>): Promise<Reimbursement>;
  deleteReimbursement(id: number): Promise<void>;
  
  // Report operations
  createReport(report: InsertReport): Promise<Report>;
  getReportsByEmployer(employerId: number): Promise<Report[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Employer operations
  async createEmployer(employer: InsertEmployer): Promise<Employer> {
    const [newEmployer] = await db.insert(employers).values(employer).returning();
    return newEmployer;
  }

  async getEmployersByOwner(ownerId: string): Promise<Employer[]> {
    return await db.select().from(employers).where(eq(employers.ownerId, ownerId));
  }

  async getEmployer(id: number): Promise<Employer | undefined> {
    const [employer] = await db.select().from(employers).where(eq(employers.id, id));
    return employer;
  }

  async updateEmployer(id: number, employer: Partial<InsertEmployer>): Promise<Employer> {
    const [updated] = await db
      .update(employers)
      .set(employer)
      .where(eq(employers.id, id))
      .returning();
    return updated;
  }

  // Employee operations
  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const [newEmployee] = await db.insert(employees).values(employee).returning();
    return newEmployee;
  }

  async createMultipleEmployees(employeeList: InsertEmployee[]): Promise<{ success: number; failed: number }> {
    if (employeeList.length === 0) return { success: 0, failed: 0 };
    const inserted = await db.insert(employees).values(employeeList).returning();
    return { success: inserted.length, failed: employeeList.length - inserted.length };
  }

  async getEmployeesByEmployer(employerId: number): Promise<Employee[]> {
    return await db
      .select()
      .from(employees)
      .where(and(eq(employees.employerId, employerId), eq(employees.isActive, true)))
      .orderBy(asc(employees.lastName), asc(employees.firstName));
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id));
    return employee;
  }

  async updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee> {
    const [updated] = await db
      .update(employees)
      .set(employee)
      .where(eq(employees.id, id))
      .returning();
    return updated;
  }

  async deleteEmployee(id: number): Promise<void> {
    await db.update(employees).set({ isActive: false }).where(eq(employees.id, id));
  }

  // Pay period operations
  async createPayPeriod(payPeriod: InsertPayPeriod): Promise<PayPeriod> {
    // If creating an active pay period, deactivate all existing ones for this employer
    if (payPeriod.isActive) {
      await db
        .update(payPeriods)
        .set({ isActive: false })
        .where(eq(payPeriods.employerId, payPeriod.employerId));
    }
    
    const [newPayPeriod] = await db.insert(payPeriods).values(payPeriod).returning();
    return newPayPeriod;
  }

  async getPayPeriodsByEmployer(employerId: number): Promise<PayPeriod[]> {
    // Ensure pay periods exist for current date
    await this.ensurePayPeriodsExist(employerId);
    
    // Clean up any future periods first
    await this.cleanupFuturePeriods(employerId);
    
    // Get current pay period first
    const currentPayPeriod = await this.getCurrentPayPeriod(employerId);
    
    // Get all pay periods and limit to current + 3 historical
    const allPeriods = await db
      .select()
      .from(payPeriods)
      .where(eq(payPeriods.employerId, employerId))
      .orderBy(desc(payPeriods.startDate))
      .limit(4); // Current + 3 historical
    
    return allPeriods;
  }

  private async cleanupFuturePeriods(employerId: number): Promise<void> {
    // Use UTC date to ensure consistent timezone handling
    const today = new Date();
    const utcToday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const todayStr = utcToday.toISOString().split('T')[0];
    
    // Delete any pay periods that start after today
    await db
      .delete(payPeriods)
      .where(
        and(
          eq(payPeriods.employerId, employerId),
          gt(payPeriods.startDate, todayStr)
        )
      );
  }

  async getCurrentPayPeriod(employerId: number): Promise<PayPeriod | undefined> {
    // First ensure pay periods exist for the current date
    await this.ensurePayPeriodsExist(employerId);
    
    // Use UTC date to ensure consistent timezone handling
    const today = new Date();
    const utcToday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const todayStr = utcToday.toISOString().split('T')[0];
    
    const [current] = await db
      .select()
      .from(payPeriods)
      .where(
        and(
          eq(payPeriods.employerId, employerId),
          lte(payPeriods.startDate, todayStr),
          gte(payPeriods.endDate, todayStr)
        )
      )
      .limit(1);
    
    return current;
  }

  async ensurePayPeriodsExist(employerId: number): Promise<void> {
    const employer = await this.getEmployer(employerId);
    
    let startDate: Date;
    
    if (!employer?.payPeriodStartDate) {
      console.warn(
        `Employer ${employerId} missing pay_period_start_date, defaulting to the most recent Wednesday.`
      );
      // Find the most recent Wednesday (including today if it's Wednesday) using UTC
      const today = new Date();
      const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
      startDate = this.getMostRecentWednesday(todayUTC);
    } else {
      // Find the most recent Wednesday from the configured start date - parse as UTC
      const [year, month, day] = employer.payPeriodStartDate.split('-').map(Number);
      const configuredDate = new Date(Date.UTC(year, month - 1, day));
      startDate = this.getMostRecentWednesday(configuredDate);
    }

    // Use UTC for consistent date handling
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    
    // Get the latest pay period for this employer
    const [latestPayPeriod] = await db
      .select()
      .from(payPeriods)
      .where(eq(payPeriods.employerId, employerId))
      .orderBy(desc(payPeriods.endDate))
      .limit(1);

    let currentStart: Date;
    if (latestPayPeriod) {
      // Start from the day after the latest pay period ends - parse as UTC
      const [year, month, day] = latestPayPeriod.endDate.split('-').map(Number);
      currentStart = new Date(Date.UTC(year, month - 1, day)); // month is 0-indexed
      currentStart.setUTCDate(currentStart.getUTCDate() + 1);
    } else {
      // No pay periods exist, start from the configured start date
      currentStart = new Date(startDate);
    }

    // Only generate current pay period (no future periods)
    const payPeriodsToCreate = [];
    
    // Find the current pay period that contains today
    let periodStart = new Date(currentStart);
    while (periodStart <= todayUTC) {
      const periodEnd = new Date(periodStart);
      periodEnd.setUTCDate(periodEnd.getUTCDate() + 13); // 14 days total
      
      // If today falls within this period, create it
      if (todayUTC >= periodStart && todayUTC <= periodEnd) {
        payPeriodsToCreate.push({
          employerId,
          startDate: periodStart.toISOString().split('T')[0],
          endDate: periodEnd.toISOString().split('T')[0],
          isActive: false
        });
        break;
      }
      
      // Move to next period
      periodStart.setUTCDate(periodStart.getUTCDate() + 14);
    }

    if (payPeriodsToCreate.length > 0) {
      await db.insert(payPeriods).values(payPeriodsToCreate);
    }
  }

  private getMostRecentWednesday(date: Date): Date {
    // Create UTC date to avoid timezone issues
    const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayOfWeek = utcDate.getUTCDay(); // Sunday = 0, Wednesday = 3
    
    let daysToSubtract: number;
    if (dayOfWeek === 3) {
      // It's Wednesday, use this date
      daysToSubtract = 0;
    } else if (dayOfWeek > 3) {
      // It's after Wednesday (Thu, Fri, Sat), go back to this week's Wednesday
      daysToSubtract = dayOfWeek - 3;
    } else {
      // It's before Wednesday (Sun, Mon, Tue), go back to last week's Wednesday
      daysToSubtract = dayOfWeek + 4; // (7 - 3) + dayOfWeek
    }
    
    const wednesdayDate = new Date(utcDate);
    wednesdayDate.setUTCDate(utcDate.getUTCDate() - daysToSubtract);
    return wednesdayDate;
  }

  async getPayPeriod(id: number): Promise<PayPeriod | undefined> {
    const [payPeriod] = await db.select().from(payPeriods).where(eq(payPeriods.id, id));
    return payPeriod;
  }

  async updatePayPeriod(id: number, payPeriod: Partial<InsertPayPeriod>): Promise<PayPeriod> {
    const [updated] = await db
      .update(payPeriods)
      .set(payPeriod)
      .where(eq(payPeriods.id, id))
      .returning();
    return updated;
  }

  // Timecard operations
  async createTimecard(timecard: InsertTimecard): Promise<Timecard> {
    const [newTimecard] = await db.insert(timecards).values(timecard).returning();
    return newTimecard;
  }

  async getTimecardsByPayPeriod(payPeriodId: number): Promise<Timecard[]> {
    return await db
      .select()
      .from(timecards)
      .where(eq(timecards.payPeriodId, payPeriodId))
      .orderBy(asc(timecards.workDate));
  }

  async getTimecardsByEmployee(employeeId: number, payPeriodId?: number): Promise<Timecard[]> {
    const conditions = [eq(timecards.employeeId, employeeId)];
    if (payPeriodId) {
      conditions.push(eq(timecards.payPeriodId, payPeriodId));
    }
    
    return await db
      .select()
      .from(timecards)
      .where(and(...conditions))
      .orderBy(asc(timecards.workDate));
  }

  async getTimecard(id: number): Promise<Timecard | undefined> {
    const [timecard] = await db.select().from(timecards).where(eq(timecards.id, id));
    return timecard;
  }

  async updateTimecard(id: number, timecard: Partial<InsertTimecard>): Promise<Timecard> {
    const [updated] = await db
      .update(timecards)
      .set({ ...timecard, updatedAt: new Date() })
      .where(eq(timecards.id, id))
      .returning();
    return updated;
  }

  async deleteTimecard(id: number): Promise<void> {
    await db.delete(timecards).where(eq(timecards.id, id));
  }

  // Time entry operations
  async createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry> {
    const [newEntry] = await db.insert(timeEntries).values(entry).returning();
    return newEntry;
  }

  async getTimeEntriesByEmployee(employeeId: number, start?: string, end?: string): Promise<TimeEntry[]> {
    const conditions: any[] = [eq(timeEntries.employeeId, employeeId)];
    if (start) conditions.push(gte(timeEntries.timeIn, new Date(start)));
    if (end) conditions.push(lte(timeEntries.timeIn, new Date(end)));
    return await db
      .select()
      .from(timeEntries)
      .where(and(...conditions))
      .orderBy(asc(timeEntries.timeIn));
  }

  async updateTimeEntry(id: number, entry: Partial<InsertTimeEntry>): Promise<TimeEntry> {
    const [updated] = await db
      .update(timeEntries)
      .set(entry)
      .where(eq(timeEntries.id, id))
      .returning();
    return updated;
  }

  async deleteTimeEntry(id: number): Promise<void> {
    await db.delete(timeEntries).where(eq(timeEntries.id, id));
  }

  // PTO entry operations
  async createPtoEntry(entry: InsertPtoEntry): Promise<PtoEntry> {
    const [newEntry] = await db.insert(ptoEntries).values(entry).returning();
    return newEntry;
  }

  async getPtoEntriesByEmployee(employeeId: number): Promise<PtoEntry[]> {
    return await db
      .select()
      .from(ptoEntries)
      .where(eq(ptoEntries.employeeId, employeeId))
      .orderBy(asc(ptoEntries.entryDate));
  }

  async updatePtoEntry(id: number, entry: Partial<InsertPtoEntry>): Promise<PtoEntry> {
    const [updated] = await db
      .update(ptoEntries)
      .set(entry)
      .where(eq(ptoEntries.id, id))
      .returning();
    return updated;
  }

  async deletePtoEntry(id: number): Promise<void> {
    await db.delete(ptoEntries).where(eq(ptoEntries.id, id));
  }

  // Reimbursement entry operations
  async createReimbursementEntry(entry: InsertReimbursementEntry): Promise<ReimbursementEntry> {
    const [newEntry] = await db.insert(reimbursementEntries).values(entry).returning();
    return newEntry;
  }

  async getReimbursementEntriesByEmployee(employeeId: number): Promise<ReimbursementEntry[]> {
    return await db
      .select()
      .from(reimbursementEntries)
      .where(eq(reimbursementEntries.employeeId, employeeId))
      .orderBy(desc(reimbursementEntries.entryDate));
  }

  async updateReimbursementEntry(id: number, entry: Partial<InsertReimbursementEntry>): Promise<ReimbursementEntry> {
    const [updated] = await db
      .update(reimbursementEntries)
      .set(entry)
      .where(eq(reimbursementEntries.id, id))
      .returning();
    return updated;
  }

  async deleteReimbursementEntry(id: number): Promise<void> {
    await db.delete(reimbursementEntries).where(eq(reimbursementEntries.id, id));
  }

  // Misc hours entry operations
  async createMiscHoursEntry(entry: InsertMiscHoursEntry): Promise<MiscHoursEntry> {
    const [newEntry] = await db.insert(miscHoursEntries).values(entry).returning();
    return newEntry;
  }

  async getMiscHoursEntriesByEmployee(employeeId: number): Promise<MiscHoursEntry[]> {
    return await db
      .select()
      .from(miscHoursEntries)
      .where(eq(miscHoursEntries.employeeId, employeeId))
      .orderBy(asc(miscHoursEntries.entryDate));
  }

  async updateMiscHoursEntry(id: number, entry: Partial<InsertMiscHoursEntry>): Promise<MiscHoursEntry> {
    const [updated] = await db
      .update(miscHoursEntries)
      .set(entry)
      .where(eq(miscHoursEntries.id, id))
      .returning();
    return updated;
  }

  async deleteMiscHoursEntry(id: number): Promise<void> {
    await db.delete(miscHoursEntries).where(eq(miscHoursEntries.id, id));
  }

  // Reimbursement operations
  async createReimbursement(reimbursement: InsertReimbursement): Promise<Reimbursement> {
    const [newReimbursement] = await db.insert(reimbursements).values(reimbursement).returning();
    return newReimbursement;
  }

  async getReimbursementsByPayPeriod(payPeriodId: number): Promise<Reimbursement[]> {
    return await db
      .select()
      .from(reimbursements)
      .where(eq(reimbursements.payPeriodId, payPeriodId))
      .orderBy(desc(reimbursements.createdAt));
  }

  async getReimbursementsByEmployee(employeeId: number): Promise<Reimbursement[]> {
    return await db
      .select()
      .from(reimbursements)
      .where(eq(reimbursements.employeeId, employeeId))
      .orderBy(desc(reimbursements.createdAt));
  }

  async updateReimbursement(id: number, reimbursement: Partial<InsertReimbursement>): Promise<Reimbursement> {
    const [updated] = await db
      .update(reimbursements)
      .set(reimbursement)
      .where(eq(reimbursements.id, id))
      .returning();
    return updated;
  }

  async deleteReimbursement(id: number): Promise<void> {
    await db.delete(reimbursements).where(eq(reimbursements.id, id));
  }

  // Report operations
  async createReport(report: InsertReport): Promise<Report> {
    const [newReport] = await db.insert(reports).values(report).returning();
    return newReport;
  }

  async getReportsByEmployer(employerId: number): Promise<Report[]> {
    return await db
      .select()
      .from(reports)
      .where(eq(reports.employerId, employerId))
      .orderBy(desc(reports.createdAt));
  }
}

export const storage = new DatabaseStorage();
