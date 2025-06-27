import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { EmployerForm } from "@/components/employer-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export default function CompaniesAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: employers = [] } = useQuery<any[]>({
    queryKey: ["/api/employers"],
    enabled: !!user,
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
      <div className="md:ml-64 min-h-screen">
        <Header title="Companies" description="Manage companies" user={user} />
        <main className="p-4 md:p-6 pt-20 md:pt-24">
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
                    <Button variant="outline" size="sm" onClick={() => { setEditing(e); setShowForm(true); }}>Edit</Button>
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
