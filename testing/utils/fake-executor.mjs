import pathLib from 'path';
import util from 'util';
import zxEnv from '../../utils/zx-env.mjs';

import { $ } from 'zx';
import { Volume } from 'memfs';

$.verbose = false;

function onlyString(as) {
	if (!as.every(a => typeof a === 'string')) {
		throw new Error('Contains non string: ' + util.inspect(as, null, true));
	}
}

export default function fakeExecutor(kubectlFn, files, evalCmds = {}) {
	const fs = Volume.fromJSON(files);

    const builder = (env, ...prefix) => {
        let expression = [];

        const actions = {
            cd(...args) {
            	onlyString(args);

                expression = [...expression, ['cd', ...args]];
                return conjunctions;
            },

            echo(...args) {
            	onlyString(args);

                expression = [...expression, ['echo', ...args]];
                return conjunctions;
            },

            eval(...args) {
            	onlyString(args);

                expression = [...expression, ['eval', ...args]];
                return conjunctions;
            },

            kubectl(...args) {
            	onlyString(args);

                expression = [...expression, ['kubectl', ...args]];
                return conjunctions;
            }
        };

        var conjunctions = {
            orElse() {
                expression = [...expression, '||'];
                return actions;
            },

            pipe() {
                expression = [...expression, '|'];
                return actions;
            },

            andThen() {
                expression = [...expression, '&&'];
                return actions;
            },

            run() {
            	const runPromise = this._run();

            	runPromise.stdout = {
            		pause() {},
            		resume() {},
            		async *[Symbol.asyncIterator]() {
            			yield (await runPromise).stdout;
					},
					on(event, fn) {
						runPromise.then(r => fn(Buffer.from(r.stdout)));
					}
            	};

            	runPromise.stderr = {
            		pause() {},
            		resume() {},
            		async *[Symbol.asyncIterator]() {
            			yield (await runPromise).toString();
					},
					on(event, fn) {
						runPromise.then(r => fn(Buffer.from(r.stdout)));
					}
            	};

            	return runPromise;
            },

            async _run() {
            	let pwd = '/';
            	let outputBuffer = '';
            	let lastCmdOutput = '';

            	// An operator to signal the end of the expression.
            	expression.push('>');

            	let lastSuccess;
            	let done;

            	while (!done && expression.length > 0) {
            		let [cmd, ...args] = expression.shift();

            		lastSuccess = true;
            		switch (cmd) {
            			case 'cd': {
            				pwd = normalizePath(pwd + '/' + args[0]);
            				break;
            			}
	            		case 'echo': {
	            			lastCmdOutput = (await zxEnv(env)`echo ${args}`).stdout;
	            			break;		
	            		}
		            	case 'eval': {
		            		args = args.map(a => parseTokens(a)).flat();

		            		if (args[0] === 'cat') {
		            			lastCmdOutput = fs.readFileSync(normalizePath(pwd + '/' + args[1]), 'utf8') + '\n';
		            		}
		            		else if (args[0] === 'echo') {
		            			if (args.some(a => a.includes('"'))) {
		            				throw new Error('fake executor `eval echo` cannot have args with quotes: ' + util.inspect(args, null, true));
		            			}
		            			lastCmdOutput = (await zxEnv(env)`eval ${args.map(a => `"${a}"`).join(' ')}`).stdout;
		            		}
		            		else if (args[0] === 'pwd') {
		            			lastCmdOutput = pwd + '\n';
		            		}
		            		else {
		            			if (!evalCmds[args[0]]) {
		            				throw new Error('No such test executor cmd: ' + args[0]);
		            			}

		            			try {
		            				lastCmdOutput = (await zxEnv(env)`${() => evalCmds[args[0]]}`).stdout;
		            			}
		            			catch (e) {
		            				lastCmdOutput = e.stdout;
		            				lastSuccess = false;
		            			}
		            		}
		            		break;	
		            	}
			            case 'kubectl': {
			            	try {
				            	const replacement = await kubectlFn(lastCmdOutput, args);
				            	lastCmdOutput = (await zxEnv(env)`${() => replacement}`).toString();
				            }
				            catch (e) {
				            	lastCmdOutput = e.toString();
				            	lastSuccess = false;
				            }
			            	break;
			            }
				        default: {
				     		throw new Error('Huh? ' + cmd);   	
				        }
            		}

            		const conjunction = expression.shift();

            		switch (conjunction) {
	            		case '||': {
	            			done = lastSuccess;
	            			outputBuffer += lastCmdOutput;
	            			lastCmdOutput = '';
	            			break;
	            		}
	            		case '|': {
	            			done = !lastSuccess;
	            			break;
	            		}
	            		case '&&': {
	            			done = !lastSuccess;
	            			outputBuffer += lastCmdOutput;
	            			lastCmdOutput = '';
	            			break;
	            		}
		            	case '>': {
		            		done = true;
		            		break;		
		            	}
			            default: {
			            	throw new Error('Huh? ' + conjunction);
			            }
            		}
            	}

            	if (!lastSuccess) {
            		const e = new Error();
            		e.stdout = outputBuffer + lastCmdOutput;
            		e.stderr = outputBuffer + lastCmdOutput;
            		e.toString = () => outputBuffer + lastCmdOutput;
            		throw e;
            	}

            	return {
            		stdout: outputBuffer + lastCmdOutput,
            		toString() { return outputBuffer + lastCmdOutput; }
            	};
            }
        };

        return actions;
    };

    builder.fs = fs;

    return builder;
}

function normalizePath(p) {
	const components = p.split('/');

	let result = [];
	for (const c of components) {
		if (c === '') {
			result = [''];
		}
		else if (c === '..') {
			result.pop();
		}
		else if (c === '.') {
			// Do nothing!
		}
		else {
			result.push(c);
		}
	}

	return result.join('/');
}

function parseTokens(input) {
	const result = [];
	let curToken = '';
	let inQuote = false;
	
	function endToken() {
		if (curToken.length > 0) {
			result.push(curToken);
			curToken = '';
		}
	}

	for (const c of input) {
		if (c === '\'' || c === '"') {
			inQuote = !inQuote;
		}
		else if (!inQuote && /\s/.test(c)) {
			endToken();
		}
		else {
			curToken += c;
		}
	}

	endToken();

	return result;
}