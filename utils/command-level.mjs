import cliclopts from 'cliclopts';
import fs from 'fs';
import minimist from 'minimist';

export default async function commandLevel(parentCommand, argv, commands) {
    function printCommands() {
        console.error('Expected one of the following:\n');

        for (const [cmd, [,summary]] of Object.entries(commands)) {
            console.error(`    ${cmd} - ${summary}`);
        }
    }

    if (!argv[0]) {
        console.error('Missing subcommand.\n');
        printCommands();
        process.exitCode = 1;
    }
    else if (argv[0] === '--help') {
        printCommands();
    }
    else if (argv[0] === '--version') {
        console.log(JSON.parse(fs.readFileSync('package.json', 'utf8')).version);
    }
    else if (!commands[argv[0]]) {
        console.error('Unknown subcommand: ' + argv[0] + '.\n');
        printCommands();
        process.exitCode = 1;
    }
    else {
        const opts = cliclopts([
            ...commands[argv[0]][2],

            {
                name: 'help',
                boolean: true,
                help: 'display this help'
            }
        ]);

        const args = minimist(argv.slice(1), {
            ...opts.options(),
            stopEarly: true
        });

        function printUsage() {
            console.error(
                    `${parentCommand} ${argv[0]} ${commands[argv[0]][0]}`);
            console.error();
            console.error(opts.usage());
        }

        if (args.help) {
            printUsage();
        }
        else {
            try {
                await commands[argv[0]][3](args, buildCliError);
            }
            catch (e) {
                if (e.code !== 'CLI_ERROR') {
                    throw e;
                }

                console.error(e.message);
                printUsage();
                process.exitCode = 1;
            }
        }
    }
}

function buildCliError(msg) {
    const e = new Error(msg);
    e.code = 'CLI_ERROR';
    return e;
}
