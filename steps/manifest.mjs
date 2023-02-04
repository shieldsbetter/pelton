import inDependencyOrder from '../utils/in-dependency-order.mjs';
import yamlLib from 'js-yaml';

import { set } from 'lodash-es';

export default async function manifest(targetDir, env = 'default',
        iso = 'a', { results: buildResults, targetConfig, targetId }, targetNs,
        plugins, argv, services) {
    let stream = Promise.resolve();

    const resources = [];

    await inDependencyOrder(targetDir, env, iso, services,
            (id, config, depRes,
                { dependencies, dependencyPath, projectDirectory }) => {
        const printManifestCommand =
                config.environments[id[1]].printTerminalDependencies;

        if (!printManifestCommand) {
            return;
        }

        const envVars = {
            PELTON_BRES: buildResults[JSON.stringify(id)],
            PELTON_ENVIRONMENT: id[1],
            PELTON_ISOLATION: id[2],
            ...(config.environments[id[1]].variables || {})
        };

        for (let i = 0; i < dependencies.length; i++) {
            const [dDns, dEnv, dIso] = dependencies[i][0];

            envVars[`PELTON_BRES_DEP_${i}`] =
                    buildResults[JSON.stringify(dependencies[i][0])];
            envVars[`PELTON_BRES_${toEnv(dDns)}_${toEnv(dEnv)}_${toEnv(dIso)}`] =
                    buildResults[JSON.stringify(dependencies[i][0])];
        }

        let namespace;
        if (dependencyPath.length === 0) {
            namespace = targetNs;
            process.env.PELTON_TARGET_ARGS = JSON.stringify(argv);
        }
        else {
            const [tDns, tEnv, tIso] = dependencyPath[0];
            namespace = `pltn-${tDns}-${tEnv}-${tIso}`;
        }

        const printManifest = services.executor(envVars)
                .cd(projectDirectory)
                .andThen().eval(printManifestCommand)
                .run();

        printManifest.stderr.pause();

        stream = stream.then(async () => {
            printManifest.stderr.resume();
            const instanceLabel = (config.name || config.dnsName)
                    + ' > ' + id[1] + ' > ' + id[2];
            await services.logTask(`Generating ${instanceLabel} manifest...`,
                    printManifest.stderr);

            try {
                yamlLib.loadAll((await printManifest).stdout, resource => {
                    set(resource, 'metadata.namespace', namespace);
                    set(resource,
                            'metadata.labels.com-shieldsbetter-pelton-root-instance',
                            `${targetId[0]}.${targetId[1]}.${targetId[2]}`);

                    annotate(resource, {
                        dependencyInstanceIds: JSON.stringify(
                                dependencies.map(([id]) => id)),
                        instanceEnvironmentConfig: JSON.stringify(config),
                        parentInstanceId: JSON.stringify(id),
                        parentInstanceDns: id[0],
                        parentInstanceEnvironment: id[1],
                        parentInstanceIsolation: id[2],
                        parentInstanceProjectDirectory: projectDirectory,
                        rootInstanceId: JSON.stringify(targetId)
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
        });

        return stream;
    });

    let yaml = resources.map(r => yamlLib.dump(r)).join('\n\n...\n---\n\n');
    for (const pluginCmd of array(plugins)) {
        const pluginRun = services.executor().echo(yaml).pipe().eval(pluginCmd).run();
        await services.logTask(
                `Plugin "${pluginCmd}"...`, pluginRun.stderr);
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

function toEnv(s) {
    return s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}
