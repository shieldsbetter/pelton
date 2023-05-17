import fakeExecutorBuilder from './fake-executor.mjs';
import logStreamAdapter from './log-stream-adapter.mjs';
import pelton from '../../pelton-lib.mjs';
import yaml from 'js-yaml';

import { set, unset } from 'lodash-es';

export default function test(t, files) {
	const resources = { default: {} };

    async function kubectlFn(input, args) {
    	let result = 'true';

    	switch (args[0]) {
	    	case 'apply': {
	    		const fileFlagIndex = args.indexOf('-f');
	    		const fileName = args[fileFlagIndex + 1];

	    		const nsIndex = args.indexOf('--namespace');
	    		const namespace = args[nsIndex + 1];

	    		if (fileFlagIndex === -1 || fileName !== '-') {
	    			throw new Error('This apply is confusing. :(');
	    		}

	    		if (nsIndex === -1) {
	    			throw new Error('This apply is confusing. :(');
	    		}

	    		const toApply = await yaml.loadAll(input);

    			for (const kind of Object.keys(resources[namespace] ?? {})) {
					for (const resource
							of Object.keys(resources[ns][kind])) {
	    				delete resources[ns][kind][resource];
	    				result += ` && echo Deleting ${kind} ${ns}.${resource}...`;
    				}
    			}

	            for (const resource of toApply) {
	            	if (!resources[resource.metadata.namespace]) {
	            		throw new Error('Namespace doesn\'t exist: ' + resource.metadata.namespace);
	            	}

	            	set(resources,
	            			[resource.metadata.namespace, resource.kind, resource.metadata.name],
	            			resource);

	            	result += ` && echo Creating ${resource.kind} ${resource.metadata.namespace}.${resource.metadata.name}...`;
	            }

	    		break;
	    	}
		    case 'create': {
		    	if (args[1] !== 'namespace') {
		    		throw new Error('Can only create namespaces, tried: '
		    				+ args[1]);
		    	}

		    	result += ` && echo Creating namespace ${args[2]}...`;

		    	resources[args[2]] = {};
		    	break;
		    }
			case 'delete': {
				if (args[1] !== '-n' && args[1] !== '--namespace') {
					throw new Error('Must specify namespace');
				}

				const ns = args[2];

				for (const resourceSpec of args.slice(3)) {
					const [kind, name] = resourceSpec.split('/');

					unset(resources, [ns, kind, name]);
				}

				result += ` && echo Deleting ${kind} ${ns}.${name}...`;

				break;
			}
			case 'get': {
				if (args[1] === 'namespace') {
					if (!resources[args[2]]) {
						result += ` && 1>&2 echo No such namespace: ${args[2]} && exit 1`;
					}
				}
				break;
			}
		}

		return result;
    }

    const executor = fakeExecutorBuilder(kubectlFn, files, {});

    const logStream = logStreamAdapter(t.console.log.bind(t.console));

    const services = {
        executor,
        fs: executor.fs,
        pwd: '/',
        stderr: logStream,
        stdout: logStream
    };

    return {
    	async call(command, ...args) {
    		if (!Array.isArray(command)) {
    			command = [command];
    		}

    		await pelton(
    				['node', 'pelton', ...command, '--notty', ...args],
    				services);
    	},
    	printFile(f) {
    		console.log(executor.fs.readFileSync(f, 'utf8'));
    	},
    	resources,
    	get resourceCt() {
    		let ct = 0;

    		for (const ns of Object.keys(resources)) {
            	for (const kind of Object.keys(resources[ns])) {
            		ct += Object.keys(resources[ns][kind]).length;
            	}
            }

            return ct;
    	},
    	services
    };
}