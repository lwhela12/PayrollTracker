import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  FileText, 
  Building,
  Menu,
  X
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, getPayPeriodProgress } from "@/lib/dateUtils";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface SidebarProps {
  selectedEmployer?: any;
  currentPayPeriod?: any;
  user?: any;
}

export function Sidebar({ selectedEmployer, currentPayPeriod, user }: SidebarProps) {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Employee Roster", href: "/employees", icon: Users },
    { name: "Timecards", href: "/timecards", icon: Clock },
    { name: "Payroll Reports", href: "/reports", icon: FileText },
    ...(user?.role === 'Admin' ? [{ name: 'Companies', href: '/admin/companies', icon: Building }] : []),
  ];

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  const payPeriodProgress = currentPayPeriod ? getPayPeriodProgress(
    currentPayPeriod.startDate, 
    currentPayPeriod.endDate
  ) : null;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-sidebar-primary">PayTracker Pro</h1>
            <p className="text-sm text-sidebar-foreground/70">
              {selectedEmployer?.name || "Loading..."}
            </p>
          </div>
          {isMobile && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsOpen(false)}
              className="md:hidden"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="mt-4 flex-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <Link 
              key={item.name} 
              href={item.href} 
              className={`
                flex items-center px-4 py-3 text-sm font-medium transition-colors
                ${active 
                  ? "text-sidebar-primary bg-sidebar-accent border-r-2 border-sidebar-primary" 
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }
              `} 
              onClick={() => isMobile && setIsOpen(false)}
            >
              <Icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      

    </div>
  );

  if (isMobile) {
    return (
      <>
        {/* Mobile Toggle Button */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setIsOpen(true)}
          className="fixed top-4 left-4 z-50 md:hidden bg-white shadow-md"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Mobile Overlay */}
        {isOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="fixed inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
            <div className="fixed left-0 top-0 h-full w-80 bg-sidebar border-r border-sidebar-border shadow-lg">
              <SidebarContent />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="hidden md:flex fixed left-0 top-0 h-full w-48 bg-sidebar border-r border-sidebar-border shadow-lg z-30">
      <SidebarContent />
    </div>
  );
}