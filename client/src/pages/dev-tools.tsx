
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

export default function DevTools() {
  const [testUserId, setTestUserId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  if (process.env.NODE_ENV !== 'development') {
    return <div>This page is only available in development mode.</div>;
  }

  const createNewTestUser = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/test-new-user');
      const data = await response.json();
      
      if (response.ok) {
        setTestUserId(data.user.id);
        toast({
          title: "Test User Created",
          description: `User ID: ${data.user.id}`,
        });
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create test user",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsTestUser = async () => {
    if (!testUserId) {
      toast({
        title: "Error",
        description: "Please create a test user first",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: testUserId }),
      });

      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Test Login Successful",
          description: "You are now logged in as the test user",
        });
        
        // Redirect to home page to trigger new user flow
        navigate("/");
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to login as test user",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const logoutTestUser = () => {
    // Simply refresh the page to clear the test session
    window.location.reload();
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Development Tools</h1>
        <p className="text-muted-foreground">Tools for testing the application flow</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Test New User Flow</CardTitle>
            <CardDescription>
              Create and login as a test user to test the new user onboarding flow
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Test User ID</label>
              <Input
                value={testUserId}
                onChange={(e) => setTestUserId(e.target.value)}
                placeholder="Generated test user ID will appear here"
                readOnly={!testUserId}
              />
            </div>
            
            <div className="space-y-2">
              <Button 
                onClick={createNewTestUser} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Creating..." : "1. Create New Test User"}
              </Button>
              
              <Button 
                onClick={loginAsTestUser} 
                disabled={isLoading || !testUserId}
                className="w-full"
                variant="secondary"
              >
                {isLoading ? "Logging in..." : "2. Login as Test User"}
              </Button>
              
              <Button 
                onClick={logoutTestUser} 
                className="w-full"
                variant="outline"
              >
                3. Logout & Clear Session
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
            <CardDescription>How to test the new user flow</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Click "Create New Test User" to generate a unique test user ID</li>
              <li>Click "Login as Test User" to authenticate as that user</li>
              <li>You'll be redirected to the home page where the new user flow should trigger</li>
              <li>Since the test user has no companies, they should be prompted to create one</li>
              <li>After creating a company, they should be taken to the dashboard</li>
              <li>Use "Logout & Clear Session" to reset and test again</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
