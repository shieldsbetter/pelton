import assert from 'assert';
import fakeExecutorBuilder from '../utils/fake-executor.mjs';
import logStreamAdapter from '../utils/log-stream-adapter.mjs';
import pelton from '../../pelton-lib.mjs';
import testEnvironment from '../utils/test-environment.mjs';
import yaml from 'js-yaml';

import projectTemplates from '../utils/project-templates.mjs';

const tests = [
    {
        name: 'basic configuration',
        run: async t => {
            const env = testEnvironment(t, {
                '/pelton.cson': projectTemplates.basic('root', {
                    test: [
                        ['dep1'],
                        ['dep2', 'foo', 'b']
                    ]
                }),
                '/dep1/pelton.cson': projectTemplates.basic('dep1', {
                    default: [
                        ['../dep2', 'foo']
                    ]
                }),
                '/dep2/pelton.cson': projectTemplates.basic('dep2', {
                    foo: []
                })
            });

            await env.call(['start'], '--environment', 'test', '--detach');

            assert(env.resources.default.ConfigMap['root-test-a-cm']);
            assert(env.resources['pltn-root-test-a']
                    .ConfigMap['dep1-default-a-cm']);
            assert(env.resources['pltn-root-test-a']
                    .ConfigMap['dep2-foo-b-cm']);
            assert(env.resources['pltn-root-test-a']
                    .ConfigMap['dep2-foo-a-cm']);

            const depRes = env.resources['pltn-root-test-a'];

            assert.equal(depRes.ConfigMap['dep1-default-a-cm'].data.peltonBres,
                    '(BUILD dep1 BUILD)');
            assert.equal(depRes.ConfigMap['dep2-foo-b-cm'].data.peltonBres,
                    '(BUILD dep2 BUILD)');
            assert.equal(depRes.ConfigMap['dep2-foo-a-cm'].data.peltonBres,
                    '(BUILD dep2 BUILD)');

            assert.equal(env.resourceCt, 4);
        }
    },
    {
        name: 'variables default',
        run: async t => {
            const env = testEnvironment(t, {
                '/pelton.cson': `
                    variables: {
                        FOO: 'fooval',
                        BAR: 'barval'
                    }

                    environments: {
                        default: {
                            variables: {
                                BAR: 'defaultBar'
                            }
                        }
                    }
                `
            });

            await env.call(['variables']);

            await env.services.stdout.waitForFinish();

            assert.equal(env.services.stdout.getOutput().trim(), [
                'FOO=fooval',
                'BAR=defaultBar'
            ].join('\n'));
        }
    },
    {
        name: 'variables non-default',
        run: async t => {
            const env = testEnvironment(t, {
                '/pelton.cson': `
                    variables: {
                        FOO: 'fooval',
                        BAR: 'barval'
                    }

                    environments: {
                        otherEnv: {
                            variables: {
                                BAR: 'otherEnvBar'
                            }
                        }
                    }
                `
            });

            await env.call(['variables'], '--environment', 'otherEnv');

            await env.services.stdout.waitForFinish();

            assert.equal(env.services.stdout.getOutput().trim(), [
                'FOO=fooval',
                'BAR=otherEnvBar'
            ].join('\n'));
        }
    },
    {
        name: 'dependency absolute',
        run: async t => {
            const env = testEnvironment(t, {
                '/root/pelton.cson': `
                    dnsName: 'root',
                    environments: {
                        default: {
                            peltonDependencies: [
                                {
                                    printProjectDirectory: 'echo /dep1'
                                }
                            ]
                        }
                    }
                `,
                '/dep1/pelton.cson': `
                    dnsName: 'dep1',
                    environments: {
                        default: {
                            peltonDependencies: []
                        }
                    }
                `
            });

            await env.call(['build'], '/root');
        }
    }
];

export default tests;
