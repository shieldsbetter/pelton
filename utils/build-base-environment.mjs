const pltnPrefix = process.env.PELTON_DEPENDENCY_NAMESPACE_PREFIX ?? 'pltn-';

export default function buildBaseEnvironment(
        rootId, sourceId, targetNs, peltonRunId) {
    const isRootProject = rootId.every((el, i) => el === sourceId[i]);

    const dependencyNs = `${pltnPrefix}${rootId[0]}-${rootId[1]}-${rootId[2]}`;
    const projectNs = isRootProject ? targetNs : dependencyNs;

    return [
        projectNs,
        dependencyNs,
        {
            PELTON_DEPENDENCY_POD_DOMAIN: `${dependencyNs}.pod.cluster.local`,
            PELTON_DEPENDENCY_SERVICE_DOMAIN: `${dependencyNs}.svc.cluster.local`,
            PELTON_ENVIRONMENT: sourceId[1],
            PELTON_ISOLATION: sourceId[2],
            PELTON_PROJECT_POD_DOMAIN: `${projectNs}.pod.cluster.local`,
            PELTON_PROJECT_SERVICE_DOMAIN: `${projectNs}.svc.cluster.local`,
            PELTON_ROOT_ACTIVATION: rootId.join('.'),
            PELTON_RUN: peltonRunId,
            PELTON_SOURCE_ACTIVATION: sourceId.join('.')
        }
    ];
}