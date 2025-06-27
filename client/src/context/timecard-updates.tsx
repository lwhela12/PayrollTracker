import React, { createContext, useContext, useState, useCallback } from 'react';

interface TimecardUpdate {
  employeeId: number;
  mileage?: number;
  reimbursement?: number;
  ptoHours?: number;
  holidayHours?: number;
  holidayWorkedHours?: number;
}

interface TimecardUpdatesContextType {
  updates: Record<number, TimecardUpdate>;
  updateEmployee: (employeeId: number, data: Partial<TimecardUpdate>) => void;
  getEmployeeUpdate: (employeeId: number) => TimecardUpdate | undefined;
  clearEmployee: (employeeId: number) => void;
}

const TimecardUpdatesContext = createContext<TimecardUpdatesContextType | undefined>(undefined);

export function TimecardUpdatesProvider({ children }: { children: React.ReactNode }) {
  const [updates, setUpdates] = useState<Record<number, TimecardUpdate>>({});

  const updateEmployee = useCallback((employeeId: number, data: Partial<TimecardUpdate>) => {
    setUpdates(prev => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        employeeId,
        ...data
      }
    }));
  }, []);

  const getEmployeeUpdate = useCallback((employeeId: number) => {
    return updates[employeeId];
  }, [updates]);

  const clearEmployee = useCallback((employeeId: number) => {
    setUpdates(prev => {
      const { [employeeId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  return (
    <TimecardUpdatesContext.Provider value={{
      updates,
      updateEmployee,
      getEmployeeUpdate,
      clearEmployee
    }}>
      {children}
    </TimecardUpdatesContext.Provider>
  );
}

export function useTimecardUpdates() {
  const context = useContext(TimecardUpdatesContext);
  if (!context) {
    throw new Error('useTimecardUpdates must be used within TimecardUpdatesProvider');
  }
  return context;
}