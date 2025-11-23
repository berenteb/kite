import { CircleCheckIcon, LockIcon, RocketIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="py-4 px-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            KITE - Kubernetes Isolated Tenant Environments
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          <ThemeToggle />
          {isAuthenticated ? (
            <Button asChild>
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild>
                <Link to="/register">Get Started</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 py-10 lg:py-20">
        <section className="container px-4 md:px-6">
          <div className="flex flex-col items-center text-center space-y-6">
            <h2 className="text-4xl md:text-6xl font-bold tracking-tighter max-w-3xl">
              Manage Your Tenant Infrastructure with Ease
            </h2>
            <p className="text-muted-foreground text-lg md:text-xl max-w-[700px]">
              Create, provision, and manage tenants with just a few clicks.
              Simplify your multi-tenant architecture.
            </p>
            <div className="space-x-4 pt-6">
              <Button size="lg" asChild>
                <Link to={isAuthenticated ? "/dashboard" : "/register"}>
                  {isAuthenticated ? "Go to Dashboard" : "Get Started"}
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="container px-4 md:px-6 py-12 md:py-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="p-3 rounded-full bg-primary/10 mb-4">
                <RocketIcon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Easy Provisioning</h3>
              <p className="text-muted-foreground">
                Create new tenants with a single click and get them up and
                running instantly.
              </p>
            </div>
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="p-3 rounded-full bg-primary/10 mb-4">
                <LockIcon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Secure Management</h3>
              <p className="text-muted-foreground">
                Keep your tenant secrets secure and easily accessible when you
                need them.
              </p>
            </div>
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="p-3 rounded-full bg-primary/10 mb-4">
                <CircleCheckIcon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Real-time Status</h3>
              <p className="text-muted-foreground">
                Monitor the status of your tenants in real-time and take action
                when needed.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-6 border-t border-border/40">
        <div className="container px-4 md:px-6 flex flex-col md:flex-row items-center justify-center md:justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} KITE. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
