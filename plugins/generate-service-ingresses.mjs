import yaml from 'js-yaml';

import { set } from 'lodash-es';

const ingressAnnt = 'com.shieldsbetter.pelton/ingress';

export default function generateServiceIngresses(input, deps) {
    deps = {
        stderr: process.stderr,
        env: process.env,
        ...deps
    };

    const resources = yaml.loadAll(input);

    const domainSuffixes =
            (deps.env.PELTON_GSI_DOMAIN_SUFFIX ?? '.localhost').split(',');

    const services = {};

    for (const r of resources) {
        const rNs = r?.metadata?.namespace || 'default';
        const rAnnotations = r?.metadata?.annotations || {};
        const rName = r?.metadata?.name;

        if (!rName) {
            throw new Error('Service does not have a metadata.name field.');
        }

        if (r.kind === 'Service' && rAnnotations[ingressAnnt]) {
            if (!services[rNs]) {
                services[rNs] = [];
            }

            const [srcDns, srcEnv, srcIso] =
                    rAnnotations['com.shieldsbetter.pelton/sourceActivation']
                    .split('.');

            const spec = typeof rAnnotations[ingressAnnt] === 'number'
                    ? `${rAnnotations[ingressAnnt]}`
                    : rAnnotations[ingressAnnt];
            for (const host of spec.split(',')) {
                // hostname:port is deprecated but still allowed. hostname=>port
                // is now preferred.
                let [dnsPrefix, port] = host.split(/(?::|=>)/);
                if (port === undefined) {
                    port = dnsPrefix;
                    dnsPrefix = `${rName.replace('-', '')}-${srcEnv}-${srcIso}`;
                }

                const [rootDns, rootEnv, rootIso] =
                        rAnnotations['com.shieldsbetter.pelton/rootActivation']
                        .split('.');

                const root = rAnnotations['com.shieldsbetter.pelton/sourceActivation']
                        === rAnnotations['com.shieldsbetter.pelton/rootActivation'];

                const dependencyFragments =
                        (deps.env.PELTON_GSI_DEPENDENCY_FRAGMENT
                            ?? `.${rootDns.replace('-', '')}-${rootEnv}-${rootIso}`)
                        .split(',');

                const hostnames = crossStrings(
                        [dnsPrefix],
                        root
                            ? domainSuffixes
                            : crossStrings(
                                    dependencyFragments, domainSuffixes));

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
        const [rootDns, rootEnv, rootIso] =
                representativeService.metadata.annotations[
                        'com.shieldsbetter.pelton/rootActivation'].split('.');

        const ingress = yaml.load(`
            apiVersion: networking.k8s.io/v1
            kind: Ingress
            metadata:
                name: ${rootDns}-${rootEnv}-${rootIso}-ingress
                namespace: ${ns}
                annotations:
                    nginx.ingress.kubernetes.io/rewrite-target: /
            spec:
                rules: []
        `);

        set(ingress,
                'metadata.labels.com-shieldsbetter-pelton-root-activation',
                representativeService.metadata.labels['com-shieldsbetter-pelton-root-activation']);

        for (const { service, hostname, port } of ss) {
            deps.stderr.write(`${hostname} -->`
                    + ` ${service.metadata.name}:${port}\n`);
            ingress.spec.rules.push(yaml.load(`
                host: ${hostname}
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

function crossStrings(a1, a2) {
    const result = [];

    for (const el1 of a1) {
        for (const el2 of a2) {
            result.push(`${el1}${el2}`);
        }
    }

    return result;
}