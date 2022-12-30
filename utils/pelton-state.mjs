import yaml from 'js-yaml';
import dzx from '../utils/dynamic-zx.mjs';

const kubectl = process.env.KUBECTL_CMD || 'kubectl';

export default async function peltonState() {
    const result = {
        async load() {
            let curConfig;
            try {
                curConfig = yaml.load((
                    await dzx`
                            ${() => kubectl} get configmap \
                            com-shieldsbetter-pelton-state -o yaml
                    `).stdout);
            }
            catch (e) {
                if (e.message.includes('NotFound')) {
                    curConfig = {
                        apiVersion: 'v1',
                        kind: 'ConfigMap',
                        metadata: {
                            name: 'com-shieldsbetter-pelton-state'
                        },
                        data: {}
                    };
                }
                else {
                    const e2 = new Error(e.message);
                    e2.cause = e;
                    throw e2;
                }
            }

            this.value = JSON.parse(curConfig?.data?.state || '{}');
            this.value.activeProjects = this.value.activeProjects || [];
        },

        async save() {
            await dzx`echo ${yaml.dump({
                apiVersion: 'v1',
                kind: 'ConfigMap',
                metadata: {
                    name: 'com-shieldsbetter-pelton-state'
                },
                data: {
                    state: JSON.stringify(this.state, null, 4)
                }
            })} | ${() => kubectl} apply -f -`;
        }
    };

    await result.load();

    return result;
}
