#!/bin/env node

import peltonLib from './pelton-lib.mjs';

peltonLib(process.argv).catch(e => {
    console.log(e);
    process.exitCode = 1;
});
