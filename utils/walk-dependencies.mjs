import ConfigError from './config-error.mjs';
import getConfig from './get-config.mjs';
import getVariables from '../utils/get-variables.mjs';
import pathLib from 'path';

export default async function walkDependencies(
        dir, env, iso, services, fns, path = [], cache = {}) {
    const config = getConfig(services, dir);

    const instanceId = [config.dnsName, env, iso];
    const stringifiedInstanceId = instanceId.join('.');

    if (cache[stringifiedInstanceId]) {
        services.debug(`## Skipping ${pathToString(path.concat([instanceId]))}`
                + ` in ${dir}. It was already activated above.`);
    }
    else {
        services.debug(`## Processing `
                + `${pathToString(path.concat([instanceId]))} in ${dir}`);

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

        const dependencySpecs = config.environments[env].dependencies ??
                config.environments[env].peltonDependencies ?? [];

        const dependencies = [];
        for (const [ depName, depSpec ] of Object.entries(dependencySpecs)) {

            const depEnv = depSpec.environment || 'default';
            const depIso = depSpec.isolation || 'a';

            let depDir;
            try {
                depDir = (await services.executor(
                    getVariables(services, config, env)
                ).eval(depSpec.printProjectDirectory).run()).stdout.trim();
            }
            catch (e) {
                if ('stdout' in e) {
                    const e2 = new ConfigError(`"environments.${env}[${depName}].printProjectDirectory" returned a non-zero exit code`);
                    e2.appendParent(`${dir}/pelton.cson`, stringifiedInstanceId);
                    throw e2;
                }
                else {
                    throw e;
                }
            }

            let depConfig;
            try {
                depConfig = await walkDependencies(
                        pathLib.resolve(dir, depDir),
                        depEnv, depIso, services, fns,
                        path.concat([instanceId]), cache);
            }
            catch (e) {
                if (e instanceof ConfigError) {
                    e.appendParent(`${dir}/pelton.cson`, stringifiedInstanceId);
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

        services.debug(`## Done processing `
                + `${pathToString(path.concat([instanceId]))}`);
    }

    return config;
}

function pathToString(p) {
    return p.map(cs => cs.join('.')).join(' > ');
}