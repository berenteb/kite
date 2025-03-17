import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { LoginDto, RegisterDto, UserDto } from "@/api/api";
import {
  useCurrentUserQuery,
  useLoginMutation,
  useLogoutMutation,
  useRegisterMutation,
} from "@/hooks/use-auth";

interface AuthContextType {
  user: UserDto | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginDto) => Promise<void>;
  register: (data: RegisterDto) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const userQuery = useCurrentUserQuery();
  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();
  const logoutMutation = useLogoutMutation();
  const navigate = useNavigate();

  const login = async (data: LoginDto) => {
    await loginMutation.mutateAsync(data);
    navigate("/");
  };

  const register = async (data: RegisterDto) => {
    await registerMutation.mutateAsync(data);
    navigate("/");
  };

  const logout = () => {
    logoutMutation.mutateAsync();
    navigate("/login");
  };

  const value = {
    user: userQuery.data,
    isLoading: userQuery.isLoading,
    isAuthenticated: Boolean(userQuery.data),
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
