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
- **2025-06-27**: Complete UI cleanup and header scrolling improvements
  - Fixed React hooks error in Employees component by moving useLocation outside conditional
  - Reduced sidebar width from 256px to 192px for cleaner desktop layout
  - Updated all page layouts to properly align with reduced sidebar (ml-48 instead of ml-64)
  - Made headers non-sticky so they scroll out of view instead of blocking content
  - Removed compensating top padding from all pages (pt-20 md:pt-24)
  - Enhanced dashboard stats calculation to use time entries instead of legacy timecards
  - Fixed timecard system to prevent time shifting and maintain field editability
  - Pay period summary now accurately reflects timecard totals with real-time updates
  - Resolved all crowded UI issues with proper spacing and content visibility

- **2025-06-27**: UI improvements and navigation cleanup
  - Changed Companies sidebar icon from gear to building icon
  - Removed redundant Settings tab - company editing now handled entirely under Companies
  - Fixed layout alignment issues for Settings and Companies pages to match standard layout
  - Added selectable pay period dropdown to timecards that defaults to current period
  - Fixed Pay Period Summary badge to show selected period date instead of always current

- **2025-06-27**: Enhanced timecard functionality and fixed employee creation
  - Fixed missing hire date field in employee form that was preventing employee creation
  - Updated timecards page to default to current pay period automatically
  - Redesigned timecards view to match dashboard layout exactly with same stats and table structure
  - Both desktop table and mobile card layouts now consistent across dashboard and timecards
  - Employee creation now fully functional with proper validation and required fields

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