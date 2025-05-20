import * as k8s from "@kubernetes/client-node";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { ComponentStatus, TenantComponentStatusDto } from "./tenant.dto";
import {
  getDeployment,
  getIngress,
  getNamespace,
  getService,
  getStatefulSet,
} from "./tenant.resources";

const MIN_REPLICAS = 1;

@Injectable()
export class KubernetesService implements OnModuleInit {
  private readonly logger = new Logger(KubernetesService.name);
  private kc: k8s.KubeConfig;
  private k8sApi: k8s.AppsV1Api;
  private k8sCoreApi: k8s.CoreV1Api;
  private k8sNetworkingApi: k8s.NetworkingV1Api;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.kc = new k8s.KubeConfig();

    // In development, use minikube context
    if (process.env.NODE_ENV === "development") {
      this.kc.loadFromFile(
        this.configService.get("KUBECONFIG") ||
          `${process.env.HOME}/.kube/config`,
      );
      this.kc.setCurrentContext("minikube");
    } else {
      this.kc.loadFromDefault();
    }

    this.k8sApi = this.kc.makeApiClient(k8s.AppsV1Api);
    this.k8sCoreApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.k8sNetworkingApi = this.kc.makeApiClient(k8s.NetworkingV1Api);
  }

  async createNamespace(tenantId: string): Promise<void> {
    const namespace = getNamespace(tenantId);

    await this.k8sCoreApi.createNamespace({
      body: namespace,
    });

    this.logger.log(`Created namespace ${namespace.metadata?.name}`);
  }

  async createResources(
    tenantId: string,
    config: {
      postgresUser: string;
      postgresPassword: string;
      postgresDatabase: string;
      minioAccessKey: string;
      minioSecretKey: string;
    },
  ): Promise<void> {
    const namespace = `tenant-${tenantId}`;
    const clusterDomain = this.configService.get("clusterDomain");

    const postgresStatefulSet = getStatefulSet(tenantId, "postgres", {
      name: "postgres",
      image: "postgres:17",
      ports: [
        {
          containerPort: 5432,
          name: "postgres",
        },
      ],
      env: [
        { name: "POSTGRES_PASSWORD", value: config.postgresPassword },
        { name: "POSTGRES_USER", value: config.postgresUser },
        { name: "POSTGRES_DB", value: config.postgresDatabase },
      ],
      volumeMounts: [
        {
          name: "data",
          mountPath: "/var/lib/postgresql/data",
        },
      ],
      readinessProbe: {
        exec: {
          command: [
            "pg_isready",
            "-U",
            config.postgresUser,
            "-d",
            config.postgresDatabase,
          ],
        },
        initialDelaySeconds: 5,
        periodSeconds: 10,
      },
      livenessProbe: {
        exec: {
          command: [
            "pg_isready",
            "-U",
            config.postgresUser,
            "-d",
            config.postgresDatabase,
          ],
        },
        initialDelaySeconds: 30,
        periodSeconds: 10,
      },
    });

    const minioStatefulSet = getStatefulSet(tenantId, "minio", {
      name: "minio",
      image: "minio/minio:latest",
      args: ["server", "/data"],
      env: [
        { name: "MINIO_ROOT_USER", value: config.minioAccessKey },
        { name: "MINIO_ROOT_PASSWORD", value: config.minioSecretKey },
      ],
      ports: [
        {
          containerPort: 9000,
          name: "minio",
        },
        {
          containerPort: 9001,
          name: "minio-console",
        },
      ],
      volumeMounts: [
        {
          name: "data",
          mountPath: "/data",
        },
      ],
      readinessProbe: {
        httpGet: {
          path: "/minio/health/ready",
          port: 9000,
        },
        initialDelaySeconds: 5,
        periodSeconds: 10,
      },
      livenessProbe: {
        httpGet: {
          path: "/minio/health/live",
          port: 9000,
        },
        initialDelaySeconds: 30,
        periodSeconds: 10,
      },
    });

    const backendDeployment = getDeployment(tenantId, "backend", {
      name: "backend",
      image: "snapster-backend:latest",
      imagePullPolicy: "Never",
      ports: [
        {
          containerPort: 3001,
          name: "backend",
        },
      ],
      env: [
        { name: "BACKEND_PORT", value: "3001" },
        { name: "JWT_SECRET", value: "sfhaisfogphaishfa" },
        { name: "COOKIE_DOMAIN", value: clusterDomain },
        {
          name: "FRONTEND_URL",
          value: this.getAccessUrl(tenantId),
        },
        { name: "SALT", value: "5" },
        {
          name: "STORAGE_ENDPOINT",
          value: "minio",
        },
        {
          name: "STORAGE_PORT",
          value: "9000",
        },
        {
          name: "STORAGE_PUBLIC_URL",
          value: `${this.getAccessUrl(tenantId)}/cdn`,
        },
        { name: "STORAGE_ACCESS_KEY", value: config.minioAccessKey },
        { name: "STORAGE_SECRET_KEY", value: config.minioSecretKey },
        { name: "STORAGE_DEFAULT_BUCKET", value: "default" },
        { name: "STORAGE_USE_SSL", value: "false" },
        { name: "UPLOAD_MAX_FILE_SIZE", value: "5248000" },
        {
          name: "DATABASE_URL",
          value: `postgresql://tenant:${config.postgresPassword}@postgres:5432/tenantdb`,
        },
      ],
      readinessProbe: {
        httpGet: {
          path: "/health",
          port: 3001,
        },
        initialDelaySeconds: 5,
        periodSeconds: 10,
      },
      livenessProbe: {
        httpGet: {
          path: "/health",
          port: 3001,
        },
        initialDelaySeconds: 30,
        periodSeconds: 10,
      },
    });

    const frontendDeployment = getDeployment(tenantId, "frontend", {
      name: "frontend",
      image: "snapster-frontend:latest",
      imagePullPolicy: "Never",
      ports: [{ containerPort: 3000, name: "frontend" }],
      env: [
        { name: "BACKEND_HOST", value: "backend:3001" },
        { name: "CDN_HOST", value: "minio:9000" },
      ],
      readinessProbe: {
        httpGet: {
          path: "/",
          port: 3000,
        },
        initialDelaySeconds: 5,
        periodSeconds: 10,
      },
      livenessProbe: {
        httpGet: {
          path: "/",
          port: 3000,
        },
        initialDelaySeconds: 30,
        periodSeconds: 10,
      },
    });

    const postgresService = getService(tenantId, "postgres", 5432);
    const minioService = getService(tenantId, "minio", 9000);
    const backendService = getService(tenantId, "backend", 3001);
    const frontendService = getService(tenantId, "frontend", 3000);

    const host = this.configService.get("clusterDomain");

    const ingress = getIngress("", tenantId, host, [
      { path: "/", port: 3000, serviceName: "frontend" },
    ]);

    const cdnIngress = getIngress("cdn", tenantId, host, [
      { path: "/", port: 9000, serviceName: "minio" },
    ]);

    const statefulSets = [postgresStatefulSet, minioStatefulSet];
    for (const resource of statefulSets) {
      await this.k8sApi.createNamespacedStatefulSet({
        body: resource,
        namespace,
      });

      this.logger.log(`Created StatefulSet ${resource.metadata?.name}`);
    }

    // Create deployments
    const deployments = [backendDeployment, frontendDeployment];
    for (const resource of deployments) {
      await this.k8sApi.createNamespacedDeployment({
        body: resource,
        namespace,
      });

      this.logger.log(`Created deployment ${resource.metadata?.name}`);
    }

    // Create services
    const services = [
      postgresService,
      minioService,
      backendService,
      frontendService,
    ];
    for (const resource of services) {
      await this.k8sCoreApi.createNamespacedService({
        body: resource,
        namespace,
      });

      this.logger.log(`Created service ${resource.metadata?.name}`);
    }

    const ingresses = [ingress, cdnIngress];
    for (const resource of ingresses) {
      await this.k8sNetworkingApi.createNamespacedIngress({
        body: resource,
        namespace,
      });

      this.logger.log(`Created ingress ${resource.metadata?.name}`);
    }
  }

  async deleteTenant(tenantId: string): Promise<void> {
    const namespace = this.getNamespaceName(tenantId);
    await this.k8sCoreApi.deleteNamespace({
      name: namespace,
    });

    this.logger.log(`Deleted namespace ${namespace}`);
  }

  private getNamespaceName(tenantId: string): string {
    return `tenant-${tenantId}`;
  }

  private getAccessUrl(tenantId: string): string {
    const useTLS = this.configService.get("clusterUseTLS");
    const domain = this.configService.get("clusterDomain");

    return `${useTLS ? "https" : "http"}://${tenantId}.${domain}`;
  }

  async getComponentStatus(
    tenantId: string,
    component: string,
  ): Promise<TenantComponentStatusDto> {
    const namespace = this.getNamespaceName(tenantId);

    try {
      // Try to get deployment first
      try {
        const deployment = await this.k8sApi.readNamespacedDeployment({
          name: component,
          namespace,
        });
        const status = deployment.status;

        if (!status) {
          return {
            name: component,
            status: ComponentStatus.UNAVAILABLE,
            message: "No status available",
          };
        }

        if (this.isPodReady(status)) {
          return {
            name: component,
            status: ComponentStatus.RUNNING,
            message: null,
          };
        } else if (this.isPodError(status)) {
          return {
            name: component,
            status: ComponentStatus.ERROR,
            message: "Pods are in error state",
          };
        } else if (this.isPodPending(status)) {
          return {
            name: component,
            status: ComponentStatus.PENDING,
            message: `${status.unavailableReplicas} replicas are not yet ready`,
          };
        } else if (this.isPodUnhealthy(status)) {
          return {
            name: component,
            status: ComponentStatus.UNHEALTHY,
            message: "Pods are unhealthy",
          };
        }
      } catch (error) {
        // If deployment not found, try StatefulSet
        try {
          const statefulSet = await this.k8sApi.readNamespacedStatefulSet({
            name: component,
            namespace,
          });
          const status = statefulSet.status;

          if (!status) {
            return {
              name: component,
              status: ComponentStatus.UNAVAILABLE,
              message: "No status available",
            };
          }

          const desiredReplicas = status.replicas ?? 0;
          const availableReplicas = status.availableReplicas ?? 0;
          const readyReplicas = status.readyReplicas ?? 0;
          const currentReplicas = status.currentReplicas ?? 0;

          if (
            availableReplicas === desiredReplicas &&
            readyReplicas === desiredReplicas &&
            currentReplicas === desiredReplicas
          ) {
            return {
              name: component,
              status: ComponentStatus.RUNNING,
              message: null,
            };
          } else if (status.conditions?.some((c) => c.type === "Failed")) {
            return {
              name: component,
              status: ComponentStatus.ERROR,
              message: "Pods are in error state",
            };
          } else if (
            availableReplicas < desiredReplicas ||
            readyReplicas < desiredReplicas ||
            currentReplicas < desiredReplicas
          ) {
            return {
              name: component,
              status: ComponentStatus.PENDING,
              message: `${desiredReplicas - availableReplicas} replicas are not yet ready`,
            };
          } else if (
            status.conditions?.some(
              (c) => c.type === "Progressing" && c.status === "False",
            )
          ) {
            return {
              name: component,
              status: ComponentStatus.UNHEALTHY,
              message: "Pods are unhealthy",
            };
          }
        } catch (statefulSetError) {
          // If both deployment and StatefulSet not found, return error
          return {
            name: component,
            status: ComponentStatus.ERROR,
            message: "Component not found",
          };
        }
      }

      return {
        name: component,
        status: ComponentStatus.UNKNOWN,
        message: "Unknown status",
      };
    } catch (error) {
      return {
        name: component,
        status: ComponentStatus.ERROR,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private isPodReady(status: k8s.V1DeploymentStatus): boolean {
    const desiredReplicas = status.replicas ?? 0;
    const availableReplicas = status.availableReplicas ?? 0;
    const updatedReplicas = status.updatedReplicas ?? 0;
    const readyReplicas = status.readyReplicas ?? 0;
    const unavailableReplicas = status.unavailableReplicas ?? 0;

    return (
      availableReplicas === desiredReplicas &&
      updatedReplicas === desiredReplicas &&
      readyReplicas === desiredReplicas &&
      unavailableReplicas === 0
    );
  }

  private isPodUnhealthy(status: k8s.V1DeploymentStatus): boolean {
    const unavailableReplicas = status.unavailableReplicas ?? 0;
    const updatedReplicas = status.updatedReplicas ?? 0;
    const replicas = status.replicas ?? 0;
    const readyReplicas = status.readyReplicas ?? 0;

    return (
      unavailableReplicas > 0 ||
      updatedReplicas < replicas ||
      readyReplicas < replicas
    );
  }

  private isPodPending(status: k8s.V1DeploymentStatus): boolean {
    const desiredReplicas = status.replicas ?? 0;
    const availableReplicas = status.availableReplicas ?? 0;
    const updatedReplicas = status.updatedReplicas ?? 0;
    const readyReplicas = status.readyReplicas ?? 0;
    const conditions = status.conditions ?? [];

    // Check if deployment is progressing but not yet ready
    const isProgressing = conditions.some(
      (condition) =>
        condition.type === "Progressing" &&
        condition.status === "True" &&
        (condition.reason === "NewReplicaSetAvailable" ||
          condition.reason === "ReplicaSetUpdated"),
    );

    // Pod is pending if it's progressing or if replicas are being updated but not all are ready yet
    return (
      isProgressing ||
      (updatedReplicas > 0 && updatedReplicas < desiredReplicas) ||
      (readyReplicas < desiredReplicas && availableReplicas < desiredReplicas)
    );
  }

  private isPodError(status: k8s.V1DeploymentStatus): boolean {
    const collisionCount = status.collisionCount ?? 0;
    const conditions = status.conditions ?? [];
    return (
      collisionCount > 0 ||
      conditions.some((condition) => condition.type === "Failed")
    );
  }
}
