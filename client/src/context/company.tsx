import React, { createContext, useContext, useEffect, useState } from "react";

interface CompanyContextProps {
  employerId: number | null;
  setEmployerId: (id: number | null) => void;
}

const CompanyContext = createContext<CompanyContextProps | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [employerId, setEmployerIdState] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("employerId");
    if (stored) setEmployerIdState(parseInt(stored));
  }, []);

  const setEmployerId = (id: number | null) => {
    setEmployerIdState(id);
    if (id === null) {
      localStorage.removeItem("employerId");
    } else {
      localStorage.setItem("employerId", id.toString());
    }
  };

  return (
    <CompanyContext.Provider value={{ employerId, setEmployerId }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}
