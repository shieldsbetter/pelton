import buildBaseEnvironment from '../utils/build-base-environment.mjs';
import getVariables from '../utils/get-variables.mjs';
import inDependencyOrder from '../utils/in-dependency-order.mjs';
import yamlLib from 'js-yaml';

import { set } from 'lodash-es';

const pltnPrefix = process.env.PELTON_DEPENDENCY_NAMESPACE_PREFIX ?? 'pltn-';

export default async function manifest(targetDir, env = 'default',
        iso = 'a', { results: buildResults, targetConfig, targetId }, targetNs,
        plugins, argv, services) {
    let stream = Promise.resolve();

    const resources = [];

    await inDependencyOrder(targetDir, env, iso, services,
            async (id, config, depRes, {
                dependencies, dependencyPath, projectDirectory
            }) => {

        services.debug(`### Creating manifest for ${id}`);

        const printManifestCommand =
                config.environments[id[1]].printProjectManifest;

        if (!printManifestCommand) {
            return;
        }

        const [projectNs,,baseEnv] = buildBaseEnvironment(
                dependencyPath[0] ?? id, id, targetNs, services.peltonRunId);

        const envVars = {
            ...baseEnv,
            ...await getVariables(services, config, id[1]),
            PELTON_BUILD_RESULT: buildResults[id.join('.')],
        };

        if (dependencyPath.length === 0) {
            envVars.PELTON_EXTRA_ARGS = JSON.stringify(argv);
        }
        else {
            envVars.PELTON_EXTRA_ARGS = '[]';
        }

        const printManifest = services.executor(envVars)
                .cd(projectDirectory)
                .andThen().eval(printManifestCommand)
                .run();

        printManifest.stderr.pause();

        stream = stream.then(async () => {
            printManifest.stderr.resume();
            const activationLabel = id.join('.');
            await services.logTask(`Generating ${activationLabel} manifest...`,
                    printManifest, 'stderr');

            try {
                yamlLib.loadAll((await printManifest).stdout, resource => {
                    set(resource, 'metadata.namespace', projectNs);
                    set(resource,
                            'metadata.labels.com-shieldsbetter-pelton-root-activation',
                            `${targetId[0]}.${targetId[1]}.${targetId[2]}`);

                    annotate(resource, {
                        dependencyActivationIds: dependencies.map(
                                ([id]) => id.join('.')).join(','),
                        sourceProjectConfig: JSON.stringify(config),
                        sourceActivation: id.join('.'),
                        sourceActivationDns: id[0],
                        sourceActivationEnvironment: id[1],
                        sourceActivationIsolation: id[2],
                        sourceProjectDirectory: projectDirectory,
                        rootActivation: targetId.join('.')
                    });

                    resources.push(resource);
                });
            }
            catch (e) {
                console.error((await printManifest).stdout);
                console.error('\nError parsing above manifest:\n')
                console.error(e.message);
                process.exit(1);
            }

            services.debug(`### Done creating manifest for ${id}`);
        });

        return stream;
    });

    const [,,baseEnv] = buildBaseEnvironment(
            targetId, targetId, targetNs, services.peltonRunId);

    const envVars = {
        ...baseEnv,
        ...await getVariables(services, targetConfig, targetId[1]),
        PELTON_BUILD_RESULT: buildResults[targetId.join('.')],
    };

    let yaml = resources.map(r => yamlLib.dump(r)).join('\n\n...\n---\n\n');
    for (const pluginCmd of array(plugins)) {
        const pluginRun = services.executor(envVars)
                .echo(yaml).pipe().eval(pluginCmd).run();
        await services.logTask(
                `Plugin "${pluginCmd}"...`, pluginRun, 'stderr');
        yaml = (await pluginRun).stdout;

        try {
            await yamlLib.loadAll(yaml);
        }
        catch (e) {
            console.error(`Plugin "${pluginCmd}" generated bad yaml:\n`);
            console.error(yaml);
            console.error('\n' + e.message);
            process.exit(1);
        }
    }

    return yaml;
}

function annotate(r, o) {
    for (const [key, val] of Object.entries(o)) {
        set(r, annotationKey(key), val);
    }
}

function annotationKey(k) {
    return ['metadata', 'annotations', `com.shieldsbetter.pelton/${k}`];
}

function array(v) {
    if (v === undefined) {
        return [];
    }

    if (!Array.isArray(v)) {
        return [v];
    }

    return v;
}
