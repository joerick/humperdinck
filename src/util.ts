import {
    onSnapshot,
    type DocumentData,
    type DocumentReference,
    type FirestoreError,
    type Unsubscribe,
} from 'firebase/firestore';

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

export class FirestoreDocumentObserver<T = DocumentData> {
    private waitingValueCallbacks: ((data: T|undefined, error?: FirestoreError|Error) => void)[] = []
    private _dispose: Unsubscribe

    constructor(readonly reference: DocumentReference<T>,
                readonly onUpdate: (documentData: T|undefined) => void) {
        this._dispose = onSnapshot(reference, {
            next: snapshot => {
                const data = snapshot.data()
                onUpdate(data)
                this.waitingValueCallbacks.forEach(callback => callback(data))
                this.waitingValueCallbacks = []
            },
            error: error => {
                this.waitingValueCallbacks.forEach(callback => callback(undefined, error))
                this.waitingValueCallbacks = []
            },
        })
    }

    nextValue(): Promise<T|undefined> {
        return new Promise((resolve, reject) => {
            this.waitingValueCallbacks.push((data, error) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(data)
                }
            })
        })
    }

    dispose() {
        const waitingError = new Error('Observer was disposed before it got a value')

        this.waitingValueCallbacks.forEach(callback => callback(undefined, waitingError))
        this.waitingValueCallbacks = []

        this._dispose()
    }
}

export class CancellableTask {
    signal: AbortSignal | undefined;

    constructor(
        runFunc: ((task: CancellableTask) => Promise<void>),
        options: {signal?: AbortSignal} = {}
    ) {
        this.signal = options.signal
        this.cancelPromise = new Promise<void>((resolve, reject) => {
            this.cancelPromiseRejectCallback = reject
        })

        runFunc(this)
            .catch((error: Error) => {
                if (error.message == 'cancelled' || error.name == 'AbortError') {
                    return
                } else {
                    console.error(error)
                }
            })
            .finally(() => {
                this._isFinished = true
            })
    }

    isCancelled = false
    _isFinished = false

    cancel() {
        if (!this._isFinished) {
            this.isCancelled = true
            this.cancelPromiseRejectCallback(new Error('cancelled'))
        }
    }

    cancelPromise: Promise<void>
    cancelPromiseRejectCallback!: (error: Error) => void

    yield() {
        this._throwIfCancelled()
    }

    async delay(millis: number) {
        await Promise.race([
            delay(millis),
            this.cancelPromise,
        ])
        this._throwIfCancelled();
    }

    async nextAnimationFrame() {
        await Promise.race([
            new Promise(r => window.requestAnimationFrame(r)),
            this.cancelPromise,
        ])
        this._throwIfCancelled();
    }

    async promise<T>(promise: Promise<T>): Promise<T> {
        const result = await Promise.race([promise, this.cancelPromise])
        this._throwIfCancelled();
        return result as T;
    }

    _throwIfCancelled() {
        if (this.isCancelled) {
            throw new Error('cancelled');
        }
        this.signal?.throwIfAborted()
    }
}

export async function delay(millis: number): Promise<void> {
    return new Promise(r => window.setTimeout(r, millis))
}
