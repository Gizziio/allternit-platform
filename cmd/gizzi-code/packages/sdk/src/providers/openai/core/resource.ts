// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import type { AllternitOpenAI } from '../client';

export abstract class APIResource {
  protected _client: AllternitOpenAI;

  constructor(client: AllternitOpenAI) {
    this._client = client;
  }
}
