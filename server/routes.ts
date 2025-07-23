import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { calculateWeeklyOvertime } from "./lib/payroll";
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
  payPeriods,
  timeEntries,
  ptoEntries,
  miscHoursEntries,
  reimbursementEntries
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import multer from "multer";
import { parseString } from "@fast-csv/parse";
import fs from "fs";
import path from "path";
import { db } from "./db";
import { eq, and, gte, lte } from "drizzle-orm";
import memoize from "memoizee";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Helper function to check if user has access to employer
  const hasAccessToEmployer = async (userId: string, employerId: number): Promise<boolean> => {
    const userEmployer = await storage.getUserEmployer(userId, employerId);
    return !!userEmployer;
  };

  // Helper function to get user role for employer
  const getUserRoleForEmployer = async (userId: string, employerId: number): Promise<string | undefined> => {
    return await storage.getUserRole(userId, employerId);
  };

  // Helper function to log user actions
  const logUserAction = async (userId: string, employerId: number, action: string, resourceType?: string, resourceId?: number, details?: any) => {
    try {
      await storage.createAuditLog({
        userId,
        employerId,
        action,
        resourceType,
        resourceId,
        details: details ? JSON.stringify(details) : null
      });
    } catch (error) {
      console.error('Failed to log user action:', error);
    }
  };

  // Remove memoization to prevent stale cache issues during timecard updates
  const getDashboardStatsCached = (employerId: number, payPeriodId: number) =>
    storage.getDashboardStats(employerId, payPeriodId);

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

  app.delete('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Delete all user's employers and associated data
      const employers = await storage.getEmployersByOwner(userId);
      for (const employer of employers) {
        await storage.deleteEmployer(employer.id);
      }
      
      // Delete the user account
      await storage.deleteUser(userId);
      
      // Clear the session
      req.logout(() => {
        res.json({ message: "Account deleted successfully" });
      });
    } catch (error) {
      console.error("Error deleting user account:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  // Employer routes
  app.post('/api/employers', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const employerData = insertEmployerSchema.parse({ ...req.body, ownerId: userId });
      const employer = await storage.createEmployer(employerData);
      
      // Automatically add creator as Admin to the new employer
      await storage.addUserToEmployer({
        userId,
        employerId: employer.id, 
        role: 'Admin'
      });

      await logUserAction(userId, employer.id, 'created_employer', 'employer', employer.id);
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
      // Get all employers the user has access to (both owned and invited)
      const employers = await storage.getEmployersByUser(userId);
      res.json(employers);
    } catch (error) {
      console.error("Error fetching employers:", error);
      res.status(500).json({ message: "Failed to fetch employers" });
    }
  });

  app.get('/api/employers/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const employerId = parseInt(req.params.id);
      const employer = await storage.getEmployer(employerId);

      if (!employer || !(await hasAccessToEmployer(userId, employerId))) {
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
      const userId = req.user.claims.sub;
      const employerId = parseInt(req.params.id);
      const employer = await storage.getEmployer(employerId);

      if (!employer || !(await hasAccessToEmployer(userId, employerId))) {
        return res.status(404).json({ message: "Employer not found" });
      }

      // Only admins can update employer settings
      const userRole = await getUserRoleForEmployer(userId, employerId);
      if (userRole !== 'Admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const updateData = insertEmployerSchema.partial().parse(req.body);
      const updated = await storage.updateEmployer(employerId, updateData);
      await logUserAction(userId, employerId, 'updated_employer', 'employer', employerId, updateData);
      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error updating employer:", error);
      res.status(500).json({ message: "Failed to update employer" });
    }
  });

  // Update employer with payroll date change and entry clearing
  app.put('/api/employers/:id/reset-payroll', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const employerId = parseInt(req.params.id);
      const employer = await storage.getEmployer(employerId);

      if (!employer || !(await hasAccessToEmployer(userId, employerId))) {
        return res.status(404).json({ message: "Employer not found" });
      }

      // Only admins can reset payroll
      const userRole = await getUserRoleForEmployer(userId, employerId);
      if (userRole !== 'Admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const updateData = insertEmployerSchema.partial().parse(req.body);

      // Update employer first
      const updated = await storage.updateEmployer(employerId, updateData);

      // Clear existing pay periods and regenerate
      await storage.clearAndRegeneratePayPeriods(employerId);
      await logUserAction(userId, employerId, 'reset_payroll', 'employer', employerId);

      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error updating employer with payroll reset:", error);
      res.status(500).json({ message: "Failed to update employer and reset payroll" });
    }
  });

  app.delete('/api/employers/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const employerId = parseInt(req.params.id);
      const employer = await storage.getEmployer(employerId);

      if (!employer || !(await hasAccessToEmployer(userId, employerId))) {
        return res.status(404).json({ message: "Employer not found" });
      }

      // Only admins can delete employers
      const userRole = await getUserRoleForEmployer(userId, employerId);
      if (userRole !== 'Admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      await logUserAction(userId, employerId, 'deleted_employer', 'employer', employerId);
      await storage.deleteEmployer(employerId);
      res.json({ message: 'Employer deleted successfully' });
    } catch (error) {
      console.error('Error deleting employer:', error);
      res.status(500).json({ message: 'Failed to delete employer' });
    }
  });

  // Multi-user management routes
  
  // Get team members for an employer
  app.get('/api/employers/:id/users', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const employerId = parseInt(req.params.id);
      
      if (!(await hasAccessToEmployer(userId, employerId))) {
        return res.status(404).json({ message: "Employer not found" });
      }

      const users = await storage.getUsersByEmployer(employerId);
      res.json(users);
    } catch (error) {
      console.error("Error fetching employer users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Invite user to employer (Admin only)
  app.post('/api/employers/:id/invite', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const employerId = parseInt(req.params.id);
      const { email, role = 'Employee' } = req.body;

      if (!(await hasAccessToEmployer(userId, employerId))) {
        return res.status(404).json({ message: "Employer not found" });
      }

      const userRole = await getUserRoleForEmployer(userId, employerId);
      if (userRole !== 'Admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if user is already invited or has access
      const existingInvite = await storage.getPendingInvitationByEmail(email, employerId);
      if (existingInvite) {
        return res.status(400).json({ message: "User already invited" });
      }

      // Create invitation that expires in 7 days
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await storage.createInvitation({
        email,
        employerId,
        invitedBy: userId,
        role,
        expiresAt
      });

      await logUserAction(userId, employerId, 'invited_user', 'invitation', invitation.id, { email, role });
      res.json({ message: "Invitation sent successfully", invitation });
    } catch (error) {
      console.error("Error creating invitation:", error);
      res.status(500).json({ message: "Failed to send invitation" });
    }
  });

  // Get pending invitations for employer (Admin only)
  app.get('/api/employers/:id/invitations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const employerId = parseInt(req.params.id);

      if (!(await hasAccessToEmployer(userId, employerId))) {
        return res.status(404).json({ message: "Employer not found" });
      }

      const userRole = await getUserRoleForEmployer(userId, employerId);
      if (userRole !== 'Admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const invitations = await storage.getPendingInvitationsByEmployer(employerId);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  // Accept invitation (called when user with pending invitation logs in)
  app.post('/api/invitations/:id/accept', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const invitationId = parseInt(req.params.id);

      const userEmployer = await storage.acceptInvitation(invitationId, userId);
      await logUserAction(userId, userEmployer.employerId, 'accepted_invitation', 'user_employer', userEmployer.id);
      
      res.json({ message: "Invitation accepted successfully", userEmployer });
    } catch (error) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  // Remove user from employer (Admin only)
  app.delete('/api/employers/:id/users/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub;
      const employerId = parseInt(req.params.id);
      const targetUserId = req.params.userId;

      if (!(await hasAccessToEmployer(currentUserId, employerId))) {
        return res.status(404).json({ message: "Employer not found" });
      }

      const userRole = await getUserRoleForEmployer(currentUserId, employerId);
      if (userRole !== 'Admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Can't remove yourself if you're the only admin
      if (currentUserId === targetUserId) {
        const users = await storage.getUsersByEmployer(employerId);
        const adminCount = users.filter(u => u.role === 'Admin').length;
        if (adminCount <= 1) {
          return res.status(400).json({ message: "Cannot remove the only admin" });
        }
      }

      await storage.removeUserFromEmployer(targetUserId, employerId);
      await logUserAction(currentUserId, employerId, 'removed_user', 'user_employer', undefined, { removedUserId: targetUserId });
      
      res.json({ message: "User removed successfully" });
    } catch (error) {
      console.error("Error removing user:", error);
      res.status(500).json({ message: "Failed to remove user" });
    }
  });

  // Get audit log for employer (Admin only)
  app.get('/api/employers/:id/audit-log', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const employerId = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string) || 100;

      if (!(await hasAccessToEmployer(userId, employerId))) {
        return res.status(404).json({ message: "Employer not found" });
      }

      const userRole = await getUserRoleForEmployer(userId, employerId);
      if (userRole !== 'Admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const auditLogs = await storage.getAuditLogsByEmployer(employerId, limit);
      res.json(auditLogs);
    } catch (error) {
      console.error("Error fetching audit log:", error);
      res.status(500).json({ message: "Failed to fetch audit log" });
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
      const employerId = parseInt(req.body.employerId);
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Verify employer ownership
      const employer = await storage.getEmployer(employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }

      const csvData = req.file.buffer.toString();
      const employees: any[] = [];

      await new Promise<void>((resolve, reject) => {
        parseString(csvData, { 
          headers: true,
          trim: true
        })
          .on('error', reject)
          .on('data', (row: any) => {
            // Handle the format: Pay Group,Name,Hire Date
            if (row.Name && row.Name.trim()) {
              // Parse the name field which contains "LastName,FirstName" format
              const nameParts = row.Name.split(',');
              let firstName = '';
              let lastName = '';

              if (nameParts.length >= 2) {
                lastName = nameParts[0].trim();
                firstName = nameParts[1].trim();
              } else {
                // Fallback if name doesn't contain comma
                const spaceParts = row.Name.trim().split(' ');
                firstName = spaceParts[0] || '';
                lastName = spaceParts.slice(1).join(' ') || '';
              }

              // Parse hire date from M/D/YYYY format to YYYY-MM-DD
              let hireDate = new Date().toISOString().split('T')[0];
              if (row['Hire Date']) {
                try {
                  const dateParts = row['Hire Date'].split('/');
                  if (dateParts.length === 3) {
                    const month = dateParts[0].padStart(2, '0');
                    const day = dateParts[1].padStart(2, '0');
                    const year = dateParts[2];
                    hireDate = `${year}-${month}-${day}`;
                  }
                } catch (dateError) {
                  console.warn('Could not parse hire date:', row['Hire Date']);
                }
              }

              employees.push({
                firstName,
                lastName,
                email: undefined, // Not provided in this CSV format
                position: row['Pay Group'] || undefined,
                hireDate,
                employerId,
              });
            }
          })
          .on('end', () => resolve());
      });

      const result = await storage.createMultipleEmployees(employees);
      res.json({ 
        message: `Successfully imported ${result.success} employees${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
        ...result 
      });
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

  app.get('/api/pay-periods/:employerId/relevant', isAuthenticated, async (req: any, res) => {
    try {
      const employerId = parseInt(req.params.employerId);
      const date = req.query.date ? new Date(req.query.date as string) : new Date();

      // Verify employer ownership
      const employer = await storage.getEmployer(employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }

      const relevantPayPeriods = await storage.getRelevantPayPeriods(employerId, date);
      res.json(relevantPayPeriods);
    } catch (error) {
      console.error("Error fetching relevant pay periods:", error);
      res.status(500).json({ message: "Failed to fetch relevant pay periods" });
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

  app.post('/api/timecards/bulk-update', isAuthenticated, async (req: any, res) => {
    try {
      const {
        employeeId,
        payPeriod,
        days,
        ptoHours,
        holidayNonWorked,
        holidayWorked,
        milesDriven,
        miscHours,
        reimbursement,
        notes
      } = req.body;

      // Validate employee access
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(404).json({ message: 'Employee not found' });

      const employer = await storage.getEmployer(employee.employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get or create pay period
      const startDate = new Date(payPeriod.start);
      const endDate = new Date(payPeriod.end);
      let period = await storage.getPayPeriodByDates(employee.employerId, startDate, endDate);
      if (!period) {
        period = await storage.createPayPeriod({
          employerId: employee.employerId,
          startDate: payPeriod.start,
          endDate: payPeriod.end,
        });
      }

      // Use batch operations for better performance
      await storage.bulkUpdateTimecardData({
        employeeId,
        payPeriodId: period.id,
        payPeriodStart: payPeriod.start,
        payPeriodEnd: payPeriod.end,
        days,
        ptoHours,
        holidayNonWorked,
        holidayWorked,
        milesDriven,
        miscHours,
        reimbursement,
        employer
      });

      // Force garbage collection if available to clean up any residual cache
      if (global.gc) {
        global.gc();
      }

      res.json({ message: 'Updated' });
    } catch (error) {
      console.error('Bulk update error:', error);
      res.status(500).json({ message: 'Failed to update timecard data' });
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

app.get("/api/dashboard/stats/:employerId", async (req, res) => {
    try {
      const employerId = parseInt(req.params.employerId);
      const payPeriodId = req.query.payPeriodId ? parseInt(req.query.payPeriodId as string) : null;

      // Get the current or specified pay period
      let payPeriod;
      if (payPeriodId) {
        payPeriod = await storage.getPayPeriod(payPeriodId);
      } else {
        payPeriod = await storage.getCurrentPayPeriod(employerId);
      }

      if (!payPeriod) {
        return res.status(404).json({ error: "No pay period found" });
      }

      const employees = await storage.getEmployeesByEmployer(employerId);
      const employeeStats = await getDashboardStatsCached(employerId, payPeriod.id);

      let totalHours = 0;
      let pendingTimecards = 0;
      let payrollReady = 0;

      employeeStats.forEach(stat => {
        if (stat.totalHours === 0 && stat.ptoHours === 0 && stat.holidayHours === 0 && stat.holidayWorkedHours === 0) {
          pendingTimecards++;
        }

        totalHours += stat.totalHours;
      });

      res.json({
        totalEmployees: employees.length,
        pendingTimecards,
        totalHours: Number(totalHours.toFixed(1)),
        payrollReady,
        currentPayPeriod: await storage.getCurrentPayPeriod(employerId),
        employeeStats
      });
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

      let timecardData: any[] = [];

      for (const emp of employees) {
        const timeEntries = await storage.getTimeEntriesByEmployee(emp.id, payPeriod.startDate, payPeriod.endDate);
        const { regularHours, overtimeHours } = calculateWeeklyOvertime(timeEntries, payPeriod.startDate);
        timecardData.push({
          employeeId: emp.id,
          regularHours,
          overtimeHours,
          timeEntries
        });
      }

      const fileExtension = format === 'excel' ? 'xlsx' : format;
      const fileName = `${reportType}_${payPeriod.startDate}_${payPeriod.endDate}.${fileExtension}`;
      const filePath = path.join(process.cwd(), 'reports', fileName);

      // Ensure reports directory exists
      const reportsDir = path.dirname(filePath);
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      if (format === 'pdf') {
        if (reportType === 'individual-timecard') {
          await generateIndividualTimecardPDFReport(employer, payPeriod, employees, timecardData, filePath);
        } else {
          await generatePDFReport(employer, payPeriod, employees, timecardData, filePath);
        }
      } else if (format === 'excel') {
        await generateExcelReport(employer, payPeriod, employees, timecardData, filePath);
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

  // Get reports for employer
  app.get('/api/reports/:employerId', isAuthenticated, async (req: any, res) => {
    try {
      const employerId = parseInt(req.params.employerId);

      // Verify employer ownership
      const employer = await storage.getEmployer(employerId);
      if (!employer || employer.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const reports = await storage.getReportsByEmployer(employerId);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  // Download report route
  app.get('/api/reports/download/:reportId', isAuthenticated, async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.reportId);

      // Find the report across all user's employers
      const userEmployers = await storage.getEmployersByOwner(req.user.claims.sub);
      let report = null;

      for (const employer of userEmployers) {
        const reports = await storage.getReportsByEmployer(employer.id);
        const foundReport = reports.find(r => r.id === reportId);
        if (foundReport) {
          report = foundReport;
          break;
        }
      }

      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Verify the file exists
      if (!report.filePath || !fs.existsSync(report.filePath)) {
        return res.status(404).json({ message: "Report file not found" });
      }

      // Set appropriate headers for download
      const mimeType = report.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${report.fileName}"`);

      // Stream the file
      const fileStream = fs.createReadStream(report.filePath!);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error downloading report:", error);
      res.status(500).json({ message: "Failed to download report" });
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
        // Get time entries for the pay period and calculate hours
        const timeEntries = await storage.getTimeEntriesByEmployee(emp.id, payPeriod.startDate, payPeriod.endDate);
        const { regularHours: reg, overtimeHours: ot } = calculateWeeklyOvertime(timeEntries, payPeriod.startDate);

        const ptoEntries = await storage.getPtoEntriesByEmployee(emp.id);
        const pto = ptoEntries.filter(p => p.entryDate >= payPeriod.startDate && p.entryDate <= payPeriod.endDate)
          .reduce((s, p) => s + parseFloat(p.hours as any), 0);

        const misc = await storage.getMiscHoursEntriesByEmployee(emp.id);
        const holidayWorked = misc.filter(m => m.entryType === 'holiday-worked' && m.entryDate >= payPeriod.startDate && m.entryDate <= payPeriod.endDate)
          .reduce((s, m) => s + parseFloat(m.hours as any), 0);
        const holidayNon = misc.filter(m => m.entryType === 'holiday' && m.entryDate >= payPeriod.startDate && m.entryDate <= payPeriod.endDate)
          .reduce((s, m) => s + parseFloat(m.hours as any), 0);
        const miscHours = misc.filter(m => m.entryType === 'misc' && m.entryDate >= payPeriod.startDate && m.entryDate <= payPeriod.endDate)
          .reduce((s, m) => s + parseFloat(m.hours as any), 0);

        // Add misc hours to regular hours (doesn't affect OT calculation)
        const adjustedRegularHours = reg + miscHours;

        const reimb = await storage.getReimbursementEntriesByEmployee(emp.id);
        const reimbTotal = reimb.filter(r => r.entryDate >= payPeriod.startDate && r.entryDate <= payPeriod.endDate)
          .reduce((s, r) => s + parseFloat(r.amount as any), 0);

        rows.push({
          id: emp.id,
          name: `${emp.firstName} ${emp.lastName}`,
          regularHours: adjustedRegularHours,
          overtimeHours: ot,
          ptoHours: pto,
          holidayWorkedHours: holidayWorked,
          holidayNonWorkedHours: holidayNon,
          reimbursement: reimbTotal,
        });

        totals.regularHours += adjustedRegularHours;
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
async function generatePDFReport(
  employer: any,
  payPeriod: any,
  employees: any[],
  timecardData: any[],
  filePath: string
) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });
  doc.pipe(fs.createWriteStream(filePath));

  const addHeader = () => {
    // Report title and meta
    doc.fontSize(20).text('Payroll Report', 50, 50);
    doc.fontSize(14).text(`Company: ${employer.name}`, 50, 80);
    doc.text(`Pay Period: ${payPeriod.startDate} to ${payPeriod.endDate}`, 50, 100);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 50, 120);

    let headerY = 160;
    doc.fontSize(16).text('Employee Summary', 50, headerY);
    headerY += 30;

    // Table column headers
    doc.fontSize(10);
    doc.text('Employee Name', 50, headerY);
    doc.text('Regular Hrs', 220, headerY);
    doc.text('OT Hrs', 300, headerY);
    doc.text('PTO Hrs', 370, headerY);
    doc.text('Holiday Hrs', 440, headerY);
    doc.text('Holiday Worked', 520, headerY);
    doc.text('Reimbursement', 620, headerY);
    headerY += 20;

    doc.moveTo(50, headerY - 5).lineTo(720, headerY - 5).stroke();

    // Set the Y position for the content to start after the header
    doc.y = headerY;
  };

  // Register the event listener for new pages
  doc.on('pageAdded', addHeader);

  // Manually add the header for the FIRST page
  addHeader();

  // Initialize totals
  let totalRegularHours = 0;
  let totalOvertimeHours = 0;
  let totalPtoHours = 0;
  let totalHolidayHours = 0;
  let totalHolidayWorked = 0;
  let totalReimbursement = 0;

  for (const emp of employees) {
    // Check if a new page is needed BEFORE drawing the row
    if (doc.y + 15 > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
    }

    // --- Data Calculation (remains the same) ---
    const timeEntries = await storage.getTimeEntriesByEmployee(emp.id, payPeriod.startDate, payPeriod.endDate);
    const { regularHours, overtimeHours } = calculateWeeklyOvertime(timeEntries, payPeriod.startDate);
    const ptoEntries = await storage.getPtoEntriesByEmployee(emp.id);
    const periodPto = ptoEntries.filter(p => p.entryDate >= payPeriod.startDate && p.entryDate <= payPeriod.endDate)
      .reduce((sum, p) => sum + parseFloat(p.hours as any), 0);
    const miscEntries = await storage.getMiscHoursEntriesByEmployee(emp.id);
    const holidayWorked = miscEntries.filter(m => m.entryType === 'holiday-worked' && m.entryDate >= payPeriod.startDate && m.entryDate <= payPeriod.endDate)
      .reduce((sum, m) => sum + parseFloat(m.hours as any), 0);
    const holidayNonWorked = miscEntries.filter(m => m.entryType === 'holiday' && m.entryDate >= payPeriod.startDate && m.entryDate <= payPeriod.endDate)
      .reduce((sum, m) => sum + parseFloat(m.hours as any), 0);
    const miscHours = miscEntries.filter(m => m.entryType === 'misc' && m.entryDate >= payPeriod.startDate && m.entryDate <= payPeriod.endDate)
      .reduce((sum, m) => sum + parseFloat(m.hours as any), 0);
    const adjustedRegularHours = regularHours + miscHours;
    const reimbEntries = await storage.getReimbursementEntriesByEmployee(emp.id);
    const periodReimb = reimbEntries.filter(r => r.entryDate >= payPeriod.startDate && r.entryDate <= payPeriod.endDate)
      .reduce((sum, r) => sum + parseFloat(r.amount as any), 0);

    // Add to totals
    totalRegularHours += adjustedRegularHours;
    totalOvertimeHours += overtimeHours;
    totalPtoHours += periodPto;
    totalHolidayHours += holidayNonWorked;
    totalHolidayWorked += holidayWorked;
    totalReimbursement += periodReimb;

    // --- Draw the row at the current Y position ---
    const currentY = doc.y;
    doc.fontSize(9);
    doc.text(`${emp.firstName} ${emp.lastName}`, 50, currentY, { width: 160, ellipsis: true });
    doc.text(adjustedRegularHours.toFixed(2), 220, currentY);
    doc.text(overtimeHours.toFixed(2), 300, currentY);
    doc.text(periodPto.toFixed(2), 370, currentY);
    doc.text(holidayNonWorked.toFixed(2), 440, currentY);
    doc.text(holidayWorked.toFixed(2), 520, currentY);
    doc.text(`$${periodReimb.toFixed(2)}`, 620, currentY);
  }

  // Add totals section
  doc.y += 30; // Add some space before totals
  
  // Check if we need a new page for totals
  if (doc.y + 40 > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    doc.y += 20; // Add some space from top on new page
  }

  // Draw separator line
  doc.moveTo(50, doc.y - 10).lineTo(720, doc.y - 10).stroke();

  // Draw totals row
  const totalsY = doc.y + 10;
  doc.fontSize(10);
  doc.font('Helvetica-Bold');
  doc.text('TOTALS', 50, totalsY, { width: 160 });
  doc.text(totalRegularHours.toFixed(2), 220, totalsY);
  doc.text(totalOvertimeHours.toFixed(2), 300, totalsY);
  doc.text(totalPtoHours.toFixed(2), 370, totalsY);
  doc.text(totalHolidayHours.toFixed(2), 440, totalsY);
  doc.text(totalHolidayWorked.toFixed(2), 520, totalsY);
  doc.text(`$${totalReimbursement.toFixed(2)}`, 620, totalsY);

  doc.end();
}

