import fakeExecutorBuilder from '../utils/fake-executor.mjs';
import logStreamAdapter from '../utils/log-stream-adapter.mjs';
import pelton from '../../pelton-lib.mjs';
import test from 'ava';
import testEnvironment from '../utils/test-environment.mjs';
import yaml from 'js-yaml';

import projectTemplates from '../utils/project-templates.mjs';

test('basic configuration', async t => {
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

    t.truthy(env.resources.default.ConfigMap['root-test-a-cm']);
    t.truthy(env.resources['pltn-root-test-a'].ConfigMap['dep1-default-a-cm']);
    t.truthy(env.resources['pltn-root-test-a'].ConfigMap['dep2-foo-b-cm']);
    t.truthy(env.resources['pltn-root-test-a'].ConfigMap['dep2-foo-a-cm']);

    const depRes = env.resources['pltn-root-test-a'];

    t.is(depRes.ConfigMap['dep1-default-a-cm'].data.peltonBres,
            '(BUILD dep1 BUILD)');
    t.is(depRes.ConfigMap['dep2-foo-b-cm'].data.peltonBres,
            '(BUILD dep2 BUILD)');
    t.is(depRes.ConfigMap['dep2-foo-a-cm'].data.peltonBres,
            '(BUILD dep2 BUILD)');

    t.is(env.resourceCt, 4);
});

test('variables default', async t => {
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

    t.is(env.services.stdout.getOutput().trim(), [
        'FOO=fooval',
        'BAR=defaultBar'
    ].join('\n'));
});

test('variables non-default', async t => {
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

    t.is(env.services.stdout.getOutput().trim(), [
        'FOO=fooval',
        'BAR=otherEnvBar'
    ].join('\n'));
});