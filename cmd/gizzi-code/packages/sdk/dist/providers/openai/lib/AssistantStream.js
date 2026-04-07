var _a;
import { Stream } from '../streaming';
import { APIUserAbortError, AllternitOpenAIError } from '../error';
import { EventStream } from './EventStream';
import { isObj } from '../internal/utils';
export class AssistantStream extends EventStream {
    //Track all events in a single list for reference
    #events = [];
    //Used to accumulate deltas
    //We are accumulating many types so the value here is not strict
    #runStepSnapshots = {};
    #messageSnapshots = {};
    #messageSnapshot;
    #finalRun;
    #currentContentIndex;
    #currentContent;
    #currentToolCallIndex;
    #currentToolCall;
    //For current snapshot methods
    #currentEvent;
    #currentRunSnapshot;
    #currentRunStepSnapshot;
    [Symbol.asyncIterator]() {
        const pushQueue = [];
        const readQueue = [];
        let done = false;
        //Catch all for passing along all events
        this.on('event', (event) => {
            const reader = readQueue.shift();
            if (reader) {
                reader.resolve(event);
            }
            else {
                pushQueue.push(event);
            }
        });
        this.on('end', () => {
            done = true;
            for (const reader of readQueue) {
                reader.resolve(undefined);
            }
            readQueue.length = 0;
        });
        this.on('abort', (err) => {
            done = true;
            for (const reader of readQueue) {
                reader.reject(err);
            }
            readQueue.length = 0;
        });
        this.on('error', (err) => {
            done = true;
            for (const reader of readQueue) {
                reader.reject(err);
            }
            readQueue.length = 0;
        });
        return {
            next: async () => {
                if (!pushQueue.length) {
                    if (done) {
                        return { value: undefined, done: true };
                    }
                    return new Promise((resolve, reject) => readQueue.push({ resolve, reject })).then((chunk) => (chunk ? { value: chunk, done: false } : { value: undefined, done: true }));
                }
                const chunk = pushQueue.shift();
                return { value: chunk, done: false };
            },
            return: async () => {
                this.abort();
                return { value: undefined, done: true };
            },
        };
    }
    static fromReadableStream(stream) {
        const runner = new _a();
        runner._run(() => runner._fromReadableStream(stream));
        return runner;
    }
    async _fromReadableStream(readableStream, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted)
                this.controller.abort();
            signal.addEventListener('abort', () => this.controller.abort());
        }
        this._connected();
        const stream = Stream.fromReadableStream(readableStream, this.controller);
        for await (const event of stream) {
            this.#addEvent(event);
        }
        if (stream.controller.signal?.aborted) {
            throw new APIUserAbortError();
        }
        return this._addRun(this.#endRequest());
    }
    toReadableStream() {
        const stream = new Stream(this[Symbol.asyncIterator].bind(this), this.controller);
        return stream.toReadableStream();
    }
    static createToolAssistantStream(runId, runs, params, options) {
        const runner = new _a();
        runner._run(() => runner._runToolAssistantStream(runId, runs, params, {
            ...options,
            headers: { ...options?.headers, 'X-Stainless-Helper-Method': 'stream' },
        }));
        return runner;
    }
    async _createToolAssistantStream(run, runId, params, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted)
                this.controller.abort();
            signal.addEventListener('abort', () => this.controller.abort());
        }
        const body = { ...params, stream: true };
        const stream = await run.submitToolOutputs(runId, body, {
            ...options,
            signal: this.controller.signal,
        });
        this._connected();
        for await (const event of stream) {
            this.#addEvent(event);
        }
        if (stream.controller.signal?.aborted) {
            throw new APIUserAbortError();
        }
        return this._addRun(this.#endRequest());
    }
    static createThreadAssistantStream(params, thread, options) {
        const runner = new _a();
        runner._run(() => runner._threadAssistantStream(params, thread, {
            ...options,
            headers: { ...options?.headers, 'X-Stainless-Helper-Method': 'stream' },
        }));
        return runner;
    }
    static createAssistantStream(threadId, runs, params, options) {
        const runner = new _a();
        runner._run(() => runner._runAssistantStream(threadId, runs, params, {
            ...options,
            headers: { ...options?.headers, 'X-Stainless-Helper-Method': 'stream' },
        }));
        return runner;
    }
    currentEvent() {
        return this.#currentEvent;
    }
    currentRun() {
        return this.#currentRunSnapshot;
    }
    currentMessageSnapshot() {
        return this.#messageSnapshot;
    }
    currentRunStepSnapshot() {
        return this.#currentRunStepSnapshot;
    }
    async finalRunSteps() {
        await this.done();
        return Object.values(this.#runStepSnapshots);
    }
    async finalMessages() {
        await this.done();
        return Object.values(this.#messageSnapshots);
    }
    async finalRun() {
        await this.done();
        if (!this.#finalRun)
            throw Error('Final run was not received.');
        return this.#finalRun;
    }
    async _createThreadAssistantStream(thread, params, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted)
                this.controller.abort();
            signal.addEventListener('abort', () => this.controller.abort());
        }
        const body = { ...params, stream: true };
        const stream = await thread.createAndRun(body, { ...options, signal: this.controller.signal });
        this._connected();
        for await (const event of stream) {
            this.#addEvent(event);
        }
        if (stream.controller.signal?.aborted) {
            throw new APIUserAbortError();
        }
        return this._addRun(this.#endRequest());
    }
    async _createAssistantStream(run, threadId, params, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted)
                this.controller.abort();
            signal.addEventListener('abort', () => this.controller.abort());
        }
        const body = { ...params, stream: true };
        const stream = await run.create(threadId, body, { ...options, signal: this.controller.signal });
        this._connected();
        for await (const event of stream) {
            this.#addEvent(event);
        }
        if (stream.controller.signal?.aborted) {
            throw new APIUserAbortError();
        }
        return this._addRun(this.#endRequest());
    }
    #addEvent(event) {
        if (this.ended)
            return;
        this.#currentEvent = event;
        this.#handleEvent(event);
        switch (event.event) {
            case 'thread.created':
                //No action on this event.
                break;
            case 'thread.run.created':
            case 'thread.run.queued':
            case 'thread.run.in_progress':
            case 'thread.run.requires_action':
            case 'thread.run.completed':
            case 'thread.run.incomplete':
            case 'thread.run.failed':
            case 'thread.run.cancelling':
            case 'thread.run.cancelled':
            case 'thread.run.expired':
                this.#handleRun(event);
                break;
            case 'thread.run.step.created':
            case 'thread.run.step.in_progress':
            case 'thread.run.step.delta':
            case 'thread.run.step.completed':
            case 'thread.run.step.failed':
            case 'thread.run.step.cancelled':
            case 'thread.run.step.expired':
                this.#handleRunStep(event);
                break;
            case 'thread.message.created':
            case 'thread.message.in_progress':
            case 'thread.message.delta':
            case 'thread.message.completed':
            case 'thread.message.incomplete':
                this.#handleMessage(event);
                break;
            case 'error':
                //This is included for completeness, but errors are processed in the SSE event processing so this should not occur
                throw new Error('Encountered an error event in event processing - errors should be processed earlier');
            default:
                assertNever(event);
        }
    }
    #endRequest() {
        if (this.ended) {
            throw new AllternitOpenAIError(`stream has ended, this shouldn't happen`);
        }
        if (!this.#finalRun)
            throw Error('Final run has not been received');
        return this.#finalRun;
    }
    #handleMessage(event) {
        const [accumulatedMessage, newContent] = this.#accumulateMessage(event, this.#messageSnapshot);
        this.#messageSnapshot = accumulatedMessage;
        this.#messageSnapshots[accumulatedMessage.id] = accumulatedMessage;
        for (const content of newContent) {
            const snapshotContent = accumulatedMessage.content[content.index];
            if (snapshotContent?.type == 'text') {
                this._emit('textCreated', snapshotContent.text);
            }
        }
        switch (event.event) {
            case 'thread.message.created':
                this._emit('messageCreated', event.data);
                break;
            case 'thread.message.in_progress':
                break;
            case 'thread.message.delta':
                this._emit('messageDelta', event.data.delta, accumulatedMessage);
                if (event.data.delta.content) {
                    for (const content of event.data.delta.content) {
                        //If it is text delta, emit a text delta event
                        if (content.type == 'text' && content.text) {
                            let textDelta = content.text;
                            let snapshot = accumulatedMessage.content[content.index];
                            if (snapshot && snapshot.type == 'text') {
                                this._emit('textDelta', textDelta, snapshot.text);
                            }
                            else {
                                throw Error('The snapshot associated with this text delta is not text or missing');
                            }
                        }
                        if (content.index != this.#currentContentIndex) {
                            //See if we have in progress content
                            if (this.#currentContent) {
                                switch (this.#currentContent.type) {
                                    case 'text':
                                        this._emit('textDone', this.#currentContent.text, this.#messageSnapshot);
                                        break;
                                    case 'image_file':
                                        this._emit('imageFileDone', this.#currentContent.image_file, this.#messageSnapshot);
                                        break;
                                }
                            }
                            this.#currentContentIndex = content.index;
                        }
                        this.#currentContent = accumulatedMessage.content[content.index];
                    }
                }
                break;
            case 'thread.message.completed':
            case 'thread.message.incomplete':
                //We emit the latest content we were working on on completion (including incomplete)
                if (this.#currentContentIndex !== undefined) {
                    const currentContent = event.data.content[this.#currentContentIndex];
                    if (currentContent) {
                        switch (currentContent.type) {
                            case 'image_file':
                                this._emit('imageFileDone', currentContent.image_file, this.#messageSnapshot);
                                break;
                            case 'text':
                                this._emit('textDone', currentContent.text, this.#messageSnapshot);
                                break;
                        }
                    }
                }
                if (this.#messageSnapshot) {
                    this._emit('messageDone', event.data);
                }
                this.#messageSnapshot = undefined;
        }
    }
    #handleRunStep(event) {
        const accumulatedRunStep = this.#accumulateRunStep(event);
        this.#currentRunStepSnapshot = accumulatedRunStep;
        switch (event.event) {
            case 'thread.run.step.created':
                this._emit('runStepCreated', event.data);
                break;
            case 'thread.run.step.delta':
                const delta = event.data.delta;
                if (delta.step_details &&
                    delta.step_details.type == 'tool_calls' &&
                    delta.step_details.tool_calls &&
                    accumulatedRunStep.step_details.type == 'tool_calls') {
                    for (const toolCall of delta.step_details.tool_calls) {
                        if (toolCall.index == this.#currentToolCallIndex) {
                            this._emit('toolCallDelta', toolCall, accumulatedRunStep.step_details.tool_calls[toolCall.index]);
                        }
                        else {
                            if (this.#currentToolCall) {
                                this._emit('toolCallDone', this.#currentToolCall);
                            }
                            this.#currentToolCallIndex = toolCall.index;
                            this.#currentToolCall = accumulatedRunStep.step_details.tool_calls[toolCall.index];
                            if (this.#currentToolCall)
                                this._emit('toolCallCreated', this.#currentToolCall);
                        }
                    }
                }
                this._emit('runStepDelta', event.data.delta, accumulatedRunStep);
                break;
            case 'thread.run.step.completed':
            case 'thread.run.step.failed':
            case 'thread.run.step.cancelled':
            case 'thread.run.step.expired':
                this.#currentRunStepSnapshot = undefined;
                const details = event.data.step_details;
                if (details.type == 'tool_calls') {
                    if (this.#currentToolCall) {
                        this._emit('toolCallDone', this.#currentToolCall);
                        this.#currentToolCall = undefined;
                    }
                }
                this._emit('runStepDone', event.data, accumulatedRunStep);
                break;
            case 'thread.run.step.in_progress':
                break;
        }
    }
    #handleEvent(event) {
        this.#events.push(event);
        this._emit('event', event);
    }
    #accumulateRunStep(event) {
        switch (event.event) {
            case 'thread.run.step.created':
                this.#runStepSnapshots[event.data.id] = event.data;
                return event.data;
            case 'thread.run.step.delta':
                let snapshot = this.#runStepSnapshots[event.data.id];
                if (!snapshot) {
                    throw Error('Received a RunStepDelta before creation of a snapshot');
                }
                let data = event.data;
                if (data.delta) {
                    const accumulated = _a.accumulateDelta(snapshot, data.delta);
                    this.#runStepSnapshots[event.data.id] = accumulated;
                }
                return this.#runStepSnapshots[event.data.id];
            case 'thread.run.step.completed':
            case 'thread.run.step.failed':
            case 'thread.run.step.cancelled':
            case 'thread.run.step.expired':
            case 'thread.run.step.in_progress':
                this.#runStepSnapshots[event.data.id] = event.data;
                break;
        }
        if (this.#runStepSnapshots[event.data.id])
            return this.#runStepSnapshots[event.data.id];
        throw new Error('No snapshot available');
    }
    #accumulateMessage(event, snapshot) {
        let newContent = [];
        switch (event.event) {
            case 'thread.message.created':
                //On creation the snapshot is just the initial message
                return [event.data, newContent];
            case 'thread.message.delta':
                if (!snapshot) {
                    throw Error('Received a delta with no existing snapshot (there should be one from message creation)');
                }
                let data = event.data;
                //If this delta does not have content, nothing to process
                if (data.delta.content) {
                    for (const contentElement of data.delta.content) {
                        if (contentElement.index in snapshot.content) {
                            let currentContent = snapshot.content[contentElement.index];
                            snapshot.content[contentElement.index] = this.#accumulateContent(contentElement, currentContent);
                        }
                        else {
                            snapshot.content[contentElement.index] = contentElement;
                            // This is a new element
                            newContent.push(contentElement);
                        }
                    }
                }
                return [snapshot, newContent];
            case 'thread.message.in_progress':
            case 'thread.message.completed':
            case 'thread.message.incomplete':
                //No changes on other thread events
                if (snapshot) {
                    return [snapshot, newContent];
                }
                else {
                    throw Error('Received thread message event with no existing snapshot');
                }
        }
        throw Error('Tried to accumulate a non-message event');
    }
    #accumulateContent(contentElement, currentContent) {
        return _a.accumulateDelta(currentContent, contentElement);
    }
    static accumulateDelta(acc, delta) {
        for (const [key, deltaValue] of Object.entries(delta)) {
            if (!acc.hasOwnProperty(key)) {
                acc[key] = deltaValue;
                continue;
            }
            let accValue = acc[key];
            if (accValue === null || accValue === undefined) {
                acc[key] = deltaValue;
                continue;
            }
            // We don't accumulate these special properties
            if (key === 'index' || key === 'type') {
                acc[key] = deltaValue;
                continue;
            }
            // Type-specific accumulation logic
            if (typeof accValue === 'string' && typeof deltaValue === 'string') {
                accValue += deltaValue;
            }
            else if (typeof accValue === 'number' && typeof deltaValue === 'number') {
                accValue += deltaValue;
            }
            else if (isObj(accValue) && isObj(deltaValue)) {
                accValue = this.accumulateDelta(accValue, deltaValue);
            }
            else if (Array.isArray(accValue) && Array.isArray(deltaValue)) {
                if (accValue.every((x) => typeof x === 'string' || typeof x === 'number')) {
                    accValue.push(...deltaValue); // Use spread syntax for efficient addition
                    continue;
                }
                for (const deltaEntry of deltaValue) {
                    if (!isObj(deltaEntry)) {
                        throw new Error(`Expected array delta entry to be an object but got: ${deltaEntry}`);
                    }
                    const index = deltaEntry['index'];
                    if (index == null) {
                        console.error(deltaEntry);
                        throw new Error('Expected array delta entry to have an `index` property');
                    }
                    if (typeof index !== 'number') {
                        throw new Error(`Expected array delta entry \`index\` property to be a number but got ${index}`);
                    }
                    const accEntry = accValue[index];
                    if (accEntry == null) {
                        accValue.push(deltaEntry);
                    }
                    else {
                        accValue[index] = this.accumulateDelta(accEntry, deltaEntry);
                    }
                }
                continue;
            }
            else {
                throw Error(`Unhandled record type: ${key}, deltaValue: ${deltaValue}, accValue: ${accValue}`);
            }
            acc[key] = accValue;
        }
        return acc;
    }
    #handleRun(event) {
        this.#currentRunSnapshot = event.data;
        switch (event.event) {
            case 'thread.run.created':
                break;
            case 'thread.run.queued':
                break;
            case 'thread.run.in_progress':
                break;
            case 'thread.run.requires_action':
            case 'thread.run.cancelled':
            case 'thread.run.failed':
            case 'thread.run.completed':
            case 'thread.run.expired':
            case 'thread.run.incomplete':
                this.#finalRun = event.data;
                if (this.#currentToolCall) {
                    this._emit('toolCallDone', this.#currentToolCall);
                    this.#currentToolCall = undefined;
                }
                break;
            case 'thread.run.cancelling':
                break;
        }
    }
    _addRun(run) {
        return run;
    }
    async _threadAssistantStream(params, thread, options) {
        return await this._createThreadAssistantStream(thread, params, options);
    }
    async _runAssistantStream(threadId, runs, params, options) {
        return await this._createAssistantStream(runs, threadId, params, options);
    }
    async _runToolAssistantStream(runId, runs, params, options) {
        return await this._createToolAssistantStream(runs, runId, params, options);
    }
}
_a = AssistantStream;
function assertNever(_x) { }
//# sourceMappingURL=AssistantStream.js.map