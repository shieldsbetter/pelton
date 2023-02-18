import { Writable } from 'stream';

export default function logToStream(log) {
	// new Writeable() seems to do something spooky with `this`, so let's just
	// use a closure for our state.
	let lines = [];
	let lineCache = '';

	const w = new Writable({
		construct(cb) {
			cb();
		},

		write(chunk, encoding, cb) {
			const newLines = chunk.toString('utf8').split('\n');

			lineCache += newLines[0];

			for (const line of newLines.slice(1)) {
				lines.push(lineCache);
				lineCache = line;
			}

			cb();
		},

		destroy() {
			lines.push(lineCache);
		}
	});

	w.waitForFinish = async () => {
		w.end();

		if (w.writableFinished) {
			return;
		}

		await new Promise(r => w.on('finish', r));
	}

	w.getOutput = function() {
		w.end();

		let result = '';
		for (const line of lines) {
			result += line + '\n';
		}
		return result;
	};

	w.testFailedPrintLogs = function() {
		w.end();

		for (const line of lines) {
			log(line);
		}
	};

	return w;
};