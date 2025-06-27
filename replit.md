# Payroll Management Application

## Project Overview
A comprehensive payroll tracking web application designed to streamline employee management, timecard digitization, and payroll processing with professional reporting capabilities.

**Technology Stack:**
- React frontend with TypeScript
- Drizzle ORM for database interactions
- Tailwind CSS for responsive design
- React Query for data fetching and state management
- Express.js backend with PostgreSQL database

## Recent Changes
- **2025-06-26**: Implemented clean desktop layout improvements
  - Removed progress element from sidebar for cleaner appearance
  - Fixed layout structure to eliminate empty space and ensure full-width content flow
  - Updated all pages (dashboard, employees, timecards, reports) with consistent layout
  - Maintained responsive design with mobile-friendly features

- **Previous**: Fixed critical app startup failures, resolved timecard data persistence issues, implemented comprehensive responsive design with mobile card layouts, and added proper UTC date handling for Wednesday pay period starts

## User Preferences
- **Layout Style**: Extremely clean desktop layout with no unnecessary visual elements
- **Content Flow**: Main content should use full width without being constrained by sidebar height
- **Pay Period Display**: No progress tracking elements in sidebar
- **Responsive Design**: Maintain mobile functionality while prioritizing clean desktop experience

## Project Architecture
- **Frontend**: React with TypeScript, using Wouter for routing
- **Backend**: Express.js server with authentication via Replit Auth
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Styling**: Tailwind CSS with custom components using shadcn/ui
- **State Management**: React Query for server state, React hooks for local state

**Key Features:**
- Employee roster management with CSV import/export
- Bi-weekly timecard tracking with dual layout (desktop tables, mobile cards)
- Pay period management starting on Wednesdays
- Dashboard analytics and reporting
- PDF/Excel report generation
- Responsive design for desktop and mobile devices

## Database Schema
- Users, Employers, Employees, Pay Periods, Timecards, Reimbursements, Reports
- Pay periods automatically generated starting on Wednesdays
- UTC date handling throughout system for consistency

## Current Status
- Application fully functional with clean desktop layout
- All core features implemented and tested
- Responsive design working across devices
- Ready for production deployment