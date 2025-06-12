import {
  users,
  employers,
  employees,
  payPeriods,
  timecards,
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
  type Reimbursement,
  type InsertReimbursement,
  type Report,
  type InsertReport,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, gte, lte, sql } from "drizzle-orm";

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
    const employeeData = {
      ...employee,
      mileageRate: employee.mileageRate?.toString() || "0.655"
    };
    const [newEmployee] = await db.insert(employees).values(employeeData).returning();
    return newEmployee;
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
    const updateData: any = { ...employee };
    if (employee.mileageRate !== undefined) {
      updateData.mileageRate = employee.mileageRate.toString();
    }
    const [updated] = await db
      .update(employees)
      .set(updateData)
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
    return await db
      .select()
      .from(payPeriods)
      .where(eq(payPeriods.employerId, employerId))
      .orderBy(desc(payPeriods.startDate));
  }

  async getCurrentPayPeriod(employerId: number): Promise<PayPeriod | undefined> {
    // First ensure pay periods exist for the current date
    await this.ensurePayPeriodsExist(employerId);
    
    const today = new Date().toISOString().split('T')[0];
    const [current] = await db
      .select()
      .from(payPeriods)
      .where(
        and(
          eq(payPeriods.employerId, employerId),
          lte(payPeriods.startDate, today),
          gte(payPeriods.endDate, today)
        )
      )
      .limit(1);
    return current;
  }

  async ensurePayPeriodsExist(employerId: number): Promise<void> {
    const employer = await this.getEmployer(employerId);
    let startDate: Date;
    
    if (!employer?.payPeriodStartDate) {
      console.warn(`Employer ${employerId} missing pay_period_start_date, defaulting to today`);
      startDate = new Date();
    } else {
      startDate = new Date(employer.payPeriodStartDate);
    }

    const today = new Date();
    
    // Get the latest pay period for this employer
    const [latestPayPeriod] = await db
      .select()
      .from(payPeriods)
      .where(eq(payPeriods.employerId, employerId))
      .orderBy(desc(payPeriods.endDate))
      .limit(1);

    let currentStart: Date;
    if (latestPayPeriod) {
      // Start from the day after the latest pay period ends
      currentStart = new Date(latestPayPeriod.endDate);
      currentStart.setDate(currentStart.getDate() + 1);
    } else {
      // No pay periods exist, start from the configured start date
      currentStart = new Date(startDate);
    }

    // Generate pay periods up to a few weeks into the future
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + 21); // 3 weeks ahead

    const payPeriodsToCreate = [];
    while (currentStart <= futureDate) {
      const endDate = new Date(currentStart);
      endDate.setDate(endDate.getDate() + 13); // 14 days total (0-13 = 14 days)

      payPeriodsToCreate.push({
        employerId,
        startDate: currentStart.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        isActive: false
      });

      // Move to next pay period
      currentStart = new Date(endDate);
      currentStart.setDate(currentStart.getDate() + 1);
    }

    if (payPeriodsToCreate.length > 0) {
      console.log(`Creating ${payPeriodsToCreate.length} pay periods for employer ${employerId}:`, payPeriodsToCreate);
      await db.insert(payPeriods).values(payPeriodsToCreate);
    } else {
      console.log(`No pay periods to create for employer ${employerId}. Start: ${currentStart.toISOString()}, Future: ${futureDate.toISOString()}`);
    }
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
