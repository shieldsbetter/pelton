#!/usr/bin/env node

import build from './steps/build.mjs';
import cliclopts from 'cliclopts';
import commandLevel from './utils/command-level.mjs';
import generateServiceIngresses from './plugins/generate-service-ingresses.mjs';
import getStdin from 'get-stdin';
import inWindow from './utils/in-window.mjs';
import manifest from './steps/manifest.mjs';
import minimist from 'minimist';
import pathLib from 'path';
import start from './steps/start.mjs';
import yamlLib from 'js-yaml';

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
    },
    {
        name: 'plugin',
        abbr: 'p',
        help: 'command to further process manifest'
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
                if (args._.length > 1) {
                    throw cliError('Unexpected argument: ' + args._[1]);
                }

                await buildStep(args);
            }
        ],
        extras: [
            '<subcommand>',
            'access useful extras', [],
            (args, cliError) => commandLevel('extras', args._, {
                plugins: [
                    '<subcommand>',
                    'access useful extra plugins', [],
                    (args, cliError) => commandLevel('plugins', args._, {
                        'generate-service-ingresses': [
                            '', 'add ingress for each service', [],
                            async (args, cliError) => {
                                const input = await getStdin();
                                console.log(await generateServiceIngresses(input));
                            }
                        ]
                    })
                ]
            })
        ],
        manifest: [
            '[target-directory [...project-args]]',
            'generate k8s manifest for target and dependencies',
            manifestArgs,
            async (args, cliError) => {
                const { yaml } = await manifestStep(args);
                console.log(yaml);
            }
        ],
        start: [
            '[target-directory [...project-args]]',
            'start target with its dependencies',
            startArgs,
            async (args, cliError) => {
                const { yaml, buildStepResults } = await manifestStep(args);
                await start(buildStepResults, args.targetNamespace, yaml);
            }
        ]
    });
}

async function buildStep(args) {
    const [targetDir = pwd, ...rest] = args._;
    return await build(targetDir, args.environment, args.isolation);
}

async function manifestStep(args) {
    const buildStepResults = await buildStep(args);

    const [targetDir = pwd, ...targetArgs] = args._;

    return {
        buildStepResults,
        yaml: await manifest(targetDir, args.environment,
            args.isolation, buildStepResults, args.targetNamespace,
            args.plugin, targetArgs)
    };
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
