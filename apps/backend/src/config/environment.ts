import * as dotenv from "dotenv";
import * as env from "env-var";

dotenv.config();

const environment = () => ({
  port: env.get("BACKEND_PORT").required().asPortNumber(),
  jwtSecret: env.get("JWT_SECRET").required().asString(),
  cookieDomain: env.get("COOKIE_DOMAIN").required().asString(),
  frontendUrl: env.get("FRONTEND_URL").required().asString(),
  salt: env.get("SALT").required().asIntPositive(),
  clusterDomain: env.get("CLUSTER_DOMAIN").required().asString(),
  clusterUseTLS: env.get("CLUSTER_USE_TLS").required().asBool(),
});

export default environment;

export type Environment = ReturnType<typeof environment>;