async function generateExcelReport(employer: any, payPeriod: any, employees: any[], timecardData: any[], filePath: string) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Payroll Report');

  // Headers
  worksheet.addRow(['Payroll Report']);
  worksheet.addRow([`Company: ${employer.name}`]);
  worksheet.addRow([`Pay Period: ${payPeriod.startDate} to ${payPeriod.endDate}`]);
  worksheet.addRow([`Generated: ${new Date().toLocaleDateString()}`]);
  worksheet.addRow([]);

  // Employee data headers
  worksheet.addRow(['Employee', 'Regular Hours', 'OT Hours', 'PTO Hours', 'Holiday Hours', 'Holiday Worked', 'Reimbursement']);

  // Initialize totals
  let totalRegularHours = 0;
  let totalOvertimeHours = 0;
  let totalPtoHours = 0;
  let totalHolidayHours = 0;
  let totalHolidayWorked = 0;
  let totalReimbursement = 0;

  // Process each employee
  for (const emp of employees) {
    // Get time entries for the pay period and calculate hours
    const timeEntries = await storage.getTimeEntriesByEmployee(emp.id, payPeriod.startDate, payPeriod.endDate);
    const { regularHours, overtimeHours } = calculateWeeklyOvertime(timeEntries, payPeriod.startDate);

    // Get PTO entries for pay period
    const ptoEntries = await storage.getPtoEntriesByEmployee(emp.id);
    const periodPto = ptoEntries.filter(p => p.entryDate >= payPeriod.startDate && p.entryDate <= payPeriod.endDate)
      .reduce((sum, p) => sum + parseFloat(p.hours as any), 0);

    // Get misc hours entries for holidays and misc hours
    const miscEntries = await storage.getMiscHoursEntriesByEmployee(emp.id);
    const holidayWorked = miscEntries.filter(m => m.entryType === 'holiday-worked' && m.entryDate >= payPeriod.startDate && m.entryDate <= payPeriod.endDate)
      .reduce((sum, m) => sum + parseFloat(m.hours as any), 0);
    const holidayNonWorked = miscEntries.filter(m => m.entryType === 'holiday' && m.entryDate >= payPeriod.startDate && m.entryDate <= payPeriod.endDate)
      .reduce((sum, m) => sum + parseFloat(m.hours as any), 0);
    const miscHours = miscEntries.filter(m => m.entryType === 'misc' && m.entryDate >= payPeriod.startDate && m.entryDate <= payPeriod.endDate)
      .reduce((sum, m) => sum + parseFloat(m.hours as any), 0);

    // Add misc hours to regular hours (doesn't affect OT calculation)
    const adjustedRegularHours = regularHours + miscHours;

    // Get reimbursement entries for pay period
    const reimbEntries = await storage.getReimbursementEntriesByEmployee(emp.id);
    const periodReimb = reimbEntries.filter(r => r.entryDate >= payPeriod.startDate && r.entryDate <= payPeriod.endDate)
      .reduce((sum, r) => sum + parseFloat(r.amount as any), 0);

    // Add to totals
    totalRegularHours += adjustedRegularHours;
    totalOvertimeHours += overtimeHours;
    totalPtoHours += periodPto;
    totalHolidayHours += holidayNonWorked;
    totalHolidayWorked += holidayWorked;
    totalReimbursement += periodReimb;

    // Add employee row
    worksheet.addRow([
      `${emp.firstName} ${emp.lastName}`,
      adjustedRegularHours.toFixed(2),
      overtimeHours.toFixed(2),
      periodPto.toFixed(2),
      holidayNonWorked.toFixed(2),
      holidayWorked.toFixed(2),
      periodReimb.toFixed(2)
    ]);
  }

  // Add empty row for spacing
  worksheet.addRow([]);

  // Add totals row
  const totalsRow = worksheet.addRow([
    'TOTALS',
    totalRegularHours.toFixed(2),
    totalOvertimeHours.toFixed(2),
    totalPtoHours.toFixed(2),
    totalHolidayHours.toFixed(2),
    totalHolidayWorked.toFixed(2),
    totalReimbursement.toFixed(2)
  ]);

  // Style the totals row
  totalsRow.font = { bold: true };
  totalsRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6E6E6' }
  };

  // Style the worksheet
  worksheet.getRow(1).font = { bold: true, size: 16 };
  worksheet.getRow(6).font = { bold: true };

  // Auto-fit columns
  worksheet.columns.forEach(column => {
    column.width = 15;
  });

  await workbook.xlsx.writeFile(filePath);
}

