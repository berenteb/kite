import { AuthApi } from "@/api";
import { LoginDto, RegisterDto } from "@/api/api";
import { setupApi } from "@/lib/api.utils";

const authAPi = setupApi(AuthApi);

export async function register(data: RegisterDto) {
  const response = await authAPi.authControllerRegister(data);
  return response.data;
}

export async function login(data: LoginDto) {
  const response = await authAPi.authControllerLogin(data);
  return response.data;
}

export async function logout() {
  const response = await authAPi.authControllerLogout();
  return response.data;
}

export async function getCurrentUser() {
  const response = await authAPi.authControllerGetCurrentUser();
  return response.data;
}
