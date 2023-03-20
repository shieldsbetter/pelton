import terminalSize from 'term-size';

import { createLogUpdate } from 'log-update';

export default function buildTaskLogger(outStream, tty = true) {

    return async (title, shellProcess, outFields) => {
        const out = outputter(title, outStream, tty);

        if (!Array.isArray(outFields)) {
            outFields = [outFields];
        }

        for (const outField of outFields) {
            shellProcess[outField].on('data', out);
        }

        try {
            await shellProcess;
        }
        catch (e) {
            outStream.write(
                    `\nTask "${title}" exited with a non-zero exit code.\n\n`);

            for (const outField of outFields) {
                outStream.write(outField + ':\n');
                for (const line of e[outField].split('\n')) {
                    outStream.write(line + '\n');
                }
            }
            process.exit(1);
        }
    };
}

function outputter(title, outStream, tty) {
    let result;

    if (tty) {
        const log = createLogUpdate(outStream);
        const output = [];

        function drawOutput() {
            const { columns } = terminalSize();

            const splitOutput = output
                    .map(l => splitLine(l, columns - 10))
                    .map(breaks => breaks.map((subline, i) => i === 0
                            ? `> ${subline}` : `  ${subline}`))
                    .flat();

            if (splitOutput[splitOutput.length - 1] === '') {
                splitOutput.pop();
            }

            while (splitOutput.length > 5) {
                splitOutput.shift();
            }

            log('\n' + box(columns, title, splitOutput) + '\n');
        }

        drawOutput();

        result = s => {
            const lines = s.toString('utf8').split('\n');

            if (output.length === 0) {
                output.push(lines[0].replace(/\t/g, '    '));
            }
            else {
                output[output.length - 1] =
                        output[output.length - 1] + lines[0];
            }

            for (let i = 1; i < lines.length; i++) {
                output.push(lines[i]);
            }

            while (output.length > 100) {
                output.shift();
            }

            drawOutput();
        };
    }
    else {
        const { columns } = terminalSize();
        outStream.write('\n' +
                buildLine(columns, '  ╭─ ' + title + ' ', '─', '╮ ') + '\n\n');

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

function splitLine(l, w) {
    let result = [];

    while (l.length > 0) {
        result.push(l.substring(0, w));
        l = l.substring(w);
    }

    return result;
}

// `boxen` betrayed me by trimming lines, so here's a quick re-implement. ;)
function box(width, title, lines) {
    let result = [];

    result.push(buildLine(width,
            title ? '  ╭─ ' + title + ' ' : ' ╭─', '─', '─╮ '));

    for (const line of lines) {
        result.push(buildLine(width, '  │ ' + line, ' ', '│ '));
    }

    result.push(buildLine(width, '  ╰', '─', '╯ '));

    return result.join('\n');
}

function buildLine(width, prefix, filler, suffix) {
    let line = prefix;

    while (line.length < width - suffix.length - 1) {
        line += filler;
    }

    line += suffix;

    return line;
}