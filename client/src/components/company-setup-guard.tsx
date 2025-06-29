import React, { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface CompanySetupGuardProps {
  children: React.ReactNode;
}

export function CompanySetupGuard({ children }: CompanySetupGuardProps) {
  const [location, setLocation] = useLocation();
  
  const { data: employers, isLoading } = useQuery<any[]>({
    queryKey: ["/api/employers"],
  });

  // Handle redirection in useEffect to avoid setState during render
  useEffect(() => {
    if (!isLoading && employers && employers.length === 0 && !location.includes("/create-company")) {
      setLocation("/create-company");
    }
  }, [isLoading, employers, location, setLocation]);

  // Show loading while checking for companies
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If user has no companies and isn't already on the create company page, show loading until redirect
  if (employers && employers.length === 0 && !location.includes("/create-company")) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
}