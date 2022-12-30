import inDependencyOrder from '../utils/in-dependency-order.mjs';
import inWindow from '../utils/in-window.mjs';
import zxEnv from '../utils/zx-env.mjs';

import { $ as zx } from 'zx';

export default async function build(targetDir, env = 'default', iso = 'a') {
    let stream = Promise.resolve();

    const results = {};

    let targetId;
    let targetConfig;
    await inDependencyOrder(targetDir, env, iso,
            (id, config, depRes, { dependencyPath, projectDirectory }) => {

        if (dependencyPath.length === 0) {
            targetId = id;
            targetConfig = config;
        }

        const buildCommand = config.environments[id[1]].buildCommand;

        if (!buildCommand) {
            return;
        }

        const process = zxEnv(
            config.environments[id[1]].variables || {}
        )`cd ${projectDirectory} && eval ${buildCommand}`;

        process.stderr.pause();

        stream = stream.then(async () => {
            process.stderr.resume();
            const instanceLabel = (config.name || config.dnsName)
                    + ' > ' + id[1] + ' > ' + id[2];
            await inWindow(`Building ${instanceLabel}...`, process.stderr);

            results[JSON.stringify(id)] =
                    (await process).stdout.substring(-1000);
        });

        return stream;
    });

    return { results, targetId, targetConfig };
}
