import type { ActionDefinition, JsonSchema } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

const service = "sunoapi";

const taskIdSchema = s.nonEmptyString("The SunoAPI task identifier.");
const audioIdSchema = s.nonEmptyString("The SunoAPI audio identifier.");
const callbackUrlSchema = s.url("The callback URL used to receive completed results.");
const generationModelSchema = s.stringEnum("The SunoAPI music generation model.", [
  "V4",
  "V4_5",
  "V4_5PLUS",
  "V4_5ALL",
  "V5",
  "V5_5",
]);
const personaModelSchema = s.stringEnum("The SunoAPI persona model.", ["style_persona", "voice_persona"]);
const weightSchema = (description: string) => s.number(description, { minimum: 0, maximum: 1 });
const taskOutputSchema = s.object("SunoAPI task submission response.", { taskId: taskIdSchema });
const detailsOutputSchema = s.looseObject("SunoAPI task details payload.");
const objectOutputSchema = s.looseObject("SunoAPI object response.");

const musicPromptFields = {
  prompt: s.nonEmptyString("The prompt, lyrics, or instruction sent to SunoAPI."),
  style: s.nonEmptyString("The music style or genre."),
  title: s.nonEmptyString("The generated music title."),
  customMode: s.boolean("Whether to use SunoAPI custom mode."),
  instrumental: s.boolean("Whether the generated audio should be instrumental."),
  personaId: s.nonEmptyString("The optional SunoAPI persona identifier."),
  personaModel: { ...personaModelSchema, default: "style_persona" },
  model: generationModelSchema,
  negativeTags: s.nonEmptyString("Music styles or traits to avoid."),
  vocalGender: s.stringEnum("The desired vocal gender.", ["m", "f"]),
  styleWeight: weightSchema("The style guidance weight between 0 and 1."),
  weirdnessConstraint: weightSchema("The creative weirdness constraint between 0 and 1."),
  audioWeight: weightSchema("The input audio influence weight between 0 and 1."),
  callBackUrl: callbackUrlSchema,
};

const taskIdInputSchema = s.object("Input parameters for fetching a SunoAPI task.", { taskId: taskIdSchema });
const taskAudioInputSchema = s.object("Input parameters for a SunoAPI task and audio item.", {
  taskId: taskIdSchema,
  audioId: audioIdSchema,
});

function inputSchema(description: string, fields: Record<string, JsonSchema>, optional: string[] = []): JsonSchema {
  return s.object(description, fields, { optional });
}

