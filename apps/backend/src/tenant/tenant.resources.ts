import * as k8s from "@kubernetes/client-node";

export function getNamespace(tenantId: string): k8s.V1Namespace {
  return {
    apiVersion: "v1",
    kind: "Namespace",
    metadata: { name: getNamespaceName(tenantId) },
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
  host: string,
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
          host: `${prefix ? `${prefix}.` : ""}${tenantId}.${host}`,
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

export function getStatefulSet(
  tenantId: string,
  name: string,
  container: k8s.V1Container,
): k8s.V1StatefulSet {
  return {
    apiVersion: "apps/v1",
    kind: "StatefulSet",
    metadata: {
      name: name,
      namespace: getNamespaceName(tenantId),
    },
    spec: {
      serviceName: name,
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
        },
      },
      volumeClaimTemplates: [
        {
          metadata: {
            namespace: getNamespaceName(tenantId),
            name: "data",
          },
          spec: {
            accessModes: ["ReadWriteOnce"],
            resources: {
              requests: {
                storage: "500Mi",
              },
            },
          },
        },
      ],
    },
  };
}

function getNamespaceName(tenantId: string): string {
  return `tenant-${tenantId}`;
}
