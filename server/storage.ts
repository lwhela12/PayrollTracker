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
import { 
  employees, employers, timeEntries, ptoEntries, miscHoursEntries, 
  reimbursementEntries, payPeriods, reports, reimbursements 
} from "../shared/schema";
import { eq, and, gte, lte, desc, asc, between } from "drizzle-orm";
import { pool } from "./db";
import { calculateWeeklyOvertime } from "./lib/payroll";
import { inArray } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Employer operations
  createEmployer(employer: InsertEmployer): Promise<Employer>;
  getEmployersByOwner(ownerId: string): Promise<Employer[]>;
  getEmployer(id: number): Promise<Employer | undefined>;
  updateEmployer(id: number, employer: Partial<InsertEmployer>): Promise<Employer>;
  deleteEmployer(id: number): Promise<void>;

  // Employee operations
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  createMultipleEmployees(employees: InsertEmployee[]): Promise<{ success: number; failed: number; employees: Employee[] }>;
  getEmployeesByEmployer(employerId: number): Promise<Employee[]>;
  getEmployee(id: number): Promise<Employee | undefined>;
  updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee>;
  deleteEmployee(id: number): Promise<void>;

  // Pay period operations
  getPayPeriodsByEmployer(employerId: number): Promise<PayPeriod[]>;
  getCurrentPayPeriod(employerId: number): Promise<PayPeriod | undefined>;
  getPayPeriod(id: number): Promise<PayPeriod | undefined>;
  clearAndRegeneratePayPeriods(employerId: number): Promise<void>;

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

  // Dashboard stats
  getDashboardStats(employerId: number, payPeriodId: number): Promise<any[]>;
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
    const needsPayPeriodReset = employer.payPeriodStartDate && employer.payPeriodStartDate !== (await this.getEmployer(id))?.payPeriodStartDate;

    const [updated] = await db
      .update(employers)
      .set(employer)
      .where(eq(employers.id, id))
      .returning();

    if (needsPayPeriodReset) {
      await this.clearAndRegeneratePayPeriods(id);
    }

    return updated;
  }

  async deleteEmployer(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      // Remove dependent records not covered by cascade constraints
      const empIds = await tx
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.employerId, id));
      const employeeIds = empIds.map((e) => e.id);

      if (employeeIds.length > 0) {
        await tx.delete(timeEntries).where(inArray(timeEntries.employeeId, employeeIds));
        await tx.delete(ptoEntries).where(inArray(ptoEntries.employeeId, employeeIds));
        await tx
          .delete(reimbursementEntries)
          .where(inArray(reimbursementEntries.employeeId, employeeIds));
        await tx.delete(miscHoursEntries).where(inArray(miscHoursEntries.employeeId, employeeIds));
      }

      await tx.delete(reports).where(eq(reports.employerId, id));

      await tx.delete(employers).where(eq(employers.id, id));
    });
  }

  // Employee operations
  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    // Convert Date to string if hireDate is a Date object
    const insertData = { ...employee };
    if (insertData.hireDate instanceof Date) {
      (insertData as any).hireDate = insertData.hireDate.toISOString().split('T')[0];
    }

    const [newEmployee] = await db.insert(employees).values(insertData as any).returning();
    return newEmployee;
  }

  async createMultipleEmployees(employees: InsertEmployee[]): Promise<{ success: number; failed: number; employees: Employee[] }> {
    const createdEmployees: Employee[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const employee of employees) {
      try {
        const created = await this.createEmployee(employee);
        createdEmployees.push(created);
        successCount++;
      } catch (error) {
        console.error(`Failed to create employee ${employee.firstName} ${employee.lastName}:`, error);
        failedCount++;
      }
    }

    return {
      success: successCount,
      failed: failedCount,
      employees: createdEmployees
    };
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
    // Convert Date to string if hireDate is present
    const updateData = { ...employee };
    if (updateData.hireDate instanceof Date) {
      (updateData as any).hireDate = updateData.hireDate.toISOString().split('T')[0];
    }

    const [updated] = await db
      .update(employees)
      .set(updateData as any)
      .where(eq(employees.id, id))
      .returning();
    return updated;
  }

  async deleteEmployee(id: number): Promise<void> {
    await db.update(employees).set({ isActive: false }).where(eq(employees.id, id));
  }

  // Pay Period Operations

  private getPayPeriodStartDate(employer: Employer): Date {
    if (!employer.payPeriodStartDate) {
      throw new Error('Pay period start date is required');
    }
    const baseDate = new Date(employer.payPeriodStartDate);
    return new Date(Date.UTC(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate()
    ));
  }

  async getRelevantPayPeriods(employerId: number, referenceDate: Date): Promise<PayPeriod[]> {
    const employer = await this.getEmployer(employerId);
    if (!employer || !employer.payPeriodStartDate) {
      return [];
    }

    let currentStartDate = this.getPayPeriodStartDate(employer);
    const refDateUTC = new Date(Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()));

    while (true) {
      const endDate = new Date(currentStartDate);
      endDate.setUTCDate(endDate.getUTCDate() + 13);
      if (currentStartDate <= refDateUTC && refDateUTC <= endDate) {
        break;
      }
      if (currentStartDate > refDateUTC) {
        currentStartDate.setUTCDate(currentStartDate.getUTCDate() - 14);
      } else {
        currentStartDate.setUTCDate(currentStartDate.getUTCDate() + 14);
      }
    }

    const targetPeriods = [-2, -1, 0].map(offset => {
      const startDate = new Date(currentStartDate);
      startDate.setUTCDate(startDate.getUTCDate() + (offset * 14));
      const endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + 13);
      return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      };
    });

    const targetStartDates = targetPeriods.map(p => p.startDate);

    const existingPeriods = await db.select().from(payPeriods).where(and(
      eq(payPeriods.employerId, employerId),
      inArray(payPeriods.startDate, targetStartDates)
    ));

    const existingDates = new Set(existingPeriods.map(p => p.startDate));

    const periodsToCreate = targetPeriods
      .filter(p => !existingDates.has(p.startDate))
      .map(p => ({
        ...p,
        employerId,
        isActive: p.startDate === currentStartDate.toISOString().split('T')[0]
      }));

    if (periodsToCreate.length > 0) {
      await db.insert(payPeriods)
        .values(periodsToCreate)
        .onConflictDoNothing();
    }

    const finalPeriods = await db.select().from(payPeriods).where(and(
      eq(payPeriods.employerId, employerId),
      inArray(payPeriods.startDate, targetStartDates)
    )).orderBy(desc(payPeriods.startDate));

    return finalPeriods;
  }

  async getPayPeriodsByEmployer(employerId: number): Promise<PayPeriod[]> {
    return this.getRelevantPayPeriods(employerId, new Date());
  }

  async getCurrentPayPeriod(employerId: number): Promise<PayPeriod | undefined> {
    const relevant = await this.getRelevantPayPeriods(employerId, new Date());
    return relevant[0];
  }

  async getPayPeriod(id: number): Promise<PayPeriod | undefined> {
    const [payPeriod] = await db.select().from(payPeriods).where(eq(payPeriods.id, id));
    return payPeriod;
  }

  async getPayPeriodByDates(employerId: number, startDate: Date, endDate: Date): Promise<PayPeriod | undefined> {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    const [payPeriod] = await db.select().from(payPeriods).where(
      and(
        eq(payPeriods.employerId, employerId),
        eq(payPeriods.startDate, startDateStr),
        eq(payPeriods.endDate, endDateStr)
      )
    );
    return payPeriod;
  }

  async clearAndRegeneratePayPeriods(employerId: number): Promise<void> {
    const payPeriodIds = await db
      .select({ id: payPeriods.id })
      .from(payPeriods)
      .where(eq(payPeriods.employerId, employerId));

    const ppIds = payPeriodIds.map(p => p.id);

    if (ppIds.length > 0) {
      await db.delete(timecards).where(inArray(timecards.payPeriodId, ppIds));
      await db.delete(reports).where(inArray(reports.payPeriodId, ppIds));
    }

    await db.delete(payPeriods).where(eq(payPeriods.employerId, employerId));

    await this.getRelevantPayPeriods(employerId, new Date());
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

  async bulkUpdateTimecardData(data: {
    employeeId: number;
    payPeriodId: number;
    payPeriodStart: string;
    payPeriodEnd: string;
    days: any;
    ptoHours: any;
    holidayNonWorked: any;
    holidayWorked: any;
    milesDriven: any;
    miscHours: any;
    reimbursement: any;
    employer: any;
  }): Promise<void> {
    const {
      employeeId,
      payPeriodId,
      payPeriodStart,
      payPeriodEnd,
      days,
      ptoHours,
      holidayNonWorked,
      holidayWorked,
      milesDriven,
      miscHours,
      reimbursement,
      employer
    } = data;

    await db.transaction(async (tx) => {
      // Clear existing entries for this employee and pay period
      await tx.delete(timeEntries).where(
        and(
          eq(timeEntries.employeeId, employeeId),
          gte(timeEntries.timeIn, new Date(payPeriodStart)),
          lte(timeEntries.timeIn, new Date(payPeriodEnd))
        )
      );

      await tx.delete(ptoEntries).where(
        and(
          eq(ptoEntries.employeeId, employeeId),
          gte(ptoEntries.entryDate, payPeriodStart),
          lte(ptoEntries.entryDate, payPeriodEnd)
        )
      );

      await tx.delete(miscHoursEntries).where(
        and(
          eq(miscHoursEntries.employeeId, employeeId),
          gte(miscHoursEntries.entryDate, payPeriodStart),
          lte(miscHoursEntries.entryDate, payPeriodEnd)
        )
      );

      await tx.delete(reimbursementEntries).where(
        and(
          eq(reimbursementEntries.employeeId, employeeId),
          gte(reimbursementEntries.entryDate, payPeriodStart),
          lte(reimbursementEntries.entryDate, payPeriodEnd)
        )
      );

      // Insert new time entries
      const timeEntriesToInsert = [];
      for (const [date, dayData] of Object.entries(days)) {
        if (dayData && typeof dayData === 'object') {
          const { shifts } = dayData as any;
          if (shifts && Array.isArray(shifts)) {
            for (const shift of shifts) {
              if (shift.timeIn && shift.timeOut && shift.timeIn.trim() !== '' && shift.timeOut.trim() !== '') {
                // Ensure time format is HH:MM
                const timeInFormatted = shift.timeIn.includes(':') ? shift.timeIn : `${shift.timeIn}:00`;
                const timeOutFormatted = shift.timeOut.includes(':') ? shift.timeOut : `${shift.timeOut}:00`;
                
                const timeInDate = new Date(`${date}T${timeInFormatted}:00`);
                const timeOutDate = new Date(`${date}T${timeOutFormatted}:00`);
                
                // Validate dates before inserting
                if (!isNaN(timeInDate.getTime()) && !isNaN(timeOutDate.getTime())) {
                  timeEntriesToInsert.push({
                    employeeId,
                    timeIn: timeInDate,
                    timeOut: timeOutDate,
                    lunchMinutes: shift.lunch || 0,
                  });
                }
              }
            }
          }
        }
      }

      if (timeEntriesToInsert.length > 0) {
        await tx.insert(timeEntries).values(timeEntriesToInsert);
      }

      // Insert PTO entries
      if (ptoHours && typeof ptoHours === 'object') {
        const ptoEntriesToInsert = [];
        for (const [date, hours] of Object.entries(ptoHours)) {
          if (hours && parseFloat(hours as string) > 0) {
            ptoEntriesToInsert.push({
              employeeId,
              entryDate: date,
              hours: parseFloat(hours as string),
              description: 'PTO'
            });
          }
        }
        if (ptoEntriesToInsert.length > 0) {
          await tx.insert(ptoEntries).values(ptoEntriesToInsert);
        }
      }

      // Insert misc hours entries
      const miscEntriesToInsert = [];
      
      if (holidayNonWorked && typeof holidayNonWorked === 'object') {
        for (const [date, hours] of Object.entries(holidayNonWorked)) {
          if (hours && parseFloat(hours as string) > 0) {
            miscEntriesToInsert.push({
              employeeId,
              entryDate: date,
              entryType: 'holiday' as const,
              hours: parseFloat(hours as string),
              description: 'Holiday'
            });
          }
        }
      }

      if (holidayWorked && typeof holidayWorked === 'object') {
        for (const [date, hours] of Object.entries(holidayWorked)) {
          if (hours && parseFloat(hours as string) > 0) {
            miscEntriesToInsert.push({
              employeeId,
              entryDate: date,
              entryType: 'holiday-worked' as const,
              hours: parseFloat(hours as string),
              description: 'Holiday Worked'
            });
          }
        }
      }

      if (miscHours && typeof miscHours === 'object') {
        for (const [date, hours] of Object.entries(miscHours)) {
          if (hours && parseFloat(hours as string) > 0) {
            miscEntriesToInsert.push({
              employeeId,
              entryDate: date,
              entryType: 'misc' as const,
              hours: parseFloat(hours as string),
              description: 'Misc Hours'
            });
          }
        }
      }

      if (miscEntriesToInsert.length > 0) {
        await tx.insert(miscHoursEntries).values(miscEntriesToInsert);
      }

      // Insert reimbursement entries
      const reimbEntriesToInsert = [];
      
      if (milesDriven && typeof milesDriven === 'object') {
        for (const [date, miles] of Object.entries(milesDriven)) {
          if (miles && parseFloat(miles as string) > 0) {
            const mileageRate = employer.mileageRate || 0.67;
            const amount = parseFloat(miles as string) * mileageRate;
            reimbEntriesToInsert.push({
              employeeId,
              entryDate: date,
              description: `Mileage: ${miles} miles`,
              amount: amount
            });
          }
        }
      }

      if (reimbursement && typeof reimbursement === 'object') {
        for (const [date, amount] of Object.entries(reimbursement)) {
          if (amount && parseFloat(amount as string) > 0) {
            reimbEntriesToInsert.push({
              employeeId,
              entryDate: date,
              description: 'Reimbursement',
              amount: parseFloat(amount as string)
            });
          }
        }
      }

      if (reimbEntriesToInsert.length > 0) {
        await tx.insert(reimbursementEntries).values(reimbEntriesToInsert);
      }
    });
  }

  async getDashboardStats(employerId: number, payPeriodId: number): Promise<any[]> {
    const payPeriod = await this.getPayPeriod(payPeriodId);
    if (!payPeriod) return [];

    const query = `
      WITH time_entries_with_hours AS (
        SELECT
          employee_id,
          FLOOR((time_in::date - $2::date) / 7) AS week,
          SUM(CASE 
            WHEN time_out >= time_in THEN 
              EXTRACT(EPOCH FROM (time_out - time_in))/3600 - COALESCE(lunch_minutes, 0)/60.0
            ELSE 
              EXTRACT(EPOCH FROM (time_out + interval '24 hours' - time_in))/3600 - COALESCE(lunch_minutes, 0)/60.0
          END) AS hours
        FROM time_entries
        WHERE time_in >= $2 AND time_in <= $3
          AND employee_id IN (SELECT id FROM employees WHERE employer_id = $1 AND is_active = true)
        GROUP BY employee_id, week
      ),
      time_totals AS (
        SELECT
          employee_id,
          SUM(CASE WHEN hours > 40 THEN 40 ELSE hours END) AS regular_hours,
          SUM(CASE WHEN hours > 40 THEN hours - 40 ELSE 0 END) AS overtime_hours
        FROM time_entries_with_hours
        GROUP BY employee_id
      ),
      pto_totals AS (
        SELECT employee_id, SUM(hours::numeric) AS pto_hours
        FROM pto_entries
        WHERE entry_date >= $2::date AND entry_date <= $3::date
          AND employee_id IN (SELECT id FROM employees WHERE employer_id=$1 AND is_active=true)
        GROUP BY employee_id
      ),
      misc_totals AS (
        SELECT employee_id,
               SUM(CASE WHEN entry_type='holiday' THEN hours::numeric ELSE 0 END) AS holiday_hours,
               SUM(CASE WHEN entry_type='holiday-worked' THEN hours::numeric ELSE 0 END) AS holiday_worked_hours,
               SUM(CASE WHEN entry_type='misc' THEN hours::numeric ELSE 0 END) AS misc_hours
        FROM misc_hours_entries
        WHERE entry_date >= $2::date AND entry_date <= $3::date
          AND employee_id IN (SELECT id FROM employees WHERE employer_id=$1 AND is_active=true)
        GROUP BY employee_id
      ),
      reimb_totals AS (
        SELECT employee_id,
               SUM(amount::numeric) AS reimbursements,
               SUM(
                 CASE
                   WHEN description ~ 'Mileage:' THEN
                     (regexp_match(description, 'Mileage: ([0-9]+(?:\\.[0-9]+)?) miles'))[1]::numeric
                   ELSE 0
                 END
               ) AS mileage
        FROM reimbursement_entries
        WHERE entry_date >= $2::date AND entry_date <= $3::date
          AND employee_id IN (SELECT id FROM employees WHERE employer_id=$1 AND is_active=true)
        GROUP BY employee_id
      ),
      timecard_totals AS (
        SELECT employee_id,
               SUM(regular_hours::numeric) AS regular_hours,
               SUM(overtime_hours::numeric) AS overtime_hours,
               SUM(pto_hours::numeric) AS pto_hours,
               SUM(holiday_hours::numeric) AS holiday_hours,
               SUM(total_miles::numeric) AS mileage
        FROM timecards
        WHERE work_date >= $2::date AND work_date <= $3::date
          AND employee_id IN (SELECT id FROM employees WHERE employer_id=$1 AND is_active=true)
        GROUP BY employee_id
      )
      SELECT
        e.id as "employeeId",
        COALESCE(tt.regular_hours,0) + COALESCE(tc.regular_hours,0) as "regularHours",
        COALESCE(tt.overtime_hours,0) + COALESCE(tc.overtime_hours,0) as "overtimeHours",
        COALESCE(pt.pto_hours,0) + COALESCE(tc.pto_hours,0) as "ptoHours",
        COALESCE(mt.holiday_hours,0) + COALESCE(tc.holiday_hours,0) as "holidayHours",
        COALESCE(mt.holiday_worked_hours,0) as "holidayWorkedHours",
        COALESCE(mt.misc_hours,0) as "miscHours",
        COALESCE(rt.mileage,0) + COALESCE(tc.mileage,0) as "mileage",
        COALESCE(rt.reimbursements,0) as "reimbursements"
      FROM employees e
      LEFT JOIN time_totals tt ON e.id=tt.employee_id
      LEFT JOIN pto_totals pt ON e.id=pt.employee_id
      LEFT JOIN misc_totals mt ON e.id=mt.employee_id
      LEFT JOIN reimb_totals rt ON e.id=rt.employee_id
      LEFT JOIN timecard_totals tc ON e.id=tc.employee_id
      WHERE e.employer_id = $1 AND e.is_active = true
      ORDER BY e.id;
    `;

    const { rows } = await pool.query(query, [
      employerId,
      payPeriod.startDate,
      payPeriod.endDate,
    ]);

    return rows.map((r: any) => ({
      employeeId: r.employeeId,
      totalHours: Math.round((parseFloat(r.regularHours) + parseFloat(r.overtimeHours) + parseFloat(r.miscHours)) * 100) / 100,
      totalOvertimeHours: Math.round(parseFloat(r.overtimeHours) * 100) / 100,
      ptoHours: Math.round(parseFloat(r.ptoHours) * 100) / 100,
      holidayHours: Math.round(parseFloat(r.holidayHours) * 100) / 100,
      holidayWorkedHours: Math.round(parseFloat(r.holidayWorkedHours) * 100) / 100,
      miscHours: Math.round(parseFloat(r.miscHours) * 100) / 100,
      mileage: Math.round(parseFloat(r.mileage) * 100) / 100,
      reimbursements: Math.round(parseFloat(r.reimbursements) * 100) / 100,
      timecardCount: 0,
      approvedCount: 0,
    }));
  }
}

export const storage = new DatabaseStorage();