import { Writable } from 'stream';

export default function logToStream(log) {
	const w = new Writable({
		construct(cb) {
			this.lines = [];
			this.lineCache = '';
			cb();
		},

		write(chunk, encoding, cb) {
			const lines = chunk.toString('utf8').split('\n');

			this.lineCache += lines[0];

			for (const line of lines.slice(1)) {
				this.lines.push(this.lineCache);
				this.lineCache = line;
			}

			cb();
		},

		destroy() {
			this.lines.push(this.lineCache);
		}
	});

	w.testFailedPrintLogs = function() {
		for (const line of this.lines) {
			log(line);
		}
	};

	return w;
};