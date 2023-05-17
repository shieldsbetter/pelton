import assert from 'assert';
import walkDependencies from './walk-dependencies.mjs';

export default async function inDependencyOrder(dir, env, iso, services, fn) {
    const ongoing = {};

    let last;
    await walkDependencies(dir, env, iso, services, {
        post: async (id, config, extras) => {
            assert(extras.dependencies.every(
                    ([dId]) => !!ongoing[dId.join('.')]));
            const dependencyResults = await Promise.all(extras.dependencies
                    .map(([dId]) => ongoing[dId.join('.')]));

            last = Promise.resolve(fn(id, config, dependencyResults, extras));
            ongoing[id.join('.')] = last;
        }
    });

    return await last;
}
