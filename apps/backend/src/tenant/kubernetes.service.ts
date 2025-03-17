import * as k8s from "@kubernetes/client-node";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class KubernetesService implements OnModuleInit {
  private kc: k8s.KubeConfig;
  private k8sApi: k8s.AppsV1Api;
  private k8sCoreApi: k8s.CoreV1Api;
  private k8sNetworkingApi: k8s.NetworkingV1Api;

  constructor(private configService: ConfigService) {
  }

  async onModuleInit() {
    this.kc = new k8s.KubeConfig();
    this.kc.loadFromDefault();

    this.k8sApi = this.kc.makeApiClient(k8s.AppsV1Api);
    this.k8sCoreApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.k8sNetworkingApi = this.kc.makeApiClient(k8s.NetworkingV1Api);
  }

  async createTenantNamespace(tenantId: string): Promise<void> {
    const namespace = {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: {
        name: `tenant-${tenantId}`,
        labels: {
          "tenant-id": tenantId
        }
      }
    };

    await this.k8sCoreApi.createNamespace({
      body: namespace
    });
  }

  async createTenantResources(
    tenantId: string,
    config: {
      postgresPassword: string;
      minioAccessKey: string;
      minioSecretKey: string;
    }
  ): Promise<void> {
    const namespace = `tenant-${tenantId}`;

    // Create PostgreSQL deployment
    const postgresDeployment = {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        name: "postgres",
        namespace
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: "postgres"
          }
        },
        template: {
          metadata: {
            labels: {
              app: "postgres"
            }
          },
          spec: {
            containers: [
              {
                name: "postgres",
                image: "postgres:17",
                env: [
                  {
                    name: "POSTGRES_PASSWORD",
                    value: config.postgresPassword
                  },
                  {
                    name: "POSTGRES_DB",
                    value: "tenantdb"
                  }
                ],
                ports: [
                  {
                    containerPort: 5432
                  }
                ],
                volumeMounts: [
                  {
                    name: "postgres-storage",
                    mountPath: "/var/lib/postgresql/data"
                  }
                ]
              }
            ],
            volumes: [
              {
                name: "postgres-storage",
                persistentVolumeClaim: {
                  claimName: "postgres-pvc"
                }
              }
            ]
          }
        }
      }
    };

    // Create MinIO deployment
    const minioDeployment = {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        name: "minio",
        namespace
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: "minio"
          }
        },
        template: {
          metadata: {
            labels: {
              app: "minio"
            }
          },
          spec: {
            containers: [
              {
                name: "minio",
                image: "minio/minio",
                args: ["server", "/data"],
                env: [
                  {
                    name: "MINIO_ROOT_USER",
                    value: config.minioAccessKey
                  },
                  {
                    name: "MINIO_ROOT_PASSWORD",
                    value: config.minioSecretKey
                  }
                ],
                ports: [
                  {
                    containerPort: 9000
                  }
                ],
                volumeMounts: [
                  {
                    name: "minio-storage",
                    mountPath: "/data"
                  }
                ]
              }
            ],
            volumes: [
              {
                name: "minio-storage",
                persistentVolumeClaim: {
                  claimName: "minio-pvc"
                }
              }
            ]
          }
        }
      }
    };

    // Create services
    const postgresService = {
      apiVersion: "v1",
      kind: "Service",
      metadata: {
        name: "postgres",
        namespace
      },
      spec: {
        selector: {
          app: "postgres"
        },
        ports: [
          {
            port: 5432,
            targetPort: 5432
          }
        ]
      }
    };

    const minioService = {
      apiVersion: "v1",
      kind: "Service",
      metadata: {
        name: "minio",
        namespace
      },
      spec: {
        selector: {
          app: "minio"
        },
        ports: [
          {
            port: 9000,
            targetPort: 9000
          }
        ]
      }
    };

    // Create ingress
    const ingress = {
      apiVersion: "networking.k8s.io/v1",
      kind: "Ingress",
      metadata: {
        name: "tenant-ingress",
        namespace,
        annotations: {
          "nginx.ingress.kubernetes.io/rewrite-target": "/"
        }
      },
      spec: {
        rules: [
          {
            host: `${tenantId}.your-domain.com`,
            http: {
              paths: [
                {
                  path: "/api",
                  pathType: "Prefix",
                  backend: {
                    service: {
                      name: "backend",
                      port: {
                        number: 3000
                      }
                    }
                  }
                },
                {
                  path: "/",
                  pathType: "Prefix",
                  backend: {
                    service: {
                      name: "frontend",
                      port: {
                        number: 80
                      }
                    }
                  }
                }
              ]
            }
          }
        ]
      }
    };

    // Apply all resources
    await Promise.all([
      this.k8sApi.createNamespacedDeployment({
        body: postgresDeployment,
        namespace: namespace
      }),
      this.k8sApi.createNamespacedDeployment({
        body: minioDeployment,
        namespace: namespace
      }),
      this.k8sCoreApi.createNamespacedService({
        body: postgresService,
        namespace: namespace
      }),
      this.k8sCoreApi.createNamespacedService({
        body: minioService,
        namespace: namespace
      }),
      this.k8sNetworkingApi.createNamespacedIngress({
        body: ingress,
        namespace: namespace
      })
    ]);
  }

  async deleteTenant(tenantId: string): Promise<void> {
    const namespace = `tenant-${tenantId}`;
    await this.k8sCoreApi.deleteNamespace({
      name: namespace
    });
  }

  async getTenantStatus(tenantId: string): Promise<{
    status: "running" | "failed" | "deleting";
    resources: {
      postgres: boolean;
      minio: boolean;
      frontend: boolean;
      backend: boolean;
    };
  }> {
    const namespace = `tenant-${tenantId}`;

    try {
      const [postgresDeployment, minioDeployment] = await Promise.all([
        this.k8sApi.readNamespacedDeployment({
          name: "postgres",
          namespace: namespace
        }),
        this.k8sApi.readNamespacedDeployment({
          name: "minio",
          namespace: namespace
        })
      ]);

      return {
        status: "running",
        resources: {
          postgres: postgresDeployment.status?.availableReplicas === 1,
          minio: minioDeployment.status?.availableReplicas === 1,
          frontend: true,
          backend: true
        }
      };
    } catch (error) {
      if (error.response?.statusCode === 404) {
        return {
          status: "deleting",
          resources: {
            postgres: false,
            minio: false,
            frontend: false,
            backend: false
          }
        };
      }
      throw error;
    }
  }
}
