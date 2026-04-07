// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from '../../core/resource';
import * as SpeechAPI from './speech';
import { Speech } from './speech';
import * as TranscriptionsAPI from './transcriptions';
import { Transcriptions, } from './transcriptions';
import * as TranslationsAPI from './translations';
import { Translations, } from './translations';
export class Audio extends APIResource {
    transcriptions = new TranscriptionsAPI.Transcriptions(this._client);
    translations = new TranslationsAPI.Translations(this._client);
    speech = new SpeechAPI.Speech(this._client);
}
Audio.Transcriptions = Transcriptions;
Audio.Translations = Translations;
Audio.Speech = Speech;
//# sourceMappingURL=audio.js.map