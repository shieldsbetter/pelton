import cson from 'cson';
import pathLib from 'path';

export default function getConfig(services, dir) {
    const configFilename = pathLib.join(dir, 'pelton.cson');
    const rawConfig = services.fs.readFileSync(configFilename, 'utf8');
    return cson.parse(rawConfig);
}