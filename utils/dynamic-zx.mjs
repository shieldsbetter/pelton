import { $ as zx } from 'zx';

export default function dynamicZx(pieces, ...values) {
    const processedPieces = [pieces[0]];
    const processedValues = [];

    for (let i = 0; i < values.length; i++) {
        if (typeof values[i] === 'function') {
            processedPieces[processedPieces.length - 1] += values[i]() + pieces[i + 1];
        }
        else {
            processedPieces.push(pieces[i + 1]);
            processedValues.push(values[i]);
        }
    }

    return zx(processedPieces, ...processedValues);
}
