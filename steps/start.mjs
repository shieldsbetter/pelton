import chalk from 'chalk';
import dzx from '../utils/dynamic-zx.mjs';
import inWindow from '../utils/in-window.mjs';
import peltonState from '../utils/pelton-state.mjs';
import yaml from 'js-yaml';
import zxEnv from '../utils/zx-env.mjs';

import { get } from 'lodash-es';

const kubectl = process.env.KUBECTL_CMD || 'kubectl';

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
        { targetId, targetConfig }, targetNs, rawManifest) {
    const targetIdString = JSON.stringify(targetId);

    const state = await peltonState();
    if (!state.value.activeProjects.includes(targetIdString)) {
        state.value.activeProjects.push(targetIdString);
        state.value.activeProjects.sort();
        await state.save();
    }

    const resources = await yaml.loadAll(rawManifest);

    const requiredNamespaces = [...resources.reduce((accum, val) => {
        accum.add(val.metadata?.namespace || 'default');
        return accum;
    }, new Set())].filter(r => r !== 'default');

    await Promise.all(requiredNamespaces
            .map(ns => dzx`
                ${() => kubectl} get namespace ${ns} \
                || ${() => kubectl} create namespace ${ns}
            `));

    const [dns, env, iso] = targetId;
    await inWindow(
            `Starting ${dns} > ${env} > ${iso}...`,
            (dzx`echo ${rawManifest} \
                | ${() => kubectl} apply \
                        --selector com-shieldsbetter-pelton-root-instance=${targetId[0]}.${targetId[1]}.${targetId[2]} \
                        --prune \
                        -f -`).stdout);

    const podSelector = (await zxEnv(
        targetConfig.environments[targetId[1]].variables || {}
    )`eval \
            echo ${targetConfig.environments[targetId[1]].podSelector}`)
            .stdout.trim();

    console.log('Waiting for at least one pod...');
    console.log();
    console.log(`    ${kubectl} get pods \\\n`
            + `        --field-selector status.phase!=Pending,status.phase!=Unknown \\\n`
            + `        --selector ${podSelector}`);
    console.log();

    while ((await getPods('status.phase!=Pending,status.phase!=Unknown',
            podSelector)).length === 0) {
        await new Promise(r => setTimeout(r, 1000));
    }

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

    let sigintOnce = false;
    process.on('SIGINT', async () => {
        if (sigintOnce) {
            process.exit(1);
        }
        sigintOnce = true;

        logPause = true;

        const rootResources = resources.filter(r =>
                get(r, ['metadata', 'annotations', 'com.shieldsbetter.pelton/parentInstanceId'])
                === JSON.stringify(targetId))
                .map(r => `${r.kind}/${r.metadata.name}`);

        await inWindow(
                `Stopping ${dns} > ${env} > ${iso}...`,
                (dzx`${() => kubectl} delete -n ${targetNs} ${rootResources}`).stdout);

        for (const line of logLines) {
            console.log(...line);
        }
        logLines = [];
        logPause = false;
    });

    await Promise.all((await getPods('status.phase=Running', podSelector))
            .map((podName, i) => {
        const stdoutColor = podColors[(i * 2) % podColors.length];
        const stderrColor = podColors[(i * 2 + 1) % podColors.length];

        const running = dzx`trap '' INT; ${() => kubectl} logs --follow ${podName}`;
        running.stdout.on('data', d => {
            log(stdoutColor(`${podName} out> ` + d));
        });
        running.stderr.on('data', d => {
            log(stderrColor(`${podName} err> ` + d));
        });

        return running;
    }));
}

async function getPods(fieldSelector, labelSelector) {
    return (await dzx`${() => kubectl} get pods \
            --field-selector ${fieldSelector} \
            --selector ${labelSelector} \
            -o jsonpath='{.items[*].metadata.name}'`).stdout.split(' ')
            .filter(e => e !== '');
}