async function generateIndividualTimecardPDFReport(employer: any, payPeriod: any, employees: any[], timecardData: any[], filePath: string) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });
  doc.pipe(fs.createWriteStream(filePath));

  for (const emp of employees) {
    if (employees.indexOf(emp) > 0) doc.addPage({ size: 'A4', layout: 'landscape' });

    // Header
    doc.fontSize(20).text('Individual Timecard Report', 50, 50);
    doc.fontSize(14).text(`Company: ${employer.name}`, 50, 80);
    doc.fontSize(14).text(`Employee: ${emp.firstName} ${emp.lastName} (Hire Date: ${emp.hireDate})`, 50, 100);
    doc.text(`Pay Period: ${payPeriod.startDate} to ${payPeriod.endDate}`, 50, 120);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 50, 140);

    // Column headers
    let yPos = 180;
    doc.fontSize(16).text('Daily Time Entries', 50, yPos);
    yPos += 30;

    // Table headers with landscape spacing
    doc.fontSize(9);
    doc.text('Date', 50, yPos);
    doc.text('Time In', 120, yPos);
    doc.text('Time Out', 180, yPos);
    doc.text('Lunch (min)', 240, yPos);
    doc.text('Hours', 310, yPos);
    doc.text('Notes', 360, yPos);
    yPos += 20;

    // Draw header line
    doc.moveTo(50, yPos - 5).lineTo(720, yPos - 5).stroke();

    // Get time entries for this employee
    const timeEntries = await storage.getTimeEntriesByEmployee(emp.id, payPeriod.startDate, payPeriod.endDate);

    // Calculate total hours for display
    const { regularHours, overtimeHours } = calculateWeeklyOvertime(timeEntries, payPeriod.startDate);

    // Get additional entries
    const ptoEntries = await storage.getPtoEntriesByEmployee(emp.id);
    const periodPto = ptoEntries.filter(p => p.entryDate >= payPeriod.startDate && p.entryDate <= payPeriod.endDate)
      .reduce((sum, p) => sum + parseFloat(p.hours as any), 0);

    const miscEntries = await storage.getMiscHoursEntriesByEmployee(emp.id);
    const holidayWorked = miscEntries.filter(m => m.entryType === 'holiday-worked' && m.entryDate >= payPeriod.startDate && m.entryDate <= payPeriod.endDate)
      .reduce((sum, m) => sum + parseFloat(m.hours as any), 0);
    const holidayNonWorked = miscEntries.filter(m => m.entryType === 'holiday' && m.entryDate >= payPeriod.startDate && m.entryDate <= payPeriod.endDate)
      .reduce((sum, m) => sum + parseFloat(m.hours as any), 0);
    const miscHours = miscEntries.filter(m => m.entryType === 'misc' && m.entryDate >= payPeriod.startDate && m.entryDate <= payPeriod.endDate)
      .reduce((sum, m) => sum + parseFloat(m.hours as any), 0);

    const reimbEntries = await storage.getReimbursementEntriesByEmployee(emp.id);
    const periodReimb = reimbEntries.filter(r => r.entryDate >= payPeriod.startDate && r.entryDate <= payPeriod.endDate);
    const totalReimbursement = periodReimb.reduce((sum, r) => sum + parseFloat(r.amount as any), 0);

    // Extract mileage from reimbursement descriptions
    let totalMiles = 0;
    periodReimb.forEach(r => {
      const mileageMatch = r.description?.match(/Mileage: (\d+(?:\.\d+)?) miles/);
      if (mileageMatch) {
        totalMiles += parseFloat(mileageMatch[1]) || 0;
      }
    });

    for (const entry of timeEntries) {
      // Calculate hours for this entry
      const timeIn = new Date(entry.timeIn);
      const timeOut = entry.timeOut ? new Date(entry.timeOut) : null;
      let entryHours = 0;

      if (timeOut) {
        let minutes = (timeOut.getTime() - timeIn.getTime()) / 60000;
        if (minutes < 0) minutes += 24 * 60; // Handle overnight shifts
        if (entry.lunchMinutes && minutes / 60 >= 8) {
          minutes -= entry.lunchMinutes;
        }
        if (minutes < 0) minutes = 0;
        entryHours = Math.round((minutes / 60) * 100) / 100;
      }

      // Format date as MM/DD/YYYY for compactness
      const entryDate = new Date(entry.timeIn);
      const formattedDate = `${(entryDate.getMonth() + 1).toString().padStart(2, '0')}/${entryDate.getDate().toString().padStart(2, '0')}/${entryDate.getFullYear()}`;

      doc.fontSize(8);
      doc.text(formattedDate, 50, yPos);
      doc.text(timeIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 120, yPos);
      doc.text(timeOut ? timeOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--', 180, yPos);
      doc.text((entry.lunchMinutes || 0).toString(), 240, yPos);
      doc.text(entryHours.toFixed(2), 310, yPos);
      doc.text(entry.notes || '', 360, yPos, { width: 300, ellipsis: true });
      yPos += 15;

      if (yPos > 480) {
        doc.addPage({ size: 'A4', layout: 'landscape' });
        yPos = 50;
      }
    }

    // Add comprehensive summary section
    yPos += 30;
    doc.moveTo(50, yPos - 10).lineTo(720, yPos - 10).stroke();

    doc.fontSize(14).text('Pay Period Summary', 50, yPos);
    yPos += 25;

    // Summary in two columns
    doc.fontSize(10);

    // Left column
    doc.text(`Regular Hours: ${(regularHours + miscHours).toFixed(2)}`, 50, yPos);
    yPos += 15;
    doc.text(`Overtime Hours: ${overtimeHours.toFixed(2)}`, 50, yPos);
    yPos += 15;
    doc.text(`PTO Hours: ${periodPto.toFixed(2)}`, 50, yPos);
    yPos += 15;
    doc.text(`Holiday Hours: ${holidayNonWorked.toFixed(2)}`, 50, yPos);

    // Right column
    yPos -= 45; // Reset to top of summary
    doc.text(`Holiday Hours Worked: ${holidayWorked.toFixed(2)}`, 300, yPos);
    yPos += 15;
    doc.text(`Misc Hours: ${miscHours.toFixed(2)}`, 300, yPos);
    yPos += 15;
    doc.text(`Miles Driven: ${totalMiles.toFixed(1)}`, 300, yPos);
    yPos += 15;
    doc.text(`Total Reimbursement: $${totalReimbursement.toFixed(2)}`, 300, yPos);

    // Total hours calculation
    yPos += 30;
    const totalHours = regularHours + overtimeHours + miscHours + periodPto + holidayNonWorked + holidayWorked;
    doc.fontSize(12);
    doc.text(`Total Pay Period Hours: ${totalHours.toFixed(2)}`, 50, yPos);
  }

  doc.end();
}