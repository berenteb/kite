import React from "react";
import { Navigate, Outlet } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

import { ThemeToggle } from "./theme-toggle";
import { LoadingSpinner } from "./ui/loading-spinner";

export function AppLayout() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-card border-b border-border/40 shadow-sm">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center space-x-4">
            <a href="/dashboard" className="text-xl font-bold">
              Kite
            </a>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-muted-foreground">{user?.email}</div>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 container py-6">
        <Outlet />
      </main>
      <footer className="py-6 border-t border-border/40">
        <div className="container flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Kite. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
