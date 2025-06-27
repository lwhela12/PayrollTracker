import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  insertEmployerSchema,
  insertEmployeeSchema,
  insertPayPeriodSchema,
  insertTimecardSchema,
  insertTimeEntrySchema,
  insertPtoEntrySchema,
  insertReimbursementEntrySchema,
  insertMiscHoursEntrySchema,
  insertReimbursementSchema,
  payPeriods
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import multer from "multer";
import fs from "fs";
import path from "path";
import { db } from "./db";
import { eq } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Employer routes
  app.post('/api/employers', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const employerData = insertEmployerSchema.parse({ ...req.body, ownerId: userId });
      const employer = await storage.createEmployer(employerData);
      res.json(employer);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error creating employer:", error);
      res.status(500).json({ message: "Failed to create employer" });
    }
  });

  app.get('/api/employers', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const employers = await storage.getEmployersByOwner(userId);
      res.json(employers);
    } catch (error) {
      console.error("Error fetching employers:", error);
      res.status(500).json({ message: "Failed to fetch employers" });
    }
  });

  app.get('/api/employers/:id', isAuthenticated, async (req: any, res) => {
    try {
      const employerId = parseInt(req.params.id);
      const employer = await storage.getEmployer(employerId);
      
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Employer not found" });
      }
      
      res.json(employer);
    } catch (error) {
      console.error("Error fetching employer:", error);
      res.status(500).json({ message: "Failed to fetch employer" });
    }
  });

  app.put('/api/employers/:id', isAuthenticated, async (req: any, res) => {
    try {
      const employerId = parseInt(req.params.id);
      const employer = await storage.getEmployer(employerId);

      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updateData = insertEmployerSchema.partial().parse(req.body);
      const updated = await storage.updateEmployer(employerId, updateData);
      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error updating employer:", error);
      res.status(500).json({ message: "Failed to update employer" });
    }
  });

  // Employee routes
  app.post('/api/employees', isAuthenticated, async (req: any, res) => {
    try {
      const employeeData = insertEmployeeSchema.parse(req.body);
      
      // Verify employer ownership
      const employer = await storage.getEmployer(employeeData.employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const employee = await storage.createEmployee(employeeData);
      res.json(employee);
    } catch (error: any) {
      console.error("Full error creating employee:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({
          message: fromZodError(error).toString(),
          details: error.errors
        });
      }
      res.status(500).json({ message: "Failed to create employee" });
    }
  });

  app.get('/api/employees/:employerId', isAuthenticated, async (req: any, res) => {
    try {
      const employerId = parseInt(req.params.employerId);
      
      // Verify employer ownership
      const employer = await storage.getEmployer(employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const employees = await storage.getEmployeesByEmployer(employerId);
      res.json(employees);
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });

  app.put('/api/employees/:id', isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const employee = await storage.getEmployee(employeeId);
      
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      // Verify employer ownership
      const employer = await storage.getEmployer(employee.employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updateData = insertEmployeeSchema.partial().parse(req.body);
      const updated = await storage.updateEmployee(employeeId, updateData);
      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error updating employee:", error);
      res.status(500).json({ message: "Failed to update employee" });
    }
  });

  app.delete('/api/employees/:id', isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const employee = await storage.getEmployee(employeeId);
      
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      // Verify employer ownership
      const employer = await storage.getEmployer(employee.employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteEmployee(employeeId);
      res.json({ message: "Employee deleted successfully" });
    } catch (error) {
      console.error("Error deleting employee:", error);
      res.status(500).json({ message: "Failed to delete employee" });
    }
  });

  const upload = multer();
  app.post('/api/employees/import', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'Missing file' });
      const employerId = parseInt(req.body.employerId);
      if (!employerId) return res.status(400).json({ message: 'Missing employerId' });
      const employer = await storage.getEmployer(employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: 'Access denied' });
      }
      const text = req.file.buffer.toString();
      const lines = text.trim().split(/\r?\n/).slice(1); // skip header
      const existing = await storage.getEmployeesByEmployer(employerId);
      const errors: any[] = [];
      const toInsert: any[] = [];
      lines.forEach((line, idx) => {
        const cols = line.split(',').map((c) => c.trim());
        const data = {
          firstName: cols[0],
          lastName: cols[1],
          email: cols[2] || undefined,
          position: cols[3] || undefined,
          hireDate: cols[4],
          employerId,
        };
        try {
          insertEmployeeSchema.parse(data);
          if (existing.some(e => e.firstName === data.firstName && e.lastName === data.lastName)) {
            errors.push({ row: idx + 2, message: 'Employee already exists' });
          } else {
            toInsert.push(data);
          }
        } catch (e: any) {
          errors.push({ row: idx + 2, message: fromZodError(e).toString() });
        }
      });
      if (errors.length > 0) {
        return res.status(400).json({ errors });
      }
      const result = await storage.createMultipleEmployees(toInsert);
      res.json(result);
    } catch (error: any) {
      console.error('Error importing employees:', error);
      res.status(500).json({ message: 'Failed to import employees' });
    }
  });

  // Pay period routes
  app.post('/api/pay-periods', isAuthenticated, async (req: any, res) => {
    try {
      const payPeriodData = insertPayPeriodSchema.parse(req.body);
      
      // Verify employer ownership
      const employer = await storage.getEmployer(payPeriodData.employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const payPeriod = await storage.createPayPeriod(payPeriodData);
      res.json(payPeriod);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error creating pay period:", error);
      res.status(500).json({ message: "Failed to create pay period" });
    }
  });

  app.get('/api/pay-periods/:employerId', isAuthenticated, async (req: any, res) => {
    try {
      const employerId = parseInt(req.params.employerId);
      
      // Verify employer ownership
      const employer = await storage.getEmployer(employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const payPeriods = await storage.getPayPeriodsByEmployer(employerId);
      res.json(payPeriods);
    } catch (error) {
      console.error("Error fetching pay periods:", error);
      res.status(500).json({ message: "Failed to fetch pay periods" });
    }
  });

  app.get('/api/pay-periods/:employerId/current', isAuthenticated, async (req: any, res) => {
    try {
      const employerId = parseInt(req.params.employerId);
      
      // Verify employer ownership
      const employer = await storage.getEmployer(employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const currentPayPeriod = await storage.getCurrentPayPeriod(employerId);
      res.json(currentPayPeriod);
    } catch (error) {
      console.error("Error fetching current pay period:", error);
      res.status(500).json({ message: "Failed to fetch current pay period" });
    }
  });

  // Reset pay periods (for debugging Wednesday alignment)
  app.post('/api/pay-periods/:employerId/reset', isAuthenticated, async (req: any, res) => {
    try {
      const employerId = parseInt(req.params.employerId);
      
      // Verify employer ownership
      const employer = await storage.getEmployer(employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Delete existing pay periods for this employer through storage
      const existingPayPeriods = await storage.getPayPeriodsByEmployer(employerId);
      for (const pp of existingPayPeriods) {
        await db.delete(payPeriods).where(eq(payPeriods.id, pp.id));
      }
      
      // Regenerate pay periods with proper Wednesday alignment
      await storage.ensurePayPeriodsExist(employerId);
      
      // Get the current pay period
      const currentPayPeriod = await storage.getCurrentPayPeriod(employerId);
      res.json({ message: "Pay periods reset successfully", currentPayPeriod });
    } catch (error) {
      console.error("Error resetting pay periods:", error);
      res.status(500).json({ message: "Failed to reset pay periods" });
    }
  });

  // Create pay period route
  app.post('/api/pay-periods', isAuthenticated, async (req: any, res) => {
    try {
      const payPeriodData = insertPayPeriodSchema.parse(req.body);
      
      // Verify employer ownership
      const employer = await storage.getEmployer(payPeriodData.employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const payPeriod = await storage.createPayPeriod(payPeriodData);
      res.json(payPeriod);
    } catch (error: any) {
      console.error("Full error creating pay period:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({
          message: fromZodError(error).toString(),
          details: error.errors
        });
      }
      res.status(500).json({ message: "Failed to create pay period" });
    }
  });

  // Timecard routes
  app.post('/api/timecards', isAuthenticated, async (req: any, res) => {
    try {
      const timecardData = insertTimecardSchema.parse(req.body);
      
      // Verify employee belongs to user's employer
      const employee = await storage.getEmployee(timecardData.employeeId);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      const employer = await storage.getEmployer(employee.employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const timecard = await storage.createTimecard(timecardData);
      res.json(timecard);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error creating timecard:", error);
      res.status(500).json({ message: "Failed to create timecard" });
    }
  });

  app.get('/api/timecards/employee/:employeeId', isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = parseInt(req.params.employeeId);
      const payPeriodId = req.query.payPeriodId ? parseInt(req.query.payPeriodId as string) : undefined;
      
      // Verify employee belongs to user's employer
      const employee = await storage.getEmployee(employeeId);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      const employer = await storage.getEmployer(employee.employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const timecards = await storage.getTimecardsByEmployee(employeeId, payPeriodId);
      res.json(timecards);
    } catch (error) {
      console.error("Error fetching timecards:", error);
      res.status(500).json({ message: "Failed to fetch timecards" });
    }
  });

  app.get('/api/timecards/pay-period/:payPeriodId', isAuthenticated, async (req: any, res) => {
    try {
      const payPeriodId = parseInt(req.params.payPeriodId);
      
      // Verify pay period belongs to user's employer
      const payPeriod = await storage.getPayPeriod(payPeriodId);
      if (!payPeriod) {
        return res.status(404).json({ message: "Pay period not found" });
      }
      
      const employer = await storage.getEmployer(payPeriod.employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const timecards = await storage.getTimecardsByPayPeriod(payPeriodId);
      res.json(timecards);
    } catch (error) {
      console.error("Error fetching timecards:", error);
      res.status(500).json({ message: "Failed to fetch timecards" });
    }
  });

  // Get timecards for a specific employee
  app.get('/api/timecards/employee/:employeeId', isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = parseInt(req.params.employeeId);
      const payPeriodId = req.query.payPeriodId ? parseInt(req.query.payPeriodId) : undefined;
      
      // Verify employee belongs to user's employer
      const employee = await storage.getEmployee(employeeId);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      const employer = await storage.getEmployer(employee.employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const timecards = await storage.getTimecardsByEmployee(employeeId, payPeriodId);
      res.json(timecards);
    } catch (error) {
      console.error("Error fetching employee timecards:", error);
      res.status(500).json({ message: "Failed to fetch employee timecards" });
    }
  });

  app.put('/api/timecards/:id', isAuthenticated, async (req: any, res) => {
    try {
      const timecardId = parseInt(req.params.id);
      const timecard = await storage.getTimecard(timecardId);
      
      if (!timecard) {
        return res.status(404).json({ message: "Timecard not found" });
      }
      
      // Verify timecard belongs to user's employer
      const employee = await storage.getEmployee(timecard.employeeId);
      const employer = await storage.getEmployer(employee!.employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updateData = insertTimecardSchema.partial().parse(req.body);
      const updated = await storage.updateTimecard(timecardId, updateData);
      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error updating timecard:", error);
      res.status(500).json({ message: "Failed to update timecard" });
    }
  });

  // Time entry routes
  app.post('/api/time-entries', isAuthenticated, async (req: any, res) => {
    try {
      const entryData = insertTimeEntrySchema.parse(req.body);
      const employee = await storage.getEmployee(entryData.employeeId);
      if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
      }
      const employer = await storage.getEmployer(employee.employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: 'Access denied' });
      }
      const entry = await storage.createTimeEntry(entryData);
      res.json(entry);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error('Error creating time entry:', error);
      res.status(500).json({ message: 'Failed to create time entry' });
    }
  });

  app.get('/api/time-entries/employee/:employeeId', isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = parseInt(req.params.employeeId);
      const employee = await storage.getEmployee(employeeId);
      if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
      }
      const employer = await storage.getEmployer(employee.employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: 'Access denied' });
      }
      const { start, end } = req.query as any;
      const entries = await storage.getTimeEntriesByEmployee(employeeId, start, end);
      res.json(entries);
    } catch (error) {
      console.error('Error fetching time entries:', error);
      res.status(500).json({ message: 'Failed to fetch time entries' });
    }
  });

  app.put('/api/time-entries/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const entry = await storage.updateTimeEntry(id, insertTimeEntrySchema.partial().parse(req.body));
      res.json(entry);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error('Error updating time entry:', error);
      res.status(500).json({ message: 'Failed to update time entry' });
    }
  });

  app.delete('/api/time-entries/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTimeEntry(id);
      res.json({ message: 'Deleted' });
    } catch (error) {
      console.error('Error deleting time entry:', error);
      res.status(500).json({ message: 'Failed to delete time entry' });
    }
  });

  // PTO entry routes
  app.post('/api/pto-entries', isAuthenticated, async (req: any, res) => {
    try {
      const data = insertPtoEntrySchema.parse(req.body);
      const employee = await storage.getEmployee(data.employeeId);
      if (!employee) return res.status(404).json({ message: 'Employee not found' });
      const employer = await storage.getEmployer(employee.employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) return res.status(403).json({ message: 'Access denied' });
      const entry = await storage.createPtoEntry(data);
      res.json(entry);
    } catch (error: any) {
      if (error.name === 'ZodError') return res.status(400).json({ message: fromZodError(error).toString() });
      console.error('Error creating PTO entry:', error);
      res.status(500).json({ message: 'Failed to create PTO entry' });
    }
  });

  app.get('/api/pto-entries/employee/:employeeId', isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = parseInt(req.params.employeeId);
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(404).json({ message: 'Employee not found' });
      const employer = await storage.getEmployer(employee.employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) return res.status(403).json({ message: 'Access denied' });
      const entries = await storage.getPtoEntriesByEmployee(employeeId);
      res.json(entries);
    } catch (error) {
      console.error('Error fetching PTO entries:', error);
      res.status(500).json({ message: 'Failed to fetch PTO entries' });
    }
  });

  app.put('/api/pto-entries/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const entry = await storage.updatePtoEntry(id, insertPtoEntrySchema.partial().parse(req.body));
      res.json(entry);
    } catch (error: any) {
      if (error.name === 'ZodError') return res.status(400).json({ message: fromZodError(error).toString() });
      console.error('Error updating PTO entry:', error);
      res.status(500).json({ message: 'Failed to update PTO entry' });
    }
  });

  app.delete('/api/pto-entries/:id', isAuthenticated, async (req: any, res) => {
    try {
      await storage.deletePtoEntry(parseInt(req.params.id));
      res.json({ message: 'Deleted' });
    } catch (error) {
      console.error('Error deleting PTO entry:', error);
      res.status(500).json({ message: 'Failed to delete PTO entry' });
    }
  });

  // Reimbursement entry routes
  app.post('/api/reimbursement-entries', isAuthenticated, async (req: any, res) => {
    try {
      const data = insertReimbursementEntrySchema.parse(req.body);
      const employee = await storage.getEmployee(data.employeeId);
      if (!employee) return res.status(404).json({ message: 'Employee not found' });
      const employer = await storage.getEmployer(employee.employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) return res.status(403).json({ message: 'Access denied' });
      const entry = await storage.createReimbursementEntry(data);
      res.json(entry);
    } catch (error: any) {
      if (error.name === 'ZodError') return res.status(400).json({ message: fromZodError(error).toString() });
      console.error('Error creating reimbursement entry:', error);
      res.status(500).json({ message: 'Failed to create reimbursement entry' });
    }
  });

  app.get('/api/reimbursement-entries/employee/:employeeId', isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = parseInt(req.params.employeeId);
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(404).json({ message: 'Employee not found' });
      const employer = await storage.getEmployer(employee.employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) return res.status(403).json({ message: 'Access denied' });
      const entries = await storage.getReimbursementEntriesByEmployee(employeeId);
      res.json(entries);
    } catch (error) {
      console.error('Error fetching reimbursement entries:', error);
      res.status(500).json({ message: 'Failed to fetch reimbursement entries' });
    }
  });

  app.put('/api/reimbursement-entries/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const entry = await storage.updateReimbursementEntry(id, insertReimbursementEntrySchema.partial().parse(req.body));
      res.json(entry);
    } catch (error: any) {
      if (error.name === 'ZodError') return res.status(400).json({ message: fromZodError(error).toString() });
      console.error('Error updating reimbursement entry:', error);
      res.status(500).json({ message: 'Failed to update reimbursement entry' });
    }
  });

  app.delete('/api/reimbursement-entries/:id', isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteReimbursementEntry(parseInt(req.params.id));
      res.json({ message: 'Deleted' });
    } catch (error) {
      console.error('Error deleting reimbursement entry:', error);
      res.status(500).json({ message: 'Failed to delete reimbursement entry' });
    }
  });

  // Misc hours entry routes
  app.post('/api/misc-hours-entries', isAuthenticated, async (req: any, res) => {
    try {
      const data = insertMiscHoursEntrySchema.parse(req.body);
      const employee = await storage.getEmployee(data.employeeId);
      if (!employee) return res.status(404).json({ message: 'Employee not found' });
      const employer = await storage.getEmployer(employee.employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) return res.status(403).json({ message: 'Access denied' });
      const entry = await storage.createMiscHoursEntry(data);
      res.json(entry);
    } catch (error: any) {
      if (error.name === 'ZodError') return res.status(400).json({ message: fromZodError(error).toString() });
      console.error('Error creating misc hours entry:', error);
      res.status(500).json({ message: 'Failed to create misc hours entry' });
    }
  });

  app.get('/api/misc-hours-entries/employee/:employeeId', isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = parseInt(req.params.employeeId);
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(404).json({ message: 'Employee not found' });
      const employer = await storage.getEmployer(employee.employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) return res.status(403).json({ message: 'Access denied' });
      const entries = await storage.getMiscHoursEntriesByEmployee(employeeId);
      res.json(entries);
    } catch (error) {
      console.error('Error fetching misc hours entries:', error);
      res.status(500).json({ message: 'Failed to fetch misc hours entries' });
    }
  });

  app.put('/api/misc-hours-entries/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const entry = await storage.updateMiscHoursEntry(id, insertMiscHoursEntrySchema.partial().parse(req.body));
      res.json(entry);
    } catch (error: any) {
      if (error.name === 'ZodError') return res.status(400).json({ message: fromZodError(error).toString() });
      console.error('Error updating misc hours entry:', error);
      res.status(500).json({ message: 'Failed to update misc hours entry' });
    }
  });

  app.delete('/api/misc-hours-entries/:id', isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteMiscHoursEntry(parseInt(req.params.id));
      res.json({ message: 'Deleted' });
    } catch (error) {
      console.error('Error deleting misc hours entry:', error);
      res.status(500).json({ message: 'Failed to delete misc hours entry' });
    }
  });

  // Reimbursement routes
  app.post('/api/reimbursements', isAuthenticated, async (req: any, res) => {
    try {
      const reimbursementData = insertReimbursementSchema.parse(req.body);
      
      // Verify employee belongs to user's employer
      const employee = await storage.getEmployee(reimbursementData.employeeId);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      const employer = await storage.getEmployer(employee.employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const reimbursement = await storage.createReimbursement(reimbursementData);
      res.json(reimbursement);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error creating reimbursement:", error);
      res.status(500).json({ message: "Failed to create reimbursement" });
    }
  });

  // Dashboard stats endpoint
  app.get('/api/dashboard/stats/:employerId', isAuthenticated, async (req: any, res) => {
    try {
      const employerId = parseInt(req.params.employerId);
      
      // Verify employer ownership
      const employer = await storage.getEmployer(employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const employees = await storage.getEmployeesByEmployer(employerId);
      const currentPayPeriod = await storage.getCurrentPayPeriod(employerId);

      let employeeStats: any[] = [];
      let totalHours = 0;
      let pendingTimecards = 0;
      let payrollReady = 0;

      if (currentPayPeriod) {
        const timecards = await storage.getTimecardsByPayPeriod(currentPayPeriod.id);
        const reimbursements = await storage.getReimbursementsByPayPeriod(currentPayPeriod.id);

        for (const emp of employees) {
          const empTimecards = timecards.filter(tc => tc.employeeId === emp.id);
          const empReimbs = reimbursements.filter(r => r.employeeId === emp.id);

          const empTotalHours = empTimecards.reduce((sum, tc) =>
            sum + parseFloat(tc.regularHours || '0') + parseFloat(tc.overtimeHours || '0'),
          0);
          const empOvertimeHours = empTimecards.reduce(
            (sum, tc) => sum + parseFloat(tc.overtimeHours || '0'),
            0
          );
          const empPto = empTimecards.reduce((sum, tc) => sum + parseFloat(tc.ptoHours || '0'), 0);
          const empMiles = empTimecards.reduce((sum, tc) => sum + (tc.totalMiles || 0), 0);
          const empReimbAmt = empReimbs.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0);

          totalHours += empTotalHours;

          if (empTimecards.length === 0) {
            pendingTimecards++;
          } else if (empTimecards.every(tc => tc.isApproved)) {
            payrollReady++;
          }

          employeeStats.push({
            employeeId: emp.id,
            totalHours: Number(empTotalHours.toFixed(2)),
            totalOvertimeHours: Number(empOvertimeHours.toFixed(2)),
            ptoHours: Number(empPto.toFixed(2)),
            mileage: empMiles,
            reimbursements: Number(empReimbAmt.toFixed(2))
          });
        }
      }

      const stats = {
        totalEmployees: employees.length,
        pendingTimecards,
        totalHours: Number(totalHours.toFixed(1)),
        payrollReady,
        currentPayPeriod,
        employeeStats,
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Report generation routes
  app.post('/api/reports/generate', isAuthenticated, async (req: any, res) => {
    try {
      const { employerId, payPeriodId, reportType, format } = req.body;
      
      // Verify employer ownership
      const employer = await storage.getEmployer(employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const payPeriod = await storage.getPayPeriod(payPeriodId);
      if (!payPeriod) {
        return res.status(404).json({ message: "Pay period not found" });
      }
      
      const employees = await storage.getEmployeesByEmployer(employerId);
      const timecards = await storage.getTimecardsByPayPeriod(payPeriodId);
      
      const fileName = `${reportType}_${payPeriod.startDate}_${payPeriod.endDate}.${format}`;
      const filePath = path.join(process.cwd(), 'reports', fileName);
      
      // Ensure reports directory exists
      const reportsDir = path.dirname(filePath);
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      
      if (format === 'pdf') {
        await generatePDFReport(employer, payPeriod, employees, timecards, filePath);
      } else if (format === 'excel') {
        await generateExcelReport(employer, payPeriod, employees, timecards, filePath);
      }
      
      // Save report record
      const report = await storage.createReport({
        employerId,
        payPeriodId,
        reportType,
        format,
        fileName,
        filePath,
        generatedBy: req.user.claims.sub,
      });
      
      res.json({ 
        message: "Report generated successfully",
        report,
        downloadUrl: `/api/reports/download/${report.id}`
      });
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  app.get('/api/reports/top-sheet', isAuthenticated, async (req: any, res) => {
    try {
      const employerId = parseInt(req.query.employerId);
      const payPeriodId = parseInt(req.query.payPeriodId);
      if (!employerId || !payPeriodId) {
        return res.status(400).json({ message: 'Missing parameters' });
      }

      const employer = await storage.getEmployer(employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const payPeriod = await storage.getPayPeriod(payPeriodId);
      if (!payPeriod || payPeriod.employerId !== employerId) {
        return res.status(404).json({ message: 'Pay period not found' });
      }

      const employees = await storage.getEmployeesByEmployer(employerId);
      const rows: any[] = [];
      const totals = {
        regularHours: 0,
        overtimeHours: 0,
        ptoHours: 0,
        holidayNonWorkedHours: 0,
        holidayWorkedHours: 0,
        reimbursement: 0,
      };

      for (const emp of employees) {
        const timecards = await storage.getTimecardsByEmployee(emp.id, payPeriodId);
        let reg = 0, ot = 0;
        for (const tc of timecards) {
          reg += parseFloat(tc.regularHours || '0');
          ot += parseFloat(tc.overtimeHours || '0');
        }

        const ptoEntries = await storage.getPtoEntriesByEmployee(emp.id);
        const pto = ptoEntries.filter(p => p.entryDate >= payPeriod.startDate && p.entryDate <= payPeriod.endDate)
          .reduce((s, p) => s + parseFloat(p.hours as any), 0);

        const misc = await storage.getMiscHoursEntriesByEmployee(emp.id);
        const holidayWorked = misc.filter(m => m.entryType === 'holiday-worked' && m.entryDate >= payPeriod.startDate && m.entryDate <= payPeriod.endDate)
          .reduce((s, m) => s + parseFloat(m.hours as any), 0);
        const holidayNon = misc.filter(m => m.entryType !== 'holiday-worked' && m.entryDate >= payPeriod.startDate && m.entryDate <= payPeriod.endDate)
          .reduce((s, m) => s + parseFloat(m.hours as any), 0);

        const reimb = await storage.getReimbursementEntriesByEmployee(emp.id);
        const reimbTotal = reimb.filter(r => r.entryDate >= payPeriod.startDate && r.entryDate <= payPeriod.endDate)
          .reduce((s, r) => s + parseFloat(r.amount as any), 0);

        rows.push({
          id: emp.id,
          name: `${emp.firstName} ${emp.lastName}`,
          regularHours: reg,
          overtimeHours: ot,
          ptoHours: pto,
          holidayWorkedHours: holidayWorked,
          holidayNonWorkedHours: holidayNon,
          reimbursement: reimbTotal,
        });

        totals.regularHours += reg;
        totals.overtimeHours += ot;
        totals.ptoHours += pto;
        totals.holidayWorkedHours += holidayWorked;
        totals.holidayNonWorkedHours += holidayNon;
        totals.reimbursement += reimbTotal;
      }

      res.json({ rows, totals });
    } catch (err) {
      console.error('Error generating top sheet:', err);
      res.status(500).json({ message: 'Failed to generate report' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper functions for report generation
async function generatePDFReport(employer: any, payPeriod: any, employees: any[], timecards: any[], filePath: string) {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(filePath));
  
  // Header
  doc.fontSize(20).text('Payroll Report', 50, 50);
  doc.fontSize(14).text(`Company: ${employer.name}`, 50, 80);
  doc.text(`Pay Period: ${payPeriod.startDate} to ${payPeriod.endDate}`, 50, 100);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 50, 120);
  
  // Employee summary
  let yPos = 160;
  doc.fontSize(16).text('Employee Summary', 50, yPos);
  yPos += 30;
  
  const employeeHours = new Map();
  timecards.forEach(tc => {
    if (!employeeHours.has(tc.employeeId)) {
      employeeHours.set(tc.employeeId, { regular: 0, overtime: 0, total: 0 });
    }
    const hours = employeeHours.get(tc.employeeId);
    hours.regular += parseFloat(tc.regularHours || '0');
    hours.overtime += parseFloat(tc.overtimeHours || '0');
    hours.total = hours.regular + hours.overtime;
  });
  
  employees.forEach(emp => {
    const hours = employeeHours.get(emp.id) || { regular: 0, overtime: 0, total: 0 };
    doc.fontSize(12).text(`${emp.firstName} ${emp.lastName}`, 50, yPos);
    doc.text(`Regular: ${hours.regular.toFixed(2)}h`, 200, yPos);
    doc.text(`Overtime: ${hours.overtime.toFixed(2)}h`, 300, yPos);
    doc.text(`Total: ${hours.total.toFixed(2)}h`, 400, yPos);
    yPos += 20;
    
    if (yPos > 700) {
      doc.addPage();
      yPos = 50;
    }
  });
  
  doc.end();
}

async function generateExcelReport(employer: any, payPeriod: any, employees: any[], timecards: any[], filePath: string) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Payroll Report');
  
  // Headers
  worksheet.addRow(['Payroll Report']);
  worksheet.addRow([`Company: ${employer.name}`]);
  worksheet.addRow([`Pay Period: ${payPeriod.startDate} to ${payPeriod.endDate}`]);
  worksheet.addRow([`Generated: ${new Date().toLocaleDateString()}`]);
  worksheet.addRow([]);
  
  // Employee data headers
  worksheet.addRow(['Employee ID', 'First Name', 'Last Name', 'Department', 'Regular Hours', 'Overtime Hours', 'Total Hours', 'Total Miles']);
  
  // Employee data
  const employeeStats = new Map();
  timecards.forEach(tc => {
    if (!employeeStats.has(tc.employeeId)) {
      employeeStats.set(tc.employeeId, { regular: 0, overtime: 0, miles: 0 });
    }
    const stats = employeeStats.get(tc.employeeId);
    stats.regular += parseFloat(tc.regularHours || '0');
    stats.overtime += parseFloat(tc.overtimeHours || '0');
    stats.miles += parseInt(tc.totalMiles || '0');
  });
  
  employees.forEach(emp => {
    const stats = employeeStats.get(emp.id) || { regular: 0, overtime: 0, miles: 0 };
    worksheet.addRow([
      emp.employeeId,
      emp.firstName,
      emp.lastName,
      emp.department || '',
      stats.regular.toFixed(2),
      stats.overtime.toFixed(2),
      (stats.regular + stats.overtime).toFixed(2),
      stats.miles
    ]);
  });
  
  // Style the worksheet
  worksheet.getRow(1).font = { bold: true, size: 16 };
  worksheet.getRow(6).font = { bold: true };
  
  await workbook.xlsx.writeFile(filePath);
}
