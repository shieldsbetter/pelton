import cson from 'cson';
import pathLib from 'path';
import ConfigError from './config-error.mjs';

export default async function walkDependencies(
        dir, env, iso, services, fns, path = [], cache = {}) {
    const configFilename = pathLib.join(dir, 'pelton.cson');
    const rawConfig = await services.fs.readFileSync(configFilename, 'utf8');
    const config = cson.parse(rawConfig);

    const instanceId = [config.dnsName, env, iso];
    const stringifiedInstanceId = JSON.stringify(instanceId);

    if (!cache[stringifiedInstanceId]) {
        const {
            pre = () => {},
            post = () => {}
        } = fns;

        cache[stringifiedInstanceId] = {};

        await pre(instanceId, config, {
            dependencyPath: path,
            projects: cache,
            projectDirectory: dir
        });

        if (!config.environments[env]) {
            throw new ConfigError(
                    'Requested environment not defined in "environments": '
                    + env);
        }

        const dependencies = [];
        for (const [ depName, depSpec ]
                of Object.entries(config.environments[env].peltonDependencies)) {

            const depEnv = depSpec.environment || 'default';
            const depIso = depSpec.isolation || 'a';

            let depDir;
            try {
                depDir = (await services.executor(
                    config.environments[env].variables || {}
                ).eval(depSpec.printProjectDirectory).run()).stdout.trim();
            }
            catch (e) {
                if ('stdout' in e) {
                    const e2 = new ConfigError(`"environments.${env}[${depName}].printProjectDirectory" returned a non-zero exit code`);
                    e2.appendParent(configFilename, instanceId.join('.'));
                    throw e2;
                }
                else {
                    throw e;
                }
            }

            let depConfig;
            try {
                depConfig = await walkDependencies(pathLib.join(dir, depDir),
                        depEnv, depIso, services, fns,
                        path.concat([instanceId]), cache);
            }
            catch (e) {
                if (e instanceof ConfigError) {
                    e.appendParent({ filename: configFilename, instanceId });
                }

                throw e;
            }

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
