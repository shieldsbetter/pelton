import boxen from 'boxen';

import { createLogUpdate } from 'log-update';

export default function buildTaskLogger(outStream, tty = true) {

    return async (title, inStream) => {
        const out = outputter(title, outStream, tty);

        for await (const chunk of inStream) {
            out(chunk);
        }
    };
}

function outputter(title, outStream, tty) {
    let result;

    if (tty) {
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

        result = s => {
            const lines = s.toString('utf8').split('\n');

            if (output.length === 0) {
                output.push(lines[0]);
            }
            else {
                output[output.length - 1] =
                        output[output.length - 1] + lines[0];
            }

            for (let i = 1; i < lines.length; i++) {
                output.push(lines[i]);
            }

            while (output.length > 6) {
                output.shift();
            }

            drawOutput();
        };
    }
    else {
        outStream.write(boxen(title, {
                borderStyle: 'round',
                margin: inset(2, 1),
                padding: inset(1, 0)
            }) + '\n');

        result = s => outStream.write(s);
    }

    return result;
}

function inset(x, y = x) {
    return {
        top: y,
        bottom: y,
        left: x,
        right: x
    }
}
