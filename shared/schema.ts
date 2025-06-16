import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  decimal,
  integer,
  date,
  time,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (mandatory for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Employers table for multi-employer support
export const employers = pgTable("employers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  taxId: varchar("tax_id", { length: 50 }),
  payPeriodStartDate: date("pay_period_start_date"),
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Employees table
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  position: varchar("position", { length: 100 }),
  mileageRate: decimal("mileage_rate", { precision: 10, scale: 4 }).default("0.655"), // IRS standard rate
  isActive: boolean("is_active").default(true),
  employerId: integer("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pay periods table
export const payPeriods = pgTable("pay_periods", {
  id: serial("id").primaryKey(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  isActive: boolean("is_active").default(false),
  employerId: integer("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Timecards table
export const timecards = pgTable("timecards", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  payPeriodId: integer("pay_period_id").notNull().references(() => payPeriods.id, { onDelete: "cascade" }),
  workDate: date("work_date").notNull(),
  timeIn: time("time_in"),
  timeOut: time("time_out"),
  lunchMinutes: integer("lunch_minutes").default(0),
  regularHours: decimal("regular_hours", { precision: 5, scale: 2 }).default("0"),
  overtimeHours: decimal("overtime_hours", { precision: 5, scale: 2 }).default("0"),
  ptoHours: decimal("pto_hours", { precision: 5, scale: 2 }).default("0"),
  holidayHours: decimal("holiday_hours", { precision: 5, scale: 2 }).default("0"),
  startOdometer: integer("start_odometer"),
  endOdometer: integer("end_odometer"),
  totalMiles: integer("total_miles").default(0),
  notes: text("notes"),
  isApproved: boolean("is_approved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reimbursements table
export const reimbursements = pgTable("reimbursements", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  payPeriodId: integer("pay_period_id").notNull().references(() => payPeriods.id, { onDelete: "cascade" }),
  description: varchar("description", { length: 255 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  category: varchar("category", { length: 100 }),
  receiptUrl: varchar("receipt_url", { length: 500 }),
  isApproved: boolean("is_approved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Reports table for storing generated reports
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  employerId: integer("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  payPeriodId: integer("pay_period_id").references(() => payPeriods.id),
  reportType: varchar("report_type", { length: 100 }).notNull(), // 'payroll_summary', 'detailed_timecard', etc.
  format: varchar("format", { length: 20 }).notNull(), // 'pdf', 'excel'
  fileName: varchar("file_name", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }),
  generatedBy: varchar("generated_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod schemas
export const insertEmployerSchema = createInsertSchema(employers).omit({
  id: true,
  createdAt: true,
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
  createdAt: true,
}).extend({
  mileageRate: z.coerce.number().min(0).max(5).default(0.655),
});

export const insertPayPeriodSchema = createInsertSchema(payPeriods).omit({
  id: true,
  createdAt: true,
});

export const insertTimecardSchema = createInsertSchema(timecards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReimbursementSchema = createInsertSchema(reimbursements).omit({
  id: true,
  createdAt: true,
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertEmployer = z.infer<typeof insertEmployerSchema>;
export type Employer = typeof employers.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;
export type InsertPayPeriod = z.infer<typeof insertPayPeriodSchema>;
export type PayPeriod = typeof payPeriods.$inferSelect;
export type InsertTimecard = z.infer<typeof insertTimecardSchema>;
export type Timecard = typeof timecards.$inferSelect;
export type InsertReimbursement = z.infer<typeof insertReimbursementSchema>;
export type Reimbursement = typeof reimbursements.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reports.$inferSelect;
