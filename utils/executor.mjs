import zxEnv from './zx-env.mjs';

import { $ } from 'zx';

const kubectl = process.env.KUBECTL_CMD || 'kubectl';

// This module exists to make executing shell stuff more testable. At this point
// we're probably straining our use of `zx` and might want to consider yanking
// it out in favor of lower level calls...
export default function executor() {
    return (env, ...prefix) => {
        let expression = [];

        const actions = {
            cd(...args) {
                expression = [...expression, ['cd', ...args]];
                return conjunctions;
            },

            echo(...args) {
                expression = [...expression, ['echo', ...args]];
                return conjunctions;
            },

            eval(...args) {
                expression = [...expression, ['eval', ...args]];
                return conjunctions;
            },

            kubectl(...args) {
                expression = [...expression, [() => kubectl, ...args]];
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
                // Strings will be quoted. Functions will be evaluated and
                // inserted literally.
                let finalTokens = [...prefix];

                if (finalTokens.length > 0) {
                    finalTokens.push(() => '; ');
                }

                finalTokens = [...finalTokens, ...expression.shift()];
                while (expression.length > 0) {
                    const conjunction = expression.shift();
                    finalTokens = [...finalTokens, () => conjunction,
                            ...expression.shift()];
                }

                const pieces = [];
                const values = [];

                let lastWasFn;
                for (const tok of finalTokens) {
                    if (typeof tok === 'string') {
                        if (values.length >= pieces.length) {
                            pieces.push(' ');
                        }
                        else {
                            pieces[pieces.length - 1] += ' ';
                        }

                        values.push(tok);
                    }
                    else {
                        if (values.length >= pieces.length) {
                            pieces.push(tok());
                        }
                        else {
                            pieces[pieces.length - 1] += tok();
                        }
                    }
                }

                if (values.length === pieces.length) {
                    pieces.push('');
                }

                let blah = '';
                for (let i = 0; i < pieces.length; i++) {
                    blah += (pieces[i] + values[i]);
                }
                blah += pieces[pieces.length - 1];

                return zxEnv(env)(pieces, ...values);
            }
        };

        return actions;
    };
}
