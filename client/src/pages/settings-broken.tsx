import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { EmployerForm } from "@/components/employer-form";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompany } from "@/context/company";
import { useState } from "react";
import { Plus, Trash2, Users, Mail, Shield, Clock, Edit } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { employerId } = useCompany();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Admin");
  const [selectedCompanies, setSelectedCompanies] = useState<any[]>([]);
  const [useMultiCompany, setUseMultiCompany] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [userToRemove, setUserToRemove] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingRole, setEditingRole] = useState<string>("");

  const { data: employers = [] } = useQuery<any[]>({
    queryKey: ["/api/employers"],
    enabled: !!user,
  });

  const employer = employers[0];

  // Fetch team members
  const { data: teamMembers = [] } = useQuery<any[]>({
    queryKey: [`/api/employers/${employerId}/users`],
    enabled: !!employerId,
  });

  // Fetch pending invitations
  const { data: invitations = [] } = useQuery<any[]>({
    queryKey: [`/api/employers/${employerId}/invitations`],
    enabled: !!employerId,
  });

  // Fetch audit log
  const { data: auditLog = [] } = useQuery<any[]>({
    queryKey: [`/api/employers/${employerId}/audit-log`],
    enabled: !!employerId,
  });

  // Get current user's role
  const currentUserRole = (teamMembers as any[]).find((member: any) => 
    (member.user?.id === user?.id) || (member.userId === user?.id)
  )?.role;
  const isAdmin = currentUserRole === 'Admin';

  // Debug logging (remove in production)
  // console.log('User ID:', user?.id);
  // console.log('Team Members:', teamMembers);
  // console.log('Current User Role:', currentUserRole);
  // console.log('Is Admin:', isAdmin);

  // Multi-company invite mutation
  const inviteMultiCompanyMutation = useMutation({
    mutationFn: async (data: { email: string; companies: any[] }) => {
      const response = await fetch(`/api/invite-multi-company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate queries for all companies
      selectedCompanies.forEach(company => {
        queryClient.invalidateQueries({ queryKey: [`/api/employers/${company.employerId}/users`] });
        queryClient.invalidateQueries({ queryKey: [`/api/employers/${company.employerId}/invitations`] });
      });
      setInviteEmail("");
      setInviteRole("Admin");
      setSelectedCompanies([]);
      setUseMultiCompany(false);
      
      const message = data.skipped?.length > 0 
        ? `Invitation sent to ${data.invitations?.length || 0} companies. ${data.skipped.length} skipped (already invited).`
        : "Invitation sent successfully";
      
      toast({ title: "Success", description: message });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to send invitation",
        variant: "destructive" 
      });
    },
  });

  // Single-company invite mutation (legacy)
  const inviteUserMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const response = await fetch(`/api/employers/${employerId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/employers/${employerId}/users`] });
      queryClient.invalidateQueries({ queryKey: [`/api/employers/${employerId}/invitations`] });
      setInviteEmail("");
      setInviteRole("Admin");
      toast({ title: "Success", description: "Invitation sent successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to send invitation",
        variant: "destructive" 
      });
    },
  });

  // Remove user mutation
  const removeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/employers/${employerId}/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/employers/${employerId}/users`] });
      setShowRemoveDialog(false);
      setUserToRemove(null);
      toast({ title: "Success", description: "User removed successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to remove user",
        variant: "destructive" 
      });
    },
  });

  // Update user role mutation
  const updateUserRoleMutation = useMutation({
    mutationFn: async (data: { userId: string; role: string }) => {
      const response = await fetch(`/api/employers/${employerId}/users/${data.userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: data.role }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/employers/${employerId}/users`] });
      setEditingUser(null);
      setEditingRole("");
      toast({ title: "Success", description: "User role updated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update user role",
        variant: "destructive" 
      });
    },
  });

  const handleSuccess = (employer?: any) => {
    queryClient.invalidateQueries({ queryKey: ["/api/employers"] });
    queryClient.invalidateQueries({ queryKey: [`/api/employers/${employer?.id}`] });
    toast({ title: "Success", description: "Company profile updated" });
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    
    if (useMultiCompany && selectedCompanies.length > 0) {
      inviteMultiCompanyMutation.mutate({ 
        email: inviteEmail, 
        companies: selectedCompanies 
      });
    } else {
      // Default to current company if no multi-company selection
      inviteUserMutation.mutate({ email: inviteEmail, role: inviteRole });
    }
  };

  const toggleCompanySelection = (company: any, role: string) => {
    setSelectedCompanies(prev => {
      const existing = prev.find(c => c.employerId === company.id);
      if (existing) {
        return prev.filter(c => c.employerId !== company.id);
      } else {
        return [...prev, { employerId: company.id, role, companyName: company.name }];
      }
    });
  };

  const handleRemoveUser = (user: any) => {
    setUserToRemove(user);
    setShowRemoveDialog(true);
  };

  const confirmRemoveUser = () => {
    if (userToRemove) {
      const userId = userToRemove.userId || userToRemove.user?.id;
      if (userId) {
        removeUserMutation.mutate(userId);
      } else {
        toast({ 
          title: "Error", 
          description: "Unable to identify user ID",
          variant: "destructive" 
        });
      }
    }
  };

  const handleEditRole = (user: any) => {
    setEditingUser(user);
    setEditingRole(user.role);
  };

  const confirmRoleUpdate = () => {
    if (editingUser && editingRole) {
      updateUserRoleMutation.mutate({ 
        userId: editingUser.userId || editingUser.user.id, 
        role: editingRole 
      });
    }
  };

  if (!employer) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar selectedEmployer={employer} user={user} />
      <div className="md:ml-48 min-h-screen">
        <Header
          title="Settings"
          description="Manage company settings and team"
          user={user}
        />
        <main className="p-4 md:p-6">
          <Tabs defaultValue="company" className="max-w-4xl">
            <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-1'}`}>
              <TabsTrigger value="company">Company Profile</TabsTrigger>
              {isAdmin && <TabsTrigger value="team">Team Management</TabsTrigger>}
              {isAdmin && <TabsTrigger value="audit">Activity Log</TabsTrigger>}
            </TabsList>

            <TabsContent value="company">
              <Card className="payroll-card">
                <CardHeader>
                  <CardTitle>Company Profile</CardTitle>
                </CardHeader>
                <CardContent>
                  <EmployerForm
                    employer={employer}
                    onSuccess={handleSuccess}
                    onCancel={() => {}}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {isAdmin && (
              <TabsContent value="team">
                <div className="space-y-6">
                {/* Team Members */}
                <Card className="payroll-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Team Members
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(teamMembers as any[]).map((member: any, index: number) => (
                        <div key={`${member.userId || member.user?.id}-${index}`} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium">{member.userEmail || member.user?.email}</p>
                              <p className="text-sm text-muted-foreground">
                                Joined {new Date(member.joinedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={member.role === 'Admin' ? 'default' : 'secondary'}>
                              <Shield className="h-3 w-3 mr-1" />
                              {member.role}
                            </Badge>
                            {isAdmin && (member.user?.id !== user?.id && member.userId !== user?.id) && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingUser(member);
                                    setEditingRole(member.role);
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRemoveUser(member)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Invite New User */}
                {isAdmin && (
                  <Card className="payroll-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5" />
                        Invite Team Member
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                          <strong>Note:</strong> Invited users will get access to ALL companies you have access to: Test, Noy
                        </p>
                      </div>
                      <form onSubmit={handleInviteSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                              id="email"
                              type="email"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              placeholder="Enter email address"
                              required
                            />
                          </div>
                          {!useMultiCompany && (
                            <div>
                              <Label htmlFor="role">Access Level</Label>
                              <Select value={inviteRole} onValueChange={setInviteRole}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Admin">Admin - Full Access</SelectItem>
                                  <SelectItem value="Employee">Employee - Standard Access</SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground mt-1">
                                Admin: Can manage team, view activity log, and invite users<br/>
                                Employee: Can manage employees, timecards, and generate reports
                              </p>
                            </div>
                          )}
                        </div>



                        <Button
                          type="submit"
                          className="payroll-button-primary"
                          disabled={inviteUserMutation.isPending || !inviteEmail.trim()}
                        >
                          {inviteUserMutation.isPending ? "Sending..." : "Send Invitation"}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {/* Pending Invitations */}
                {isAdmin && invitations.length > 0 && (
                  <Card className="payroll-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Pending Invitations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {invitations.map((invitation: any) => (
                          <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">{invitation.email}</p>
                              <p className="text-sm text-muted-foreground">
                                Invited {new Date(invitation.createdAt).toLocaleDateString()} • 
                                Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge variant="outline">
                              {invitation.role}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                </div>
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="audit">
                <Card className="payroll-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Activity Log
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {auditLog.length === 0 ? (
                        <p className="text-muted-foreground">No activity recorded yet.</p>
                      ) : (
                        auditLog.map((log: any) => (
                          <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg">
                            <div className="flex-1">
                              <p className="text-sm">
                                <span className="font-medium">{log.userEmail}</span> {log.action.replace(/_/g, ' ')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(log.timestamp).toLocaleString()}
                              </p>
                              {log.details && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {JSON.stringify(log.details)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </main>
      </div>

      {/* Remove User Confirmation Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {userToRemove?.userEmail || userToRemove?.user?.email} from your team? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Role Dialog */}
      <AlertDialog open={!!editingUser} onOpenChange={() => {
        setEditingUser(null);
        setEditingRole("");
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update User Role</AlertDialogTitle>
            <AlertDialogDescription>
              Change the access level for {editingUser?.userEmail || editingUser?.user?.email}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="editRole">Access Level</Label>
            <Select value={editingRole} onValueChange={setEditingRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Admin">Admin - Full Access</SelectItem>
                <SelectItem value="Employee">Employee - Standard Access</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRoleUpdate}
              disabled={!editingRole}
            >
              Update Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>  
      </AlertDialog>
    </>
  );
}
                          <div className="space-y-3">
                            <Label>Select Companies & Roles</Label>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {employers.map((company: any) => {
                                const isSelected = selectedCompanies.some(c => c.employerId === company.id);
                                const selectedCompany = selectedCompanies.find(c => c.employerId === company.id);
                                
                                return (
                                  <div key={company.id} className="flex items-center justify-between p-2 border rounded">
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            toggleCompanySelection(company, 'Admin');
                                          } else {
                                            setSelectedCompanies(prev => prev.filter(c => c.employerId !== company.id));
                                          }
                                        }}
                                        className="rounded"
                                      />
                                      <span className="font-medium">{company.name}</span>
                                    </div>
                                    {isSelected && (
                                      <Select 
                                        value={selectedCompany?.role || 'Admin'}
                                        onValueChange={(role) => toggleCompanySelection(company, role)}
                                      >
                                        <SelectTrigger className="w-32">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Admin">Full Access</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <Button 
                          type="submit" 
                          disabled={
                            (useMultiCompany ? inviteMultiCompanyMutation.isPending : inviteUserMutation.isPending) ||
                            (useMultiCompany && selectedCompanies.length === 0)
                          }
                        >
                          {useMultiCompany ? inviteMultiCompanyMutation.isPending : inviteUserMutation.isPending 
                            ? "Sending..." 
                            : useMultiCompany 
                              ? `Send Invitation to ${selectedCompanies.length} Companies`
                              : "Send Invitation"
                          }
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {/* Pending Invitations */}
                {isAdmin && invitations.length > 0 && (
                  <Card className="payroll-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Pending Invitations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {invitations.map((invitation: any) => (
                          <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">{invitation.email}</p>
                              <p className="text-sm text-muted-foreground">
                                Invited {new Date(invitation.createdAt).toLocaleDateString()} • 
                                Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge variant="outline">
                              {invitation.role}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                </div>
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="audit">
                <Card className="payroll-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Activity Log
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {auditLog.length === 0 ? (
                        <p className="text-muted-foreground">No activity recorded yet.</p>
                      ) : (
                        auditLog.map((log: any) => (
                          <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg">
                            <div className="flex-1">
                              <p className="text-sm">
                                <span className="font-medium">{log.userEmail}</span> {log.action.replace(/_/g, ' ')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(log.timestamp).toLocaleString()}
                              </p>
                              {log.details && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {JSON.stringify(log.details)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </main>
      </div>

      {/* Remove User Confirmation Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {userToRemove?.userEmail || userToRemove?.user?.email} from your team? 
              This action cannot be undone and they will lose access to the company data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowRemoveDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveUser}>
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


    </div>
  );
}