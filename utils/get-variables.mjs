import getConfig from './get-config.mjs';

export default function getVariables(services, config, env = 'default') {
	config = (typeof config === 'string')
			? getConfig(services, config) : config;

	const topLevelVars = config.variables ?? {};
	const envVars = config?.environments?.[env]?.variables ?? {};

	return { ...topLevelVars, ...envVars };
}