export default class ConfigError extends Error {
	constructor(msg) {
		super(msg);

		this.path = [];
	}

	appendParent(filename, instanceId) {
		this.path.push({ filename, instanceId });
	}
}