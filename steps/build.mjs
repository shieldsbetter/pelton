import inDependencyOrder from '../utils/in-dependency-order.mjs';

export default async function build(
        targetDir, env = 'default', iso = 'a', services) {
    let stream = Promise.resolve();

    const results = {};

    let targetId;
    let targetConfig;
    await inDependencyOrder(targetDir, env, iso, services,
            (id, config, depRes, { dependencyPath, projectDirectory }) => {
        services.debug(`### Building ${id}`);

        if (dependencyPath.length === 0) {
            targetId = id;
            targetConfig = config;
        }

        const buildCommand = config.environments[id[1]].buildCommand;

        if (!buildCommand) {
            return;
        }

        const process = services.executor({
            PELTON_ENVIRONMENT: env,
            PELTON_ISOLATION: iso,

            ...(config.environments[id[1]].variables || {})
        })
        .cd(projectDirectory).andThen().eval(buildCommand).run();

        process.stderr.pause();

        stream = stream.then(async () => {
            process.stderr.resume();
            const instanceLabel = (config.name || config.dnsName)
                    + ' > ' + id[1] + ' > ' + id[2];
            await services.logTask(
                    `Building ${instanceLabel}...`, process.stderr);

            results[JSON.stringify(id)] =
                    (await process).stdout.trim().substring(-1000);

            services.debug(`### Done building ${id}`);
        });

        return stream;
    });

    return { results, targetId, targetConfig };
}
