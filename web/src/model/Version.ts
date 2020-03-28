const VERSION_REGEX = /^(v?)(\d+\.\d+(?:\.\d+)?)(.*)/i;

export interface VersionParts {
    preamble: string,
    major: number,
    minor: number,
    patch?: number,
    postamble: string,
}

export default {
    parse(str: string): VersionParts|null {
        const match = VERSION_REGEX.exec(str);
        if (!match) {
            return null
        }

        // Example: 'v3.2.1-beta' would parse into
        //   Group 1: v
        //   Group 2: 3.2.1
        //   Group 3: -beta

        const numbers = match[2].split('.').map(n => (
            (n !== undefined) ? parseInt(n) : undefined
        ));

        return {
            preamble: match[1],
            major: numbers[0]!,
            minor: numbers[1]!, // guaranteed by the regex
            patch: numbers[2],
            postamble: match[3],
        }
    },
    render(parts: VersionParts): string {
        let numbers = `${parts.major}.${parts.minor}`;

        if (parts.patch !== undefined) {
            numbers += `.${parts.patch}`;
        }

        return `${parts.preamble}${numbers}${parts.postamble}`;
    }
};

