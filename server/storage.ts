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
import { db, pool } from "./db";
import { eq, and, desc, asc, gte, lte, inArray } from "drizzle-orm";
import { calculateWeeklyOvertime } from "./lib/payroll";

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

  async getDashboardStats(employerId: number, payPeriodId: number): Promise<any[]> {
    const payPeriod = await this.getPayPeriod(payPeriodId);
    if (!payPeriod) return [];

    const employees = await this.getEmployeesByEmployer(employerId);
    if (employees.length === 0) return [];

    const employeeIds = employees.map(e => e.id);

    const [allTimeEntries, allPtoEntries, allMiscEntries, allReimbEntries] = await Promise.all([
      db
        .select()
        .from(timeEntries)
        .where(
          and(
            inArray(timeEntries.employeeId, employeeIds),
            gte(timeEntries.timeIn, new Date(payPeriod.startDate)),
            lte(timeEntries.timeIn, new Date(payPeriod.endDate))
          )
        )
        .orderBy(asc(timeEntries.timeIn)),
      db
        .select()
        .from(ptoEntries)
        .where(
          and(
            inArray(ptoEntries.employeeId, employeeIds),
            gte(ptoEntries.entryDate, payPeriod.startDate as any),
            lte(ptoEntries.entryDate, payPeriod.endDate as any)
          )
        ),
      db
        .select()
        .from(miscHoursEntries)
        .where(
          and(
            inArray(miscHoursEntries.employeeId, employeeIds),
            gte(miscHoursEntries.entryDate, payPeriod.startDate as any),
            lte(miscHoursEntries.entryDate, payPeriod.endDate as any)
          )
        ),
      db
        .select()
        .from(reimbursementEntries)
        .where(
          and(
            inArray(reimbursementEntries.employeeId, employeeIds),
            gte(reimbursementEntries.entryDate, payPeriod.startDate as any),
            lte(reimbursementEntries.entryDate, payPeriod.endDate as any)
          )
        ),
    ]);

    const statsByEmployee = new Map<number, any>();
    for (const emp of employees) {
      statsByEmployee.set(emp.id, {
        regularHours: 0,
        overtimeHours: 0,
        ptoHours: 0,
        holidayHours: 0,
        holidayWorkedHours: 0,
        miscHours: 0,
        mileage: 0,
        reimbursements: 0,
      });
    }

    const entriesByEmp = new Map<number, typeof allTimeEntries>();
    for (const te of allTimeEntries) {
      if (!entriesByEmp.has(te.employeeId)) entriesByEmp.set(te.employeeId, []);
      entriesByEmp.get(te.employeeId)!.push(te);
    }

    for (const [empId, entries] of Array.from(entriesByEmp.entries())) {
      const { regularHours, overtimeHours } = calculateWeeklyOvertime(entries as any, payPeriod.startDate);
      const stat = statsByEmployee.get(empId)!;
      stat.regularHours += regularHours;
      stat.overtimeHours += overtimeHours;
    }

    for (const p of allPtoEntries) {
      const stat = statsByEmployee.get(p.employeeId)!;
      stat.ptoHours += parseFloat(p.hours as any);
    }

    for (const m of allMiscEntries) {
      const stat = statsByEmployee.get(m.employeeId)!;
      const hrs = parseFloat(m.hours as any);
      if (m.entryType === 'holiday') stat.holidayHours += hrs;
      else if (m.entryType === 'holiday-worked') stat.holidayWorkedHours += hrs;
      else stat.miscHours += hrs;
    }

    for (const r of allReimbEntries) {
      const stat = statsByEmployee.get(r.employeeId)!;
      stat.reimbursements += parseFloat(r.amount as any);
      const mileageMatch = r.description?.match(/Mileage: (\d+(?:\.\d+)?) miles/);
      if (mileageMatch) {
        stat.mileage += parseFloat(mileageMatch[1]) || 0;
      }
    }

    const results = [] as any[];
    for (const [empId, stat] of Array.from(statsByEmployee.entries())) {
      results.push({
        employeeId: empId,
        totalHours: Math.round((stat.regularHours + stat.overtimeHours + stat.miscHours) * 100) / 100,
        totalOvertimeHours: Math.round(stat.overtimeHours * 100) / 100,
        ptoHours: Math.round(stat.ptoHours * 100) / 100,
        holidayHours: Math.round(stat.holidayHours * 100) / 100,
        holidayWorkedHours: Math.round(stat.holidayWorkedHours * 100) / 100,
        miscHours: Math.round(stat.miscHours * 100) / 100,
        mileage: Math.round(stat.mileage * 100) / 100,
        reimbursements: Math.round(stat.reimbursements * 100) / 100,
        timecardCount: 0,
        approvedCount: 0,
      });
    }

    return results;
  }
}

export const storage = new DatabaseStorage();
