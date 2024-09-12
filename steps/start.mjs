import buildBaseEnvironment from '../utils/build-base-environment.mjs';
import chalk from 'chalk';
import getVariables from '../utils/get-variables.mjs';
import yaml from 'js-yaml';

import { get } from 'lodash-es';

const podColors = [
    chalk.blue,
    chalk.magenta,
    chalk.green,
    chalk.cyan,
    chalk.yellow,
    chalk.white,
    chalk.red
];

export default async function start(
        { targetId, targetConfig }, targetNs, rawManifest, options, services) {
    const resources = await yaml.loadAll(rawManifest);
    const resourcesByNamespace = {};

    for (const r of resources) {
        const ns = r.metadata?.namespace ?? 'default';
        r.metadata.namespace = ns;

        if (!resourcesByNamespace[ns]) {
            resourcesByNamespace[ns] = [];
        }

        resourcesByNamespace[ns].push(r);
    }

    const requiredNamespaces =
            Object.keys(resourcesByNamespace).filter(r => r !== 'default');

    await Promise.all(requiredNamespaces
            .map(ns => services.executor()
                    .kubectl('get', 'namespace', ns)
                    .orElse().kubectl('create', 'namespace', ns)
                    .run()));

    const [dns, env, iso] = targetId;

    // This is the current --purge default allow list, minus the non-namespaced
    // resources. Using this shuts up the deprecation warning. :)
    const purgeKinds = [
        'core/v1/ConfigMap',
        'core/v1/Endpoints',
        'core/v1/PersistentVolumeClaim',
        'core/v1/Pod',
        'core/v1/ReplicationController',
        'core/v1/Secret',
        'core/v1/Service',
        'batch/v1/Job',
        'batch/v1/CronJob',
        'networking.k8s.io/v1/Ingress',
        'apps/v1/DaemonSet',
        'apps/v1/Deployment',
        'apps/v1/ReplicaSet',
        'apps/v1/StatefulSet'
    ];

    for (const [ns, rs] of Object.entries(resourcesByNamespace)) {
        const nsManifest = rs.map(r => yaml.dump(r)).join('\n...\n---\n');

        await services.logTask(
                `Starting namespace ${ns} for ${dns}.${env}.${iso}...`,
                services.executor()
                    .echo(nsManifest)
                    .pipe().kubectl('apply',
                            '--namespace', ns,
                            ...(
                                purgeKinds.map(k => [
                                    '--prune-allowlist', k
                                ]).flat()
                            ),
                            '--selector', `com-shieldsbetter-pelton-root-activation=${dns}.${env}.${iso}`,
                            '--prune',
                            '-f', '-').run(), ['stdout', 'stderr']);
    }

    if (!options.detach) {
        let sigintOnce = false;
        let logPause = false;
        let logLines = [];
        function log(...args) {
            if (logPause) {
                logLines.push(args);
            }
            else {
                console.log(...args);
            }
        }

        async function shutdown() {
            if (sigintOnce) {
                process.exit(1);
            }
            sigintOnce = true;

            logPause = true;

            const rootResources = resources.filter(r =>
                    get(r, ['metadata', 'annotations', 'com.shieldsbetter.pelton/sourceActivation'])
                    === targetId.join('.'))
                    .map(r => `${r.kind}/${r.metadata.name}`);

            await services.logTask(
                    `Stopping ${targetId.join('.')}...`,
                    services.executor()
                            .kubectl('delete', '-n', targetNs, ...rootResources)
                            .run(), 'stdout');

            for (const line of logLines) {
                console.log(...line);
            }
            logLines = [];
            logPause = false;
        }

        if (!targetConfig.environments[targetId[1]].podSelector) {
            shutdown();
        }
        else {
            async function getPods(fieldSelector, labelSelector) {
                return (await services.executor()
                        .kubectl('get', 'pods',
                                '--field-selector', fieldSelector,
                                '--selector', labelSelector,
                                '-o', 'jsonpath={.items[*].metadata.name}')
                        .run()).stdout.split(' ').filter(e => e !== '');
            }

            const [,,baseEnv] = buildBaseEnvironment(
                    targetId, targetId, targetNs, services.peltonRunId);

            const podSelector = (await services.executor({
                ...baseEnv,
                ...await getVariables(services, targetConfig, targetId[1])
            }).eval('echo', targetConfig.environments[targetId[1]].podSelector).run())
            .stdout.trim();

            console.log('Waiting for at least one pod...');
            console.log();
            console.log(`    ${process.env.KUBECTL_CMD || 'kubectl'} get pods \\\n`
                    + `        --field-selector status.phase!=Pending,status.phase!=Unknown \\\n`
                    + `        --selector ${podSelector}`);
            console.log();

            while ((await getPods('status.phase!=Pending,status.phase!=Unknown',
                    podSelector)).length === 0) {
                await new Promise(r => setTimeout(r, 1000));
            }

            process.on('SIGINT', shutdown);

            let lastLogHeading;

            function handleChunk(heading, colorize) {
                return d => {
                    if (Buffer.isBuffer(d)) {
                        d = d.toString('utf8');
                    }

                    const maybeLogHeading =
                            lastLogHeading === heading ? '' : heading;
                    lastLogHeading = heading;

                    log(colorize(maybeLogHeading + trimFinalNewline(d)));
                };
            }

            await Promise.all((await getPods('status.phase=Running', podSelector))
                    .map((podName, i) => {
                const stdoutColor = podColors[(i * 2) % podColors.length];
                const stderrColor = podColors[(i * 2 + 1) % podColors.length];

                const running = services.executor({}, () => 'trap \'\' INT')
                        .kubectl('logs', '--follow', podName).run();
                running.stdout.on('data',
                        handleChunk(`${podName} out> `, stdoutColor));
                running.stderr.on('data',
                        handleChunk(`${podName} err> `, stderrColor));

                return running;
            }));
        }
    }
}

function trimFinalNewline(str) {
    if (typeof str === 'string' && str.endsWith('\n')) {
        str = str.substring(0, str.length - 1);
    }

    return str;
}
