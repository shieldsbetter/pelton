import buildBaseEnvironment from '../utils/build-base-environment.mjs';
import getVariables from '../utils/get-variables.mjs';
import inDependencyOrder from '../utils/in-dependency-order.mjs';

const pltnPrefix = process.env.PELTON_DEPENDENCY_NAMESPACE_PREFIX ?? 'pltn-';

export default async function build(
        targetDir, env = 'default', iso = 'a', targetNs, services) {
    let stream = Promise.resolve();

    const results = {};

    let targetId;
    let targetConfig;
    await inDependencyOrder(targetDir, env, iso, services,
            async (id, config, depRes, { dependencyPath, projectDirectory }) => {
        services.debug(`### Building ${id}`);

        if (dependencyPath.length === 0) {
            targetId = id;
            targetConfig = config;
        }

        const buildCommand = config.environments[id[1]].build
                || config.environments[id[1]].buildCommand;

        if (!buildCommand) {
            return;
        }

        const [,,baseEnv] = buildBaseEnvironment(
                dependencyPath[0] ?? id, id, targetNs, services.peltonRunId);

        const process = services.executor({
            ...baseEnv,
            ...await getVariables(services, config, id[1])
        })
        .cd(projectDirectory).andThen().eval(buildCommand).run();

        process.stderr.pause();

        stream = stream.then(async () => {
            process.stderr.resume();
            const activationId = (config.name || config.dnsName)
                    + '.' + id[1] + '.' + id[2];
            await services.logTask(
                    `Building ${activationId}...`, process, 'stderr');

            results[activationId] =
                    (await process).stdout.trim().substring(-1000);

            services.debug(`### Done building ${id}`);
        });

        return stream;
    });

    return { results, targetId, targetConfig };
}
