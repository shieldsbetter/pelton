import dzx from '../utils/dynamic-zx.mjs';
import inDependencyOrder from '../utils/in-dependency-order.mjs';
import inWindow from '../utils/in-window.mjs';
import yaml from 'js-yaml';
import zxEnv from '../utils/zx-env.mjs';

import { $ as zx } from 'zx';
import { set } from 'lodash-es';

export default async function manifest(targetDir, env = 'default', iso = 'a',
        { results: buildResults, targetConfig, targetId }, targetNs, argv) {
    let stream = Promise.resolve();

    const resources = [];

    await inDependencyOrder(targetDir, env, iso,
            (id, config, depRes,
                { dependencies, dependencyPath, projectDirectory }) => {
        const printManifestCommand =
                config.environments[id[1]].printTerminalDependencies;

        if (!printManifestCommand) {
            return;
        }

        const envVars = {
            PELTON_BRES: buildResults[JSON.stringify(id)],
            ...(config.environments[id[1]].variables || {})
        };

        for (let i = 0; i < dependencies.length; i++) {
            const [dDns, dEnv, dIso] = dependencies[i][0];
            const relIsoSfx = iso === dIso ? '' :
                    '_' + toEnv(dIso.substring(iso.length + 1));

            envVars[`PELTON_BRES_DEP_${i}`] =
                    buildResults[JSON.stringify(dependencies[i][0])];
            envVars[`PELTON_BRES_${toEnv(dDns)}_${toEnv(dEnv)}${relIsoSfx}`] =
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

        const printManifest = zxEnv(envVars)`
            cd ${projectDirectory} && eval ${printManifestCommand}
        `;

        printManifest.stderr.pause();

        stream = stream.then(async () => {
            printManifest.stderr.resume();
            const instanceLabel = (config.name || config.dnsName)
                    + ' > ' + id[1] + ' > ' + id[2];
            await inWindow(`Generating ${instanceLabel} manifest...`,
                    printManifest.stderr);

            try {
                yaml.loadAll((await printManifest).stdout, resource => {
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
                console.log((await printManifest).stdout);
                console.log('\nError parsing above manifest:\n')
                console.log(e.message);
                process.exit(1);
            }
        });

        return stream;
    });

    return resources.map(r => yaml.dump(r)).join('\n\n...\n---\n\n');
}

function annotate(r, o) {
    for (const [key, val] of Object.entries(o)) {
        set(r, annotationKey(key), val);
    }
}

function annotationKey(k) {
    return ['metadata', 'annotations', `com.shieldsbetter.pelton/${k}`];
}

function toEnv(s) {
    return s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}
