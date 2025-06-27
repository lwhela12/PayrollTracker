# Payroll Tracker Pro - System Documentation

## Overview

PayTracker Pro is a comprehensive payroll management system designed to digitize handwritten timecards, track employee hours, and generate professional payroll reports. The application supports multi-employer environments and provides a complete solution for small to medium businesses to manage their payroll processes efficiently.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **UI Components**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens
- **State Management**: TanStack Query (React Query) for server state management
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with connection pooling
- **ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Replit Auth with OpenID Connect
- **Session Management**: Express sessions with PostgreSQL store
- **API Design**: RESTful endpoints with standardized error handling

### Database Design
The system uses a PostgreSQL database with the following core entities:
- **Users**: Authentication and user profile management
- **Employers**: Multi-tenant company information
- **Employees**: Worker profiles with mileage rates and positions
- **Pay Periods**: Bi-weekly payroll cycles
- **Timecards**: Daily time entries with hours and mileage tracking
- **Reimbursements**: Expense tracking and approval workflow
- **Reports**: Generated payroll documents and exports

## Key Components

### Authentication System
- Replit Auth integration with OpenID Connect
- Session-based authentication with PostgreSQL storage
- User profile management with automatic provisioning
- Secure session handling with HttpOnly cookies

### Timecard Management
- Bi-weekly timecard forms with automatic hour calculations
- Support for regular hours, overtime, PTO, and holiday time
- Mileage tracking with odometer readings
- Real-time validation and error handling
- Bulk timecard operations for efficiency

### Dashboard and Analytics
- Real-time dashboard with employee status overview
- Pay period progress tracking
- Quick access to timecard entry and employee management
- Visual indicators for timecard completion status

### Report Generation
- PDF payroll reports using PDFKit
- Excel export functionality with ExcelJS
- Customizable report templates
- Automated report scheduling capabilities

## Data Flow

### User Authentication Flow
1. User accesses the application
2. Replit Auth redirects to OpenID Connect provider
3. Successful authentication creates/updates user session
4. User profile is synchronized with database
5. Application state is hydrated with user context

### Timecard Entry Flow
1. Employee/Manager selects pay period and employee
2. System fetches existing timecard data
3. Form is populated with existing entries or defaults
4. User enters/modifies time and mileage data
5. Client-side validation occurs in real-time
6. Data is submitted with server-side validation
7. Database is updated and cache is invalidated
8. Dashboard reflects updated status

### Report Generation Flow
1. User selects report type and parameters
2. System queries relevant timecard and employee data
3. Report template is populated with calculated values
4. PDF/Excel document is generated server-side
5. File is streamed to client for download
6. Report metadata is stored for audit trail

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL connection pooling
- **drizzle-orm**: Type-safe database operations
- **@tanstack/react-query**: Server state management
- **wouter**: Lightweight React routing
- **react-hook-form**: Form state management
- **zod**: Runtime type validation
- **date-fns**: Date manipulation utilities

### UI Dependencies
- **@radix-ui/***: Accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Icon library
- **class-variance-authority**: Component variant management

### Development Dependencies
- **vite**: Build tool and development server
- **typescript**: Type safety and development experience
- **vitest**: Unit testing framework
- **eslint**: Code linting and formatting

## Deployment Strategy

### Development Environment
- Replit workspace with auto-reloading
- PostgreSQL database provisioning
- Environment variable management
- Integrated debugging and logging

### Production Deployment
- Replit Autoscale deployment target
- Automated build process with Vite
- PostgreSQL database with connection pooling
- Session storage in database
- Static asset serving with caching

### Database Management
- Drizzle migrations for schema changes
- Connection pooling for performance
- Automated backup strategies
- Environment-specific configurations

## Changelog

- June 27, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.