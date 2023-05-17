#!/usr/bin/env node

import build from './steps/build.mjs';
import buildTaskLogger from './utils/task-logger.mjs';
import cliclopts from 'cliclopts';
import commandLevel from './utils/command-level.mjs';
import executor from './utils/executor.mjs';
import * as fsLib from 'fs';
import generateServiceIngresses from './plugins/generate-service-ingresses.mjs';
import getStdin from 'get-stdin';
import getVariables from './utils/get-variables.mjs';
import manifest from './steps/manifest.mjs';
import minimist from 'minimist';
import pathLib from 'path';
import start from './steps/start.mjs';
import yamlLib from 'js-yaml';

import { $ as zx } from 'zx';
import { fileURLToPath } from 'url';

zx.verbose = false;

const globalArgs = [
    {
        name: 'debug',
        help: 'turn on verbose debug logging',
        boolean: true
    },
    {
        name: 'notty',
        help: 'disable fancy output',
        boolean: true
    }
];

const buildArgs = [
    ...globalArgs,
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
    },
    {
        name: 'targetNamespace',
        abbr: 'n',
        help: 'namespace for target project resources',
        default: 'default'
    }
];

const manifestArgs = [
    ...buildArgs,
    {
        name: 'plugin',
        abbr: 'p',
        help: 'command to further process manifest'
    }
];

const startArgs = [
    ...manifestArgs,

    {
        name: 'detach',
        abbr: 'd',
        help: 'return without blocking to follow logs or deleting instance',
        boolean: true
    }
];

export default async function pelton(argv, services) {
    services = {
        executor: executor(),
        fs: fsLib,
        peltonRunId: randomId(),
        pwd: process.cwd(),
        stderr: process.stderr,
        stdout: process.stdout,

        ...services
    };

    const invocation = pathLib.basename(argv[1], '.mjs');

    await commandLevel(invocation, argv.slice(2), {
        build: [
            '[target-directory]',
            'build target and all dependencies', buildArgs,
            async (args, cliError) => {
                if (args._.length > 1) {
                    throw cliError('Unexpected argument: ' + args._[1]);
                }

                await buildStep(args, instrumentServices(args, services));
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
                                console.log(await generateServiceIngresses(
                                        input,
                                        instrumentServices(args, services)));
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
                const { yaml } = await manifestStep(
                        args, instrumentServices(args, services));
                console.log(yaml);
            }
        ],
        start: [
            '[target-directory [...project-args]]',
            'start target with its dependencies',
            startArgs,
            async (args, cliError) => {
                services = instrumentServices(args, services);

                const { yaml, buildStepResults } =
                        await manifestStep(args, services);

                services.debug('# Start step');

                await start(
                        buildStepResults, args.targetNamespace, yaml, args,
                        services);
            }
        ],
        variables: [
            '[target-directory]',
            'print environment variables',
            buildArgs,
            async (args, cliError) => {
                services = instrumentServices(args, services);
                const [targetDir = services.pwd] = args._;
                const vars =
                        getVariables(services, targetDir, args.environment);

                for (const [key, value] of Object.entries(vars)) {
                    services.stdout.write(`${key}=${zx.quote(value)}\n`);
                }
            }
        ]
    });
}

async function buildStep(args, services) {
    services.debug('# Build step');
    const [targetDir = services.pwd, ...rest] = args._;
    return await build(targetDir, args.environment, args.isolation,
            args.targetNamespace, services);
}

function instrumentServices(args, services) {
    services.debug = args.debug ? console.log.bind(console) : (() => {});
    services.logTask = buildTaskLogger(services.stderr, !args.notty);

    return services;
}

async function manifestStep(args, services) {
    const buildStepResults = await buildStep(args, services);

    services.debug('# Manifest step');

    const [targetDir = services.pwd, ...targetArgs] = args._;

    return {
        buildStepResults,
        yaml: await manifest(targetDir, args.environment,
            args.isolation, buildStepResults, args.targetNamespace,
            args.plugin, targetArgs, services)
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