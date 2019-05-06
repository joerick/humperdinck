export const Base64 = {
    // base64 decoding: from DOMString to Base64-encoded utf8, and back again.
    encode(str: string) {
        // first we use encodeURIComponent to get percent-encoded UTF-8,
        // then we convert the percent encodings into raw bytes which
        // can be fed into btoa.
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
            function toSolidBytes(match, p1) {
                // @ts-ignore
                return String.fromCharCode('0x' + p1);
        }));
    },

    decode(str: string) {
        // Going backwards: from bytestream, to percent-encoding, to original string.
        return decodeURIComponent(atob(str).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    },
}

export async function asyncGeneratorToList<T>(generator: AsyncIterableIterator<T>) {
    const result = [];
    while (true) {
        const {done, value} = await generator.next();
        if (done) {
            break;
        }
        result.push(value);
    }
    // for await(const el of generator) {
    //     result.push(el);
    // }
    return result;
}
