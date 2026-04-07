// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { BaseAllternitAI } from '../client';

export abstract class APIResource {
  protected _client: BaseAllternitAI;

  constructor(client: BaseAllternitAI) {
    this._client = client;
  }
}
