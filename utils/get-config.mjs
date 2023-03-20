import cson from 'cson';
import pathLib from 'path';

export default function getConfig(services, dir) {
    const configFilename = pathLib.join(dir, 'pelton.cson');
    const rawConfig = services.fs.readFileSync(configFilename, 'utf8');
    const parsed = cson.parse(rawConfig);

    if (parsed instanceof Error) {
        console.error('Bad CSON syntax in ' + configFilename + ': '
                + parsed.message);

        const lines = parsed.code.split('\n');
        for (let line = parsed.location.first_line;
                    line <= parsed.location.last_line; line++) {
            console.error(lines[line]);
        }

        let indent = '';
        for (let col = 0; col < parsed.location.first_column; col++) {
            const char = lines[parsed.location.first_line].charAt(col);

            if (char === '\t') {
                indent += '\t';
            }
            else {
                indent += ' ';
            }
        }

        console.error(indent + '^');
        process.exit(1);
    }

    return parsed;
}