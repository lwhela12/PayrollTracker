import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  insertEmployerSchema,
  insertEmployeeSchema,
  insertPayPeriodSchema,
  insertTimecardSchema,
  insertReimbursementSchema,
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

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

  // Employee routes
  app.post('/api/employees', isAuthenticated, async (req: any, res) => {
    try {
      console.log("Raw employee data received:", JSON.stringify(req.body, null, 2));
      
      const employeeData = insertEmployeeSchema.parse(req.body);
      console.log("Parsed employee data:", JSON.stringify(employeeData, null, 2));
      
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
        console.log("Zod validation error details:", JSON.stringify(error.errors, null, 2));
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

  // Create pay period route
  app.post('/api/pay-periods', isAuthenticated, async (req: any, res) => {
    try {
      console.log("Raw pay period data received:", JSON.stringify(req.body, null, 2));
      
      const payPeriodData = insertPayPeriodSchema.parse(req.body);
      console.log("Parsed pay period data:", JSON.stringify(payPeriodData, null, 2));
      
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
        console.log("Zod validation error details:", JSON.stringify(error.errors, null, 2));
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
      
      let timecards: any[] = [];
      let totalHours = 0;
      let pendingTimecards = 0;
      let payrollReady = 0;
      
      if (currentPayPeriod) {
        timecards = await storage.getTimecardsByPayPeriod(currentPayPeriod.id);
        
        // Calculate stats
        const employeeTimecardStatus = new Map();
        
        timecards.forEach(tc => {
          const hours = parseFloat(tc.regularHours || '0') + parseFloat(tc.overtimeHours || '0');
          totalHours += hours;
          
          if (!employeeTimecardStatus.has(tc.employeeId)) {
            employeeTimecardStatus.set(tc.employeeId, { hasTimecards: false, isApproved: true });
          }
          
          employeeTimecardStatus.get(tc.employeeId).hasTimecards = true;
          if (!tc.isApproved) {
            employeeTimecardStatus.get(tc.employeeId).isApproved = false;
          }
        });
        
        employees.forEach(emp => {
          const status = employeeTimecardStatus.get(emp.id);
          if (!status || !status.hasTimecards) {
            pendingTimecards++;
          } else if (status.isApproved) {
            payrollReady++;
          }
        });
      }
      
      const stats = {
        totalEmployees: employees.length,
        pendingTimecards,
        totalHours: totalHours.toFixed(1),
        payrollReady,
        currentPayPeriod,
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