export const sunoapiActions: ActionDefinition[] = [
  defineProviderAction(service, {
    name: "get_remaining_credits",
    description: "Get remaining SunoAPI generation credits.",
    inputSchema: s.object("No input parameters are required.", {}),
    outputSchema: s.object("Remaining SunoAPI credits.", { credits: s.integer("Remaining credit count.") }),
  }),
  defineProviderAction(service, {
    name: "generate_music",
    description: "Submit a SunoAPI music generation task.",
    inputSchema: inputSchema("The input payload for submitting a SunoAPI music generation task.", musicPromptFields, [
      "prompt",
      "style",
      "title",
      "personaId",
      "personaModel",
      "negativeTags",
      "vocalGender",
      "styleWeight",
      "weirdnessConstraint",
      "audioWeight",
    ]),
    outputSchema: taskOutputSchema,
  }),
  defineProviderAction(service, {
    name: "get_music_generation_details",
    description: "Fetch SunoAPI music generation task details.",
    inputSchema: taskIdInputSchema,
    outputSchema: detailsOutputSchema,
  }),
  defineProviderAction(service, {
    name: "generate_lyrics",
    description: "Submit a SunoAPI lyrics generation task.",
    inputSchema: inputSchema("The input payload for submitting a SunoAPI lyrics generation task.", {
      prompt: s.string("The lyrics prompt.", { minLength: 1, maxLength: 200 }),
      callBackUrl: callbackUrlSchema,
    }),
    outputSchema: taskOutputSchema,
  }),
  defineProviderAction(service, {
    name: "get_lyrics_generation_details",
    description: "Fetch SunoAPI lyrics generation task details.",
    inputSchema: taskIdInputSchema,
    outputSchema: detailsOutputSchema,
  }),
  defineProviderAction(service, {
    name: "get_timestamped_lyrics",
    description: "Fetch timestamped lyrics for one generated audio item.",
    inputSchema: taskAudioInputSchema,
    outputSchema: objectOutputSchema,
  }),
  defineProviderAction(service, {
    name: "generate_persona",
    description: "Submit a SunoAPI persona generation request.",
    inputSchema: inputSchema(
      "The input payload for submitting a SunoAPI persona generation task.",
      {
        taskId: taskIdSchema,
        audioId: audioIdSchema,
        name: s.nonEmptyString("The persona name."),
        description: s.nonEmptyString("The persona description."),
        vocalStart: s.number("The audio segment start time in seconds."),
        vocalEnd: s.number("The audio segment end time in seconds."),
        style: s.string("The persona style label."),
      },
      ["vocalStart", "vocalEnd", "style"],
    ),
    outputSchema: objectOutputSchema,
  }),
  defineProviderAction(service, {
    name: "separate_vocals_from_music",
    description: "Submit a SunoAPI vocal separation task.",
    inputSchema: inputSchema("The input payload for submitting a SunoAPI vocal removal task.", {
      taskId: taskIdSchema,
      audioId: audioIdSchema,
      type: { ...s.stringEnum("The vocal removal mode.", ["separate_vocal", "split_stem"]), default: "separate_vocal" },
      callBackUrl: callbackUrlSchema,
    }),
    outputSchema: taskOutputSchema,
  }),
  defineProviderAction(service, {
    name: "get_vocal_separation_details",
    description: "Fetch SunoAPI vocal separation task details.",
    inputSchema: taskIdInputSchema,
    outputSchema: detailsOutputSchema,
  }),
  defineProviderAction(service, {
    name: "extend_music",
    description: "Submit a SunoAPI music extension task.",
    inputSchema: inputSchema(
      "The input payload for submitting a SunoAPI music extension task.",
      {
        defaultParamFlag: s.boolean("Whether to use custom parameters."),
        audioId: audioIdSchema,
        continueAt: s.number("The extension start point in seconds."),
        ...musicPromptFields,
      },
      [
        "prompt",
        "style",
        "title",
        "continueAt",
        "personaId",
        "personaModel",
        "negativeTags",
        "vocalGender",
        "styleWeight",
        "weirdnessConstraint",
        "audioWeight",
      ],
    ),
    outputSchema: taskOutputSchema,
  }),
  defineProviderAction(service, {
    name: "upload_and_cover_audio",
    description: "Submit an uploaded audio cover generation task.",
    inputSchema: inputSchema(
      "The input payload for submitting a SunoAPI upload and cover task.",
      {
        uploadUrl: s.url("The uploaded audio URL."),
        ...musicPromptFields,
      },
      [
        "prompt",
        "style",
        "title",
        "personaId",
        "personaModel",
        "negativeTags",
        "vocalGender",
        "styleWeight",
        "weirdnessConstraint",
        "audioWeight",
      ],
    ),
    outputSchema: taskOutputSchema,
  }),
  defineProviderAction(service, {
    name: "upload_and_extend_audio",
    description: "Submit an uploaded audio extension task.",
    inputSchema: inputSchema(
      "The input payload for submitting a SunoAPI upload and extend task.",
      {
        uploadUrl: s.url("The uploaded audio URL."),
        defaultParamFlag: s.boolean("Whether to use custom parameters."),
        ...musicPromptFields,
      },
      [
        "instrumental",
        "prompt",
        "style",
        "title",
        "personaId",
        "personaModel",
        "negativeTags",
        "vocalGender",
        "styleWeight",
        "weirdnessConstraint",
        "audioWeight",
      ],
    ),
    outputSchema: taskOutputSchema,
  }),
  defineProviderAction(service, {
    name: "add_vocals",
    description: "Add vocals to uploaded audio through SunoAPI.",
    inputSchema: inputSchema(
      "The input payload for submitting a SunoAPI add vocals task.",
      {
        uploadUrl: s.url("The uploaded audio URL."),
        callBackUrl: callbackUrlSchema,
        prompt: s.nonEmptyString("The vocal prompt."),
        title: s.nonEmptyString("The music title."),
        negativeTags: s.nonEmptyString("Music styles or traits to avoid."),
        style: s.nonEmptyString("The music and vocal style."),
        vocalGender: s.stringEnum("The desired vocal gender.", ["m", "f"]),
        styleWeight: weightSchema("The style adherence weight between 0 and 1."),
        weirdnessConstraint: weightSchema("The creative weirdness constraint between 0 and 1."),
        audioWeight: weightSchema("The audio consistency weight between 0 and 1."),
        model: { ...s.stringEnum("The add vocals model.", ["V4_5PLUS", "V5", "V5_5"]), default: "V4_5PLUS" },
      },
      ["vocalGender", "styleWeight", "weirdnessConstraint", "audioWeight"],
    ),
    outputSchema: taskOutputSchema,
  }),
  defineProviderAction(service, {
    name: "add_instrumental",
    description: "Add instrumental backing to uploaded audio through SunoAPI.",
    inputSchema: inputSchema(
      "The input payload for submitting a SunoAPI add instrumental task.",
      {
        uploadUrl: s.url("The uploaded music URL."),
        title: s.nonEmptyString("The music title."),
        negativeTags: s.nonEmptyString("Music styles or traits to avoid."),
        tags: s.nonEmptyString("The music style tags."),
        callBackUrl: callbackUrlSchema,
        vocalGender: s.stringEnum("The desired vocal gender.", ["m", "f"]),
        styleWeight: weightSchema("The style adherence weight between 0 and 1."),
        weirdnessConstraint: weightSchema("The creative weirdness constraint between 0 and 1."),
        audioWeight: weightSchema("The audio consistency weight between 0 and 1."),
        model: { ...s.stringEnum("The add instrumental model.", ["V4_5PLUS", "V5", "V5_5"]), default: "V4_5PLUS" },
      },
      ["vocalGender", "styleWeight", "weirdnessConstraint", "audioWeight"],
    ),
    outputSchema: taskOutputSchema,
  }),
  defineProviderAction(service, {
    name: "boost_music_style",
    description: "Boost or expand a music style prompt.",
    inputSchema: inputSchema("The input payload for boosting a music style prompt.", {
      content: s.nonEmptyString("The style description."),
    }),
    outputSchema: objectOutputSchema,
  }),
  defineProviderAction(service, {
    name: "replace_music_section",
    description: "Replace a section of generated SunoAPI music.",
    inputSchema: inputSchema(
      "The input payload for replacing a SunoAPI music section.",
      {
        taskId: taskIdSchema,
        audioId: audioIdSchema,
        prompt: s.nonEmptyString("The replacement lyrics."),
        tags: s.nonEmptyString("The music style tags."),
        title: s.nonEmptyString("The music title."),
        infillStartS: s.number("The replacement start time in seconds."),
        infillEndS: s.number("The replacement end time in seconds."),
        negativeTags: s.string("Music styles or traits to avoid."),
        callBackUrl: callbackUrlSchema,
      },
      ["negativeTags", "callBackUrl"],
    ),
    outputSchema: taskOutputSchema,
  }),
  defineProviderAction(service, {
    name: "generate_mashup",
    description: "Submit a SunoAPI mashup task.",
    inputSchema: inputSchema(
      "The input payload for submitting a SunoAPI mashup task.",
      {
        uploadUrlList: s.array("The two audio URLs to mash up.", s.url("The audio URL."), { minItems: 2, maxItems: 2 }),
        customMode: s.boolean("Whether to use custom mode."),
        prompt: s.string("The mashup prompt."),
        style: s.string("The music style."),
        title: s.string("The music title."),
        instrumental: s.boolean("Whether the output should be instrumental."),
        model: s.stringEnum("The mashup model.", ["V4", "V4_5", "V4_5PLUS", "V4_5ALL", "V5"]),
        vocalGender: s.stringEnum("The desired vocal gender.", ["m", "f"]),
        styleWeight: weightSchema("The style guidance weight between 0 and 1."),
        weirdnessConstraint: weightSchema("The creative weirdness constraint between 0 and 1."),
        audioWeight: weightSchema("The input audio influence weight between 0 and 1."),
        callBackUrl: callbackUrlSchema,
      },
      ["prompt", "style", "title", "instrumental", "vocalGender", "styleWeight", "weirdnessConstraint", "audioWeight"],
    ),
    outputSchema: taskOutputSchema,
  }),
  defineProviderAction(service, {
    name: "generate_sounds",
    description: "Submit a SunoAPI sounds generation task.",
    inputSchema: inputSchema(
      "The input payload for submitting a SunoAPI sounds task.",
      {
        prompt: s.string("The sound prompt.", { minLength: 1, maxLength: 500 }),
        model: s.stringEnum("The sound generation model.", ["V5"]),
        soundLoop: s.boolean("Whether to enable loop playback."),
        soundTempo: s.integer("Sound tempo in BPM.", { minimum: 0 }),
        soundKey: s.string("Sound musical key."),
        grabLyrics: s.boolean("Whether to grab lyrics."),
        callBackUrl: callbackUrlSchema,
      },
      ["soundTempo", "soundKey", "grabLyrics"],
    ),
    outputSchema: taskOutputSchema,
  }),
  defineProviderAction(service, {
    name: "generate_music_cover",
    description: "Submit a SunoAPI music cover image task.",
    inputSchema: inputSchema("The input payload for submitting a SunoAPI music cover task.", {
      taskId: taskIdSchema,
      callBackUrl: callbackUrlSchema,
    }),
    outputSchema: taskOutputSchema,
  }),
  defineProviderAction(service, {
    name: "get_music_cover_details",
    description: "Fetch SunoAPI music cover task details.",
    inputSchema: taskIdInputSchema,
    outputSchema: detailsOutputSchema,
  }),
  defineProviderAction(service, {
    name: "create_music_video",
    description: "Submit a SunoAPI music video task.",
    inputSchema: inputSchema(
      "The input payload for submitting a SunoAPI music video task.",
      {
        taskId: taskIdSchema,
        audioId: audioIdSchema,
        callBackUrl: callbackUrlSchema,
        author: s.string("Video author label."),
        domainName: s.string("Video domain name."),
      },
      ["author", "domainName"],
    ),
    outputSchema: taskOutputSchema,
  }),
  defineProviderAction(service, {
    name: "get_music_video_details",
    description: "Fetch SunoAPI music video task details.",
    inputSchema: taskIdInputSchema,
    outputSchema: detailsOutputSchema,
  }),
  defineProviderAction(service, {
    name: "convert_to_wav_format",
    description: "Submit a SunoAPI WAV conversion task.",
    inputSchema: inputSchema("The input payload for submitting a SunoAPI WAV conversion task.", {
      taskId: taskIdSchema,
      audioId: audioIdSchema,
      callBackUrl: callbackUrlSchema,
    }),
    outputSchema: taskOutputSchema,
  }),
  defineProviderAction(service, {
    name: "get_wav_conversion_details",
    description: "Fetch SunoAPI WAV conversion task details.",
    inputSchema: taskIdInputSchema,
    outputSchema: detailsOutputSchema,
  }),
  defineProviderAction(service, {
    name: "generate_midi",
    description: "Submit a SunoAPI MIDI generation task.",
    inputSchema: inputSchema("The input payload for submitting a SunoAPI MIDI generation task.", {
      taskId: taskIdSchema,
      callBackUrl: callbackUrlSchema,
      audioId: audioIdSchema,
    }),
    outputSchema: taskOutputSchema,
  }),
  defineProviderAction(service, {
    name: "get_midi_generation_details",
    description: "Fetch SunoAPI MIDI generation task details.",
    inputSchema: taskIdInputSchema,
    outputSchema: detailsOutputSchema,
  }),
];
