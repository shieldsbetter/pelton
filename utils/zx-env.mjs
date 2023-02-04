import dzx from './dynamic-zx.mjs';

export default function zxEnv(env = {}) {
    const envLiterals = [];
    const envQuoted = [];

    for (const [k, v] of Object.entries(env)) {
        envLiterals.push((envLiterals.length > 0 ? '\n' : '') + `export ${k}=`);
        envQuoted.push(v);
    }

    return (literals, ...toQuote) => {
        const newLiterals = [...envLiterals, '\n' + literals[0], ...literals.slice(1)];
        const newToQuote = [...envQuoted, ...toQuote];

        return dzx(newLiterals, ...newToQuote);
    };
}
