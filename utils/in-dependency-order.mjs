import assert from 'assert';
import walkDependencies from './walk-dependencies.mjs';

export default async function inDependencyOrder(dir, env, iso, fn) {
    const ongoing = {};

    let last;
    await walkDependencies(dir, env, iso, {
        post: async (id, config, extras) => {
            assert(extras.dependencies.every(
                    ([dId]) => !!ongoing[JSON.stringify(dId)]));
            const dependencyResults = await Promise.all(extras.dependencies
                    .map(([dId]) => ongoing[JSON.stringify(dId)]));

            last = Promise.resolve(fn(id, config, dependencyResults, extras));
            ongoing[JSON.stringify(id)] = last;
        }
    });

    return await last;
}
