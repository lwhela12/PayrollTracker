import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { EmployerForm } from "@/components/employer-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/context/company";

export default function CompaniesAdmin() {
  const { user } = useAuth();
  const { employerId, setEmployerId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: employers = [] } = useQuery<any[]>({
    queryKey: ["/api/employers"],
    enabled: !!user,
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/employers/${id}`);

      return id;
    },
    onSuccess: (_, id) => {
      // Remove company from cache immediately
      const remaining = (queryClient.getQueryData<any[]>(["/api/employers"]) || []).filter((e) => e.id !== id);
      queryClient.setQueryData(["/api/employers"], remaining);
      // Update selected employer if it was deleted
      if (employerId === id) {
        const nextId = remaining[0]?.id ?? null;
        setEmployerId(nextId);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/employers"] });
      toast({ title: "Success", description: "Company deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handleClose = () => {
    setShowForm(false);
    setEditing(null);
    queryClient.invalidateQueries({ queryKey: ["/api/employers"] });
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar selectedEmployer={employers[0]} user={user} />
      <div className="md:ml-48 min-h-screen">
        <Header title="Companies" description="Manage companies" user={user} />
        <main className="p-4 md:p-6">
          <Card className="payroll-card">
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Companies</CardTitle>
              <Button className="payroll-button-primary" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Company
              </Button>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {employers.map((e:any) => (
                  <li key={e.id} className="flex justify-between border-b pb-2">
                    <span>{e.name}</span>
                    <div className="space-x-2">
                      <Button variant="outline" size="sm" onClick={() => { setEditing(e); setShowForm(true); }}>Edit</Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete ${e.name}?`)) {
                            deleteCompanyMutation.mutate(e.id);
                          }
                        }}
                        disabled={deleteCompanyMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </main>
      </div>
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Company" : "New Company"}</DialogTitle>
          </DialogHeader>
          <EmployerForm employer={editing} onSuccess={handleClose} onCancel={handleClose} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
