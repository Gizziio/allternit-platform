import { APIUserAbortError, AllternitOpenAIError } from '../error';
export class EventStream {
    controller = new AbortController();
    #connectedPromise;
    #resolveConnectedPromise = () => { };
    #rejectConnectedPromise = () => { };
    #endPromise;
    #resolveEndPromise = () => { };
    #rejectEndPromise = () => { };
    #listeners = {};
    #ended = false;
    #errored = false;
    #aborted = false;
    #catchingPromiseCreated = false;
    constructor() {
        this.#connectedPromise = new Promise((resolve, reject) => {
            this.#resolveConnectedPromise = resolve;
            this.#rejectConnectedPromise = reject;
        });
        this.#endPromise = new Promise((resolve, reject) => {
            this.#resolveEndPromise = resolve;
            this.#rejectEndPromise = reject;
        });
        // Don't let these promises cause unhandled rejection errors.
        // we will manually cause an unhandled rejection error later
        // if the user hasn't registered any error listener or called
        // any promise-returning method.
        this.#connectedPromise.catch(() => { });
        this.#endPromise.catch(() => { });
    }
    _run(executor) {
        // Unfortunately if we call `executor()` immediately we get runtime errors about
        // references to `this` before the `super()` constructor call returns.
        setTimeout(() => {
            executor().then(() => {
                this._emitFinal();
                this._emit('end');
            }, this.#handleError.bind(this));
        }, 0);
    }
    _connected() {
        if (this.ended)
            return;
        this.#resolveConnectedPromise();
        this._emit('connect');
    }
    get ended() {
        return this.#ended;
    }
    get errored() {
        return this.#errored;
    }
    get aborted() {
        return this.#aborted;
    }
    abort() {
        this.controller.abort();
    }
    /**
     * Adds the listener function to the end of the listeners array for the event.
     * No checks are made to see if the listener has already been added. Multiple calls passing
     * the same combination of event and listener will result in the listener being added, and
     * called, multiple times.
     * @returns this ChatCompletionStream, so that calls can be chained
     */
    on(event, listener) {
        const listeners = this.#listeners[event] || (this.#listeners[event] = []);
        listeners.push({ listener });
        return this;
    }
    /**
     * Removes the specified listener from the listener array for the event.
     * off() will remove, at most, one instance of a listener from the listener array. If any single
     * listener has been added multiple times to the listener array for the specified event, then
     * off() must be called multiple times to remove each instance.
     * @returns this ChatCompletionStream, so that calls can be chained
     */
    off(event, listener) {
        const listeners = this.#listeners[event];
        if (!listeners)
            return this;
        const index = listeners.findIndex((l) => l.listener === listener);
        if (index >= 0)
            listeners.splice(index, 1);
        return this;
    }
    /**
     * Adds a one-time listener function for the event. The next time the event is triggered,
     * this listener is removed and then invoked.
     * @returns this ChatCompletionStream, so that calls can be chained
     */
    once(event, listener) {
        const listeners = this.#listeners[event] || (this.#listeners[event] = []);
        listeners.push({ listener, once: true });
        return this;
    }
    /**
     * This is similar to `.once()`, but returns a Promise that resolves the next time
     * the event is triggered, instead of calling a listener callback.
     * @returns a Promise that resolves the next time given event is triggered,
     * or rejects if an error is emitted.  (If you request the 'error' event,
     * returns a promise that resolves with the error).
     *
     * Example:
     *
     *   const message = await stream.emitted('message') // rejects if the stream errors
     */
    emitted(event) {
        return new Promise((resolve, reject) => {
            this.#catchingPromiseCreated = true;
            if (event !== 'error')
                this.once('error', reject);
            this.once(event, resolve);
        });
    }
    async done() {
        this.#catchingPromiseCreated = true;
        await this.#endPromise;
    }
    #handleError(error) {
        this.#errored = true;
        if (error instanceof Error && error.name === 'AbortError') {
            error = new APIUserAbortError();
        }
        if (error instanceof APIUserAbortError) {
            this.#aborted = true;
            return this._emit('abort', error);
        }
        if (error instanceof AllternitOpenAIError) {
            return this._emit('error', error);
        }
        if (error instanceof Error) {
            const openAIError = new AllternitOpenAIError(error.message);
            // @ts-ignore
            openAIError.cause = error;
            return this._emit('error', openAIError);
        }
        return this._emit('error', new AllternitOpenAIError(String(error)));
    }
    _emit(event, ...args) {
        // make sure we don't emit any events after end
        if (this.#ended) {
            return;
        }
        if (event === 'end') {
            this.#ended = true;
            this.#resolveEndPromise();
        }
        const listeners = this.#listeners[event];
        if (listeners) {
            this.#listeners[event] = listeners.filter((l) => !l.once);
            listeners.forEach(({ listener }) => listener(...args));
        }
        if (event === 'abort') {
            const error = args[0];
            if (!this.#catchingPromiseCreated && !listeners?.length) {
                Promise.reject(error);
            }
            this.#rejectConnectedPromise(error);
            this.#rejectEndPromise(error);
            this._emit('end');
            return;
        }
        if (event === 'error') {
            // NOTE: _emit('error', error) should only be called from #handleError().
            const error = args[0];
            if (!this.#catchingPromiseCreated && !listeners?.length) {
                // Trigger an unhandled rejection if the user hasn't registered any error handlers.
                // If you are seeing stack traces here, make sure to handle errors via either:
                // - runner.on('error', () => ...)
                // - await runner.done()
                // - await runner.finalChatCompletion()
                // - etc.
                Promise.reject(error);
            }
            this.#rejectConnectedPromise(error);
            this.#rejectEndPromise(error);
            this._emit('end');
        }
    }
    _emitFinal() { }
}
//# sourceMappingURL=EventStream.js.map