import React from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-5xl font-bold mb-4">404</h1>
      <p className="text-xl text-muted-foreground mb-6">
        The page you're looking for doesn't exist.
      </p>
      <Button onClick={() => navigate("/")}>Return to Home</Button>
    </div>
  );
}
