import fs from 'fs';
import Mustache from 'mustache';

console.log(Mustache.render(
        fs.readFileSync(process.argv[2], 'utf8'), process.env));
