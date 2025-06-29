import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Download, ChevronDown, LogOut, User, Settings } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/context/company";
import { useAuth } from "@/hooks/useAuth";

interface HeaderProps {
  title: string;
  description: string;
  user?: any;
  onGenerateReports?: () => void;
}

export function Header({ title, description, user, onGenerateReports }: HeaderProps) {
  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const { employerId, setEmployerId } = useCompany();
  const { user: authUser } = useAuth();
  const { data: employers = [] } = useQuery<any[]>({
    queryKey: ["/api/employers"],
    enabled: !!authUser,
  });

  const userInitials = user ? 
    `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 
    user.email?.[0]?.toUpperCase() || 'U' : 'U';

  return (
    <header className="bg-card shadow-sm border-b border-border px-4 md:px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="ml-12 md:ml-0">
          <h2 className="text-xl md:text-2xl font-bold text-foreground">{title}</h2>
          <p className="text-muted-foreground text-sm hidden sm:block">{description}</p>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-4">
          {employers.length > 0 && (
            <Select
              value={employerId ? employerId.toString() : ""}
              onValueChange={(v) => setEmployerId(parseInt(v))}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select Company" />
              </SelectTrigger>
              <SelectContent>
                {employers.map((e: any) => (
                  <SelectItem key={e.id} value={e.id.toString()}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {onGenerateReports && (
            <Button
              onClick={onGenerateReports}
              className="payroll-button-secondary"
              size="sm"
            >
              <Download className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Generate Reports</span>
            </Button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2 hover:bg-muted">
                <Avatar className="h-8 w-8">
                  <AvatarImage 
                    src={user?.profileImageUrl} 
                    alt={user?.firstName || user?.email || "User"} 
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium hidden md:inline">
                  {user?.firstName && user?.lastName 
                    ? `${user.firstName} ${user.lastName}`
                    : user?.email || "User"
                  }
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground hidden md:inline" />
              </Button>
            </DropdownMenuTrigger>
            
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem className="cursor-pointer">
                <User className="h-4 w-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleLogout}
                className="cursor-pointer text-destructive hover:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
