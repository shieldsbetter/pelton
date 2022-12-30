#!/usr/bin/env node

import build from './steps/build.mjs';
import cliclopts from 'cliclopts';
import commandLevel from './utils/command-level.mjs';
import manifest from './steps/manifest.mjs';
import minimist from 'minimist';
import pathLib from 'path';
import start from './steps/start.mjs';

import { $ as zx } from 'zx';
import { fileURLToPath } from 'url';

zx.verbose = false;

const pwd = pathLib.dirname(fileURLToPath(import.meta.url));

const buildArgs = [
    {
        name: 'environment',
        abbr: 'e',
        help: 'target project environment',
        default: 'default'
    },
    {
        name: 'isolation',
        abbr: 'i',
        help: 'target project isolation key',
        default: 'a'
    }
];

const manifestArgs = [
    ...buildArgs,
    {
        name: 'targetNamespace',
        abbr: 'n',
        help: 'namespace for target project resources',
        default: 'default'
    }
];

const startArgs = [
    ...manifestArgs
];

async function main() {
    const invocation = pathLib.basename(process.argv[1], '.mjs');

    process.env.PELTON_RUN = randomId();

    await commandLevel(invocation, process.argv.slice(2), {
        build: [
            '[target-directory]',
            'build target and all dependencies', buildArgs,
            async (args, cliError) => {
                const [targetDir = pwd, ...rest] = args._;

                if (rest.length > 0) {
                    throw cliError('Unexpected argument: ' + rest[0]);
                }

                await build(targetDir, args.environment, args.isolation);
            }
        ],
        manifest: [
            '[target-directory [...project-args]]',
            'generate k8s manifest for target and dependencies',
            manifestArgs,
            async (args, cliError) => {
                const [targetDir = pwd, ...targetArgs] = args._;

                const buildStepResults = await build(
                        targetDir, args.environment, args.isolation);
                const yaml = await manifest(targetDir, args.environment,
                        args.isolation, buildStepResults, args.targetNamespace,
                        targetArgs);

                console.log(yaml);
            }
        ],
        start: [
            '[target-directory [...project-args]]',
            'start target with its dependencies',
            startArgs,
            async (args, cliError) => {
                const [targetDir = pwd, ...targetArgs] = args._;

                const buildResults = await build(targetDir, args.environment,
                        args.isolation);
                const yaml = await manifest(targetDir,
                        args.environment, args.isolation, buildResults,
                        args.targetNamespace,
                        targetArgs);

                await start(buildResults, args.targetNamespace, yaml);
            }
        ]
    });
}

const alpha = 'abcdefghjkmnpqrstuvwxyz23456789';
function randomId() {
    let result = '';
    while (result.length < 6) {
        result += alpha.charAt(Math.floor(Math.random() * alpha.length));
    }
    return result;
}

main().catch(e => {
    console.log(e);
    process.exit(1);
});
