import axios, { type AxiosInstance } from "axios";

import { type Configuration } from "@/api";
import { BACKEND_URL } from "@/config/environment";

const defaultAxiosInstance = axios.create({
  baseURL: BACKEND_URL,
  withCredentials: true,
});

export function setupApi<T>(
  className: new (
    configuration?: Configuration,
    basePath?: string,
    axios?: AxiosInstance,
  ) => T,
  axiosInstance?: AxiosInstance,
): T {
  return new className(
    undefined,
    undefined,
    axiosInstance ?? defaultAxiosInstance,
  );
}
