import * as k8s from "@kubernetes/client-node";

export function getNamespace(tenantId: string): k8s.V1Namespace {
  return {
    apiVersion: "v1",
    kind: "Namespace",
    metadata: { name: getNamespaceName(tenantId) },
  };
}

export function getVolumeClaim(
  tenantId: string,
  name: string,
): k8s.V1PersistentVolumeClaim {
  return {
    apiVersion: "v1",
    kind: "PersistentVolumeClaim",
    metadata: {
      name: `${name}-pvc-${tenantId}`,
      namespace: getNamespaceName(tenantId),
    },
    spec: {
      accessModes: ["ReadWriteOnce"],
      resources: {
        requests: {
          storage: "500Mi",
        },
      },
    },
  };
}

export function getDeployment(
  tenantId: string,
  name: string,
  container: k8s.V1Container,
  claimName?: string,
): k8s.V1Deployment {
  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: name,
      namespace: getNamespaceName(tenantId),
    },
    spec: {
      replicas: 1,
      selector: {
        matchLabels: {
          app: name,
        },
      },
      template: {
        metadata: {
          labels: {
            app: name,
          },
        },
        spec: {
          containers: [container],
          volumes: claimName
            ? [
                {
                  name: "volume",
                  persistentVolumeClaim: {
                    claimName: claimName,
                  },
                },
              ]
            : [],
        },
      },
    },
  };
}

export function getService(
  tenantId: string,
  name: string,
  port: number,
): k8s.V1Service {
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: name,
      namespace: getNamespaceName(tenantId),
    },
    spec: {
      selector: {
        app: name,
      },
      ports: [
        {
          port: port,
          targetPort: port,
        },
      ],
    },
  };
}

export function getIngress(
  prefix: string,
  tenantId: string,
  paths: { path: string; port: number; serviceName: string }[],
): k8s.V1Ingress {
  return {
    apiVersion: "networking.k8s.io/v1",
    kind: "Ingress",
    metadata: {
      name: `ingress-${prefix}-${tenantId}`,
      namespace: getNamespaceName(tenantId),
    },
    spec: {
      rules: [
        {
          host: `${prefix ? `${prefix}.` : ""}${tenantId}.kite.internal`,
          http: {
            paths: paths.map((path) => ({
              path: path.path,
              pathType: "Prefix",
              backend: {
                service: {
                  name: path.serviceName,
                  port: {
                    number: path.port,
                  },
                },
              },
            })),
          },
        },
      ],
    },
  };
}

function getNamespaceName(tenantId: string): string {
  return `tenant-${tenantId}`;
}
