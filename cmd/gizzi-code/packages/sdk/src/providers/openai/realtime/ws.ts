import * as WS from 'ws';
import { AzureOpenAI, AllternitOpenAI } from '../index';
import type { RealtimeClientEvent, RealtimeServerEvent } from '../resources/realtime/realtime';
import { AllternitOpenAIRealtimeEmitter, buildRealtimeURL, isAzure } from './internal-base';

export class AllternitOpenAIRealtimeWS extends AllternitOpenAIRealtimeEmitter {
  url: URL;
  socket: WS.WebSocket;

  constructor(
    props: {
      model: string;
      options?: WS.ClientOptions | undefined;
      /** @internal */ __resolvedApiKey?: boolean;
    },
    client?: Pick<AllternitOpenAI, 'apiKey' | 'baseURL'>,
  ) {
    super();
    client ??= new AllternitOpenAI();
    const hasProvider = typeof (client as any)?._options?.apiKey === 'function';
    if (hasProvider && !props.__resolvedApiKey) {
      throw new Error(
        [
          'Cannot open Realtime WebSocket with a function-based apiKey.',
          'Use the .create() method so that the key is resolved before connecting:',
          'await AllternitOpenAIRealtimeWS.create(client, { model })',
        ].join('\n'),
      );
    }
    this.url = buildRealtimeURL(client, props.model);
    this.socket = new WS.WebSocket(this.url, {
      ...props.options,
      headers: {
        ...props.options?.headers,
        ...(isAzure(client) && !props.__resolvedApiKey ? {} : { Authorization: `Bearer ${client.apiKey}` }),
      },
    });

    this.socket.on('message', (wsEvent) => {
      const event = (() => {
        try {
          return JSON.parse(wsEvent.toString()) as RealtimeServerEvent;
        } catch (err) {
          this._onError(null, 'could not parse websocket event', err);
          return null;
        }
      })();

      if (event) {
        this._emit('event', event);

        if (event.type === 'error') {
          this._onError(event);
        } else {
          // @ts-expect-error TS isn't smart enough to get the relationship right here
          this._emit(event.type, event);
        }
      }
    });

    this.socket.on('error', (err) => {
      this._onError(null, err.message, err);
    });
  }

  static async create(
    client: Pick<AllternitOpenAI, 'apiKey' | 'baseURL' | '_callApiKey'>,
    props: { model: string; options?: WS.ClientOptions | undefined },
  ): Promise<AllternitOpenAIRealtimeWS> {
    return new AllternitOpenAIRealtimeWS({ ...props, __resolvedApiKey: await client._callApiKey() }, client);
  }

  static async azure(
    client: Pick<AzureOpenAI, '_callApiKey' | 'apiVersion' | 'apiKey' | 'baseURL' | 'deploymentName'>,
    props: { deploymentName?: string; options?: WS.ClientOptions | undefined } = {},
  ): Promise<AllternitOpenAIRealtimeWS> {
    const isApiKeyProvider = await client._callApiKey();
    const deploymentName = props.deploymentName ?? client.deploymentName;
    if (!deploymentName) {
      throw new Error('No deployment name provided');
    }
    return new AllternitOpenAIRealtimeWS(
      {
        model: deploymentName,
        options: {
          ...props.options,
          headers: {
            ...props.options?.headers,
            ...(isApiKeyProvider ? {} : { 'api-key': client.apiKey }),
          },
        },
        __resolvedApiKey: isApiKeyProvider,
      },
      client,
    );
  }

  send(event: RealtimeClientEvent) {
    try {
      this.socket.send(JSON.stringify(event));
    } catch (err) {
      this._onError(null, 'could not send data', err);
    }
  }

  close(props?: { code: number; reason: string }) {
    try {
      this.socket.close(props?.code ?? 1000, props?.reason ?? 'OK');
    } catch (err) {
      this._onError(null, 'could not close the connection', err);
    }
  }
}
