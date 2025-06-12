import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  FileText, 
  Settings,
  TrendingUp
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatDate, getPayPeriodProgress } from "@/lib/dateUtils";

interface SidebarProps {
  selectedEmployer?: any;
  currentPayPeriod?: any;
}

export function Sidebar({ selectedEmployer, currentPayPeriod }: SidebarProps) {
  const [location] = useLocation();

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Employee Roster", href: "/employees", icon: Users },
    { name: "Timecards", href: "/timecards", icon: Clock },
    { name: "Payroll Reports", href: "/reports", icon: FileText },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  const payPeriodProgress = currentPayPeriod ? getPayPeriodProgress(
    currentPayPeriod.startDate, 
    currentPayPeriod.endDate
  ) : null;

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-sidebar-primary">PayTracker Pro</h1>
        <p className="text-sm text-sidebar-foreground/70">
          {selectedEmployer?.name || "Loading..."}
        </p>
      </div>
      
      {/* Navigation */}
      <nav className="mt-4">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <Link key={item.name} href={item.href} className={`
              flex items-center px-4 py-3 text-sm font-medium transition-colors
              ${active 
                ? "text-sidebar-primary bg-sidebar-accent border-r-2 border-sidebar-primary" 
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }
            `}>
              <Icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      

    </div>
  );
}
