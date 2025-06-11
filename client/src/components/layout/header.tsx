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

  const userInitials = user ? 
    `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 
    user.email?.[0]?.toUpperCase() || 'U' : 'U';

  return (
    <header className="bg-card shadow-sm border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {onGenerateReports && (
            <Button 
              onClick={onGenerateReports}
              className="payroll-button-secondary"
            >
              <Download className="h-4 w-4 mr-2" />
              Generate Reports
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
                <span className="text-sm font-medium">
                  {user?.firstName && user?.lastName 
                    ? `${user.firstName} ${user.lastName}`
                    : user?.email || "User"
                  }
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
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
