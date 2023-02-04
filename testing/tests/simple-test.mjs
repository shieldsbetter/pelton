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
    t.is(env.resourceCt, 4);
});
