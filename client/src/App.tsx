import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Employees from "@/pages/employees";
import Timecards from "@/pages/timecards";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import CreateCompany from "@/pages/create-company";
import SettingsCreateCompany from "@/pages/settings/CreateCompany";
import CompanySettings from "@/pages/settings/CompanySettings";
import TimecardEntry from "@/pages/timecard-entry";
import TopSheetReport from "@/pages/reports/TopSheetReport";
import CompaniesAdmin from "@/pages/admin/Companies";
import { CompanyProvider } from "@/context/company";
import { TimecardUpdatesProvider } from "@/context/timecard-updates";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Timecards} />
          <Route path="/create-company" component={CreateCompany} />
          <Route path="/settings/create-company" component={SettingsCreateCompany} />
          <Route path="/settings/company" component={CompanySettings} />
          <Route path="/employees" component={Employees} />

          <Route path="/timecard/employee/:employeeId/period/:start" component={TimecardEntry} />
          <Route path="/reports" component={Reports} />
          <Route path="/reports/top-sheet" component={TopSheetReport} />
          <Route path="/admin/companies" component={CompaniesAdmin} />
          <Route path="/settings" component={Settings} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CompanyProvider>
        <TimecardUpdatesProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </TimecardUpdatesProvider>
      </CompanyProvider>
    </QueryClientProvider>
  );
}

export default App;
