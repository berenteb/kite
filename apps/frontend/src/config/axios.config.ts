import axios from "axios";

import { BACKEND_URL } from "./environment";

export const axiosConfig = axios.create({
  baseURL: BACKEND_URL,
  withCredentials: true,
});
