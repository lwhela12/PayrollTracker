import React from "react";
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

  // Show loading while checking for companies
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If user has no companies and isn't already on the create company page, redirect them
  if (employers && employers.length === 0 && !location.includes("/create-company")) {
    setLocation("/create-company");
    return null;
  }

  return <>{children}</>;
}