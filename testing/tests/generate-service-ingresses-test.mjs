import assert from 'assert';
import gsiLib from '../../plugins/generate-service-ingresses.mjs';
import logStreamAdapter from '../utils/log-stream-adapter.mjs';
import yaml from 'js-yaml';

function gsi(t, input, deps) {
	return gsiLib(input.replace(/\t/g, '    '), {
		stderr: logStreamAdapter(t.console.log.bind(t.console)),
		...deps
	});
}

const tests = [
	{
		name: 'basic',
		run: async t => {
			const result = parseResults(gsi(t, `
		        apiVersion: v1
		        kind: Service
		        metadata:
		            annotations:
		                com.shieldsbetter.pelton/ingress: 123
		                com.shieldsbetter.pelton/sourceActivation: foodns.default.a
		                com.shieldsbetter.pelton/rootActivation: foodns.default.a
		            labels:
		                com-shieldsbetter-pelton-root-activation: foodns.default.a
		            name: foosvc
			`));

			assert.deepEqual(result, {
				'foosvc-default-a.localhost': 'foosvc:123'
			});
		}
	},
	{
		name: 'remove hyphen',
		run: async t => {
			const result = parseResults(gsi(t, `
		        apiVersion: v1
		        kind: Service
		        metadata:
		            annotations:
		                com.shieldsbetter.pelton/ingress: 123
		                com.shieldsbetter.pelton/sourceActivation: foo-dns.default.a
		                com.shieldsbetter.pelton/rootActivation: bar-dns.nondefault.b
		            labels:
		                com-shieldsbetter-pelton-root-activation: foo-dns.default.a
		            name: foosvc
			`));

			assert.deepEqual(result, {
				'foosvc-default-a.bardns-nondefault-b.localhost': 'foosvc:123'
			});
		}
	},
	{
		name: 'rename service',
		run: async t => {
			const result = parseResults(gsi(t, `
		        apiVersion: v1
		        kind: Service
		        metadata:
		            annotations:
		                com.shieldsbetter.pelton/ingress: foo=>123
		                com.shieldsbetter.pelton/sourceActivation: foodns.default.a
		                com.shieldsbetter.pelton/rootActivation: foodns.default.a
		            labels:
		                com-shieldsbetter-pelton-root-activation: foodns.default.a
		            name: foosvc
			`));

			assert.deepEqual(result, {
				'foo.localhost': 'foosvc:123'
			});
		}
	},
	{
		name: 'nonroot',
		run: async t => {
			const result = parseResults(gsi(t, `
		        apiVersion: v1
		        kind: Service
		        metadata:
		            annotations:
		                com.shieldsbetter.pelton/ingress: foo=>123
		                com.shieldsbetter.pelton/sourceActivation: foodns.default.a
		                com.shieldsbetter.pelton/rootActivation: bardns.default.a
		            labels:
		                com-shieldsbetter-pelton-root-activation: foodns.default.a
		            name: foosvc
			`));

			assert.deepEqual(result, {
				'foo.bardns-default-a.localhost': 'foosvc:123'
			});
		}
	},
	{
		name: 'specify single suffix',
		run: async t => {
			const result = parseResults(gsi(t, `
		        apiVersion: v1
		        kind: Service
		        metadata:
		            annotations:
		                com.shieldsbetter.pelton/ingress: 123
		                com.shieldsbetter.pelton/sourceActivation: foodns.default.a
		                com.shieldsbetter.pelton/rootActivation: bardns.default.a
		            labels:
		                com-shieldsbetter-pelton-root-activation: foodns.default.a
		            name: foosvc
			`, {
				env: {
					PELTON_GSI_DOMAIN_SUFFIX: '.bar'
				}
			}));

			assert.deepEqual(result, {
				'foosvc-default-a.bardns-default-a.bar': 'foosvc:123'
			});
		}
	},
	{
		name: 'specify multiple suffix',
		run: async t => {
			const result = parseResults(gsi(t, `
		        apiVersion: v1
		        kind: Service
		        metadata:
		            annotations:
		                com.shieldsbetter.pelton/ingress: 123
		                com.shieldsbetter.pelton/sourceActivation: foodns.default.a
		                com.shieldsbetter.pelton/rootActivation: bardns.default.a
		            labels:
		                com-shieldsbetter-pelton-root-activation: foodns.default.a
		            name: foosvc
			`, {
				env: {
					PELTON_GSI_DOMAIN_SUFFIX: '.bar,.bazz'
				}
			}));

			assert.deepEqual(result, {
				'foosvc-default-a.bardns-default-a.bar': 'foosvc:123',
				'foosvc-default-a.bardns-default-a.bazz': 'foosvc:123'
			});
		}
	},
	{
		name: 'specify single fragment',
		run: async t => {
			const result = parseResults(gsi(t, `
		        apiVersion: v1
		        kind: Service
		        metadata:
		            annotations:
		                com.shieldsbetter.pelton/ingress: foo=>123
		                com.shieldsbetter.pelton/sourceActivation: foodns.default.a
		                com.shieldsbetter.pelton/rootActivation: bardns.default.a
		            labels:
		                com-shieldsbetter-pelton-root-activation: foodns.default.a
		            name: foosvc
			`, {
				env: {
					PELTON_GSI_DEPENDENCY_FRAGMENT: '.bar'
				}
			}));

			assert.deepEqual(result, {
				'foo.bar.localhost': 'foosvc:123'
			});
		}
	},
	{
		name: 'specify multiple fragments',
		run: async t => {
			const result = parseResults(gsi(t, `
		        apiVersion: v1
		        kind: Service
		        metadata:
		            annotations:
		                com.shieldsbetter.pelton/ingress: foo=>123
		                com.shieldsbetter.pelton/sourceActivation: foodns.default.a
		                com.shieldsbetter.pelton/rootActivation: bardns.default.a
		            labels:
		                com-shieldsbetter-pelton-root-activation: foodns.default.a
		            name: foosvc
			`, {
				env: {
					PELTON_GSI_DEPENDENCY_FRAGMENT: '.bar,.bazz'
				}
			}));

			assert.deepEqual(result, {
				'foo.bar.localhost': 'foosvc:123',
				'foo.bazz.localhost': 'foosvc:123'
			});
		}
	},
	{
		name: 'renamepalooza',
		run: async t => {
			const result = parseResults(gsi(t, `
		        apiVersion: v1
		        kind: Service
		        metadata:
		            annotations:
		                com.shieldsbetter.pelton/ingress: foo1=>123,foo2=>124
		                com.shieldsbetter.pelton/sourceActivation: foodns.default.a
		                com.shieldsbetter.pelton/rootActivation: bardns.default.a
		            labels:
		                com-shieldsbetter-pelton-root-activation: foodns.default.a
		            name: foosvc
			`, {
				env: {
					PELTON_GSI_DOMAIN_SUFFIX: '.bar1,.bar2',
					PELTON_GSI_DEPENDENCY_FRAGMENT: '.bazz1,.bazz2'
				}
			}));

			assert.deepEqual(result, {
				'foo1.bazz1.bar1': 'foosvc:123',
				'foo2.bazz1.bar1': 'foosvc:124',
				'foo1.bazz2.bar1': 'foosvc:123',
				'foo2.bazz2.bar1': 'foosvc:124',
				'foo1.bazz1.bar2': 'foosvc:123',
				'foo2.bazz1.bar2': 'foosvc:124',
				'foo1.bazz2.bar2': 'foosvc:123',
				'foo2.bazz2.bar2': 'foosvc:124'
			});
		}
	}
];

export default tests;

function parseResults(raw) {
	const ingresses = yaml.loadAll(raw)
			.filter(({ kind }) => kind === 'Ingress');

	let result = {};
	for (const ingress of ingresses) {
		for (const rule of ingress.spec.rules) {
			const service = rule.http.paths[0].backend.service;
			result[rule.host] = `${service.name}:${service.port.number}`;
		}
	}

	return result;
}