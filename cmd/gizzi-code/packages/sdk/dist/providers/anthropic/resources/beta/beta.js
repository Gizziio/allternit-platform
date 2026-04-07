// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from '../../core/resource';
import * as FilesAPI from './files';
import { Files, } from './files';
import * as ModelsAPI from './models';
import { Models, } from './models';
import * as MessagesAPI from './messages/messages';
import { Messages, } from './messages/messages';
import * as SkillsAPI from './skills/skills';
import { Skills, } from './skills/skills';
export class Beta extends APIResource {
    models = new ModelsAPI.Models(this._client);
    messages = new MessagesAPI.Messages(this._client);
    files = new FilesAPI.Files(this._client);
    skills = new SkillsAPI.Skills(this._client);
}
Beta.Models = Models;
Beta.Messages = Messages;
Beta.Files = Files;
Beta.Skills = Skills;
//# sourceMappingURL=beta.js.map