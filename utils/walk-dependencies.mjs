import cson from 'cson';
import fs from 'fs/promises';
import pathLib from 'path';
import zxEnv from './zx-env.mjs';

export default async function walk(dir, env, iso, fns, path = [], cache = {}) {
    const configFilename = pathLib.join(dir, 'pelton.cson');
    const rawConfig = await fs.readFile(configFilename, 'utf8');
    const config = cson.parse(rawConfig);

    if (path.some(([dns, oEnv, oIso]) => dns === config.dnsName
            && env === oEnv && iso === oIso)) {
        const e = new Error('Circular pelton dependency: ' +
                path.map(([dns, env, iso]) => `${dns}[${env}][${iso}]`)
                .join(' --> '));
        e.code = 'PELTON_CIRCULAR_DEPENDENCY';
        throw e;
    }

    if (!cache[config.dnsName]) {
        const instanceId = [config.dnsName, env, iso];
        const {
            pre = () => {},
            post = () => {}
        } = fns;

        cache[config.dnsName] = {};

        await pre(instanceId, config, {
            dependencyPath: path,
            projects: cache,
            projectDirectory: dir
        });

        const dependencies = [];
        for (const [ depName, depSpec ]
                of Object.entries(config.environments[env].peltonDependencies)) {
            const depEnv = depSpec.environment || 'default';
            const depIso =
                    depSpec.isolation ? `${iso}-${depSpec.isolation}` : iso;

            const depDir =
                    (await zxEnv(
                        config.environments[env].variables || {}
                    )`eval ${depSpec.printProjectDirectory}`).stdout.trim();

            const depConfig = await walk(pathLib.join(dir, depDir),
                    depEnv, depIso, fns, path.concat([instanceId]), cache);

            dependencies.push([
                [depConfig.dnsName, depEnv, depIso],
                depConfig
            ]);
        }

        await post(instanceId, config, {
            dependencies,
            dependencyPath: path,
            projects: cache,
            projectDirectory: dir
        });
    }

    return config;
}
