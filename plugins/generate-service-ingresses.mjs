import yaml from 'js-yaml';

import { set } from 'lodash-es';

const ingressAnnt = 'com.shieldsbetter.pelton/ingress';

export default async function generateServiceIngresses(input) {
    const resources = await yaml.loadAll(input);

    const services = {};

    for (const r of resources) {
        const rNs = r?.metadata?.namespace || 'default';

        const rAnnotations = r?.metadata?.annotations || {};

        if (r.kind === 'Service' && rAnnotations[ingressAnnt]) {
            const [dns, env, iso] = JSON.parse(
                    rAnnotations['com.shieldsbetter.pelton/parentInstanceId']);

            if (!services[rNs]) {
                services[rNs] = [];
            }

            for (const host of rAnnotations[ingressAnnt].split(',')) {
                const [hostnameSeed, port] = host.split(':');
                let hostnames = buildHostnames(
                        JSON.stringify([hostnameSeed || dns, env, iso]),
                        rAnnotations['com.shieldsbetter.pelton/rootInstanceId']);

                for (const hostname of hostnames) {
                    services[rNs].push({
                        service: r,
                        hostname,
                        port
                    });
                }
            }
        }
    }

    for (const [ns, ss] of Object.entries(services)) {
        const representativeService = ss[0].service;
        const [rootDns, rootEnv, rootIso] = JSON.parse(
                representativeService.metadata.annotations[
                        'com.shieldsbetter.pelton/rootInstanceId']);

        const ingress = await yaml.load(`
            apiVersion: networking.k8s.io/v1
            kind: Ingress
            metadata:
                name: ${rootDns}-${rootEnv}-${rootIso}-ingress
                namespace: ${representativeService.metadata.namespace}
                annotations:
                    nginx.ingress.kubernetes.io/rewrite-target: /
            spec:
                rules: []
        `);

        set(ingress,
                'metadata.labels.com-shieldsbetter-pelton-root-instance',
                representativeService.metadata.labels['com-shieldsbetter-pelton-root-instance']);

        for (const { service, hostname, port } of ss) {
            ingress.spec.rules.push(await yaml.load(`
                host: ${hostname}.localhost
                http:
                    paths:
                    - path: /
                      pathType: Prefix
                      backend:
                          service:
                              name: ${service.metadata.name}
                              port:
                                  number: ${port}
            `));
        }

        resources.push(ingress);
    }

    return resources.map(r => yaml.dump(r)).join('\n\n...\n---\n\n');
}
