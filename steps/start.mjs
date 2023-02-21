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
    const targetIdString = JSON.stringify(targetId);

    const resources = await yaml.loadAll(rawManifest);

    const requiredNamespaces = [...resources.reduce((accum, val) => {
        accum.add(val.metadata?.namespace || 'default');
        return accum;
    }, new Set())].filter(r => r !== 'default');

    await Promise.all(requiredNamespaces
            .map(ns => services.executor()
                    .kubectl('get', 'namespace', ns)
                    .orElse().kubectl('create', 'namespace', ns)
                    .run()));

    const [dns, env, iso] = targetId;
    await services.logTask(
            `Starting ${dns} > ${env} > ${iso}...`,
            services.executor()
                .echo(rawManifest)
                .pipe().kubectl('apply',
                        '--selector', `com-shieldsbetter-pelton-root-instance=${targetId[0]}.${targetId[1]}.${targetId[2]}`,
                        '--prune',
                        '-f', '-').run(), 'stdout');

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
                    get(r, ['metadata', 'annotations', 'com.shieldsbetter.pelton/parentInstanceId'])
                    === JSON.stringify(targetId))
                    .map(r => `${r.kind}/${r.metadata.name}`);

            await services.logTask(
                    `Stopping ${dns} > ${env} > ${iso}...`,
                    services.executor()
                            .kubectl('delete', '-n', targetNs, ...rootResources)
                            .run().stdout);

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

            const podSelector = (await services.executor(
                getVariables(services, targetConfig, targetId[1])
            ).eval('echo', targetConfig.environments[targetId[1]].podSelector).run())
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
            await Promise.all((await getPods('status.phase=Running', podSelector))
                    .map((podName, i) => {
                const stdoutColor = podColors[(i * 2) % podColors.length];
                const stderrColor = podColors[(i * 2 + 1) % podColors.length];

                const running = services.executor({}, () => 'trap \'\' INT')
                        .kubectl('logs', '--follow', podName).run();
                running.stdout.on('data', d => {
                    const logHeading = `${podName} out> `;
                    const maybeLogHeading =
                            lastLogHeading === logHeading ? '' : logHeading;
                    lastLogHeading = logHeading;

                    log(stdoutColor(maybeLogHeading + d));
                });
                running.stderr.on('data', d => {
                    const logHeading = `${podName} err> `;
                    const maybeLogHeading =
                            lastLogHeading === logHeading ? '' : logHeading;
                    lastLogHeading = logHeading;

                    log(stderrColor(maybeLogHeading + d));
                });

                return running;
            }));
        }
    }
}
