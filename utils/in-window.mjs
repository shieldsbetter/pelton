import boxen from 'boxen';

import { createLogUpdate } from 'log-update';

export default async function inWindow(
        title, inStream, outStream = process.stderr) {
    const log = createLogUpdate(outStream);

    const output = [];
    function drawOutput() {
        const toPrint = output && output[output.length - 1] === ''
                ? output.slice(0, -1) : output;

        log(boxen(toPrint.join('\n'), {
            borderStyle: 'round',
            margin: inset(2, 1),
            padding: inset(1, 0),
            title,
            fullscreen: (w, h) => [w - 4, toPrint.length + 2]
        }));
    }

    drawOutput();

    for await (const chunk of inStream) {
        const lines = chunk.toString('utf8').split('\n');

        if (output.length === 0) {
            output.push(lines[0]);
        }
        else {
            output[output.length - 1] = output[output.length - 1] + lines[0];
        }

        for (let i = 1; i < lines.length; i++) {
            output.push(lines[i]);
        }

        while (output.length > 6) {
            output.shift();
        }

        drawOutput();
    }
};

function inset(x, y = x) {
    return {
        top: y,
        bottom: y,
        left: x,
        right: x
    }
}
