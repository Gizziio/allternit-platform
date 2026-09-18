/**
 * Shared AvatarConfig build + hydrate for create-bot and edit-bot.
 * Keep pack matching here so both surfaces agree on what a sprite looks like
 * when saved and when reopened.
 */

import type { AvatarConfig, MascotTemplate } from "@/lib/agents/agent.types";
import type { GizziEmotion } from "@/components/ai-elements/GizziMascot";
import {
  createDefaultAvatarPickerConfig,
  type AvatarPickerConfig,
} from "@/views/agent-view/components/AgentAvatarPicker";
import { AVATAR_PACKS } from "./avatar-packs";
import type { AvatarMode, PackSelection } from "./steps/AvatarEditor";
import { GIZZI_EMOTIONS } from "./steps/AvatarEditor";

export interface AvatarEditorValues {
  avatarMode: AvatarMode;
  avatarPicker: AvatarPickerConfig;
  mascotTemplate: MascotTemplate;
  gizziColor: string;
  gizziEmotion: GizziEmotion;
  imageDataUrl: string | null;
  petUrl: string;
  packSelection: PackSelection;
}

const DEFAULT_ACCENT = "#B08D6E";

export function defaultPackSelection(): PackSelection {
  const firstPack = AVATAR_PACKS[0];
  return { packId: firstPack.id, spriteId: firstPack.sprites[0].id };
}

export function defaultAvatarEditorValues(accent: string = DEFAULT_ACCENT): AvatarEditorValues {
  return {
    avatarMode: "gizzi",
    avatarPicker: createDefaultAvatarPickerConfig(""),
    mascotTemplate: "gizzi",
    gizziColor: accent,
    gizziEmotion: "pleased",
    imageDataUrl: null,
    petUrl: "",
    packSelection: defaultPackSelection(),
  };
}

export function matchPackSelection(avatar: AvatarConfig): PackSelection | null {
  const sheet = avatar.pet?.spriteUrl;
  const portrait = avatar.uri;
  for (const pack of AVATAR_PACKS) {
    for (const sprite of pack.sprites) {
      if (sheet && sprite.sheetUrl === sheet) {
        return { packId: pack.id, spriteId: sprite.id };
      }
      if (portrait && sprite.portraitUrl === portrait) {
        return { packId: pack.id, spriteId: sprite.id };
      }
    }
  }
  return null;
}

export function hydrateAvatarEditorFromConfig(
  avatar?: AvatarConfig | null,
  accent: string = DEFAULT_ACCENT,
): AvatarEditorValues {
  const defaults = defaultAvatarEditorValues(accent);
  if (!avatar) return defaults;

  const pack = matchPackSelection(avatar);
  if (pack) {
    return { ...defaults, avatarMode: "packs", packSelection: pack };
  }

  if (avatar.mascotTemplate === "pet" || avatar.pet?.spriteUrl) {
    return { ...defaults, avatarMode: "pet", petUrl: avatar.pet?.spriteUrl || "" };
  }

  if (avatar.type === "image" && avatar.uri) {
    return { ...defaults, avatarMode: "image", imageDataUrl: avatar.uri };
  }

  if (avatar.type === "color") {
    return {
      ...defaults,
      avatarMode: "initials",
      avatarPicker: {
        ...createDefaultAvatarPickerConfig(""),
        bgColor: avatar.colors?.primary || accent,
        textColor: avatar.colors?.secondary || "#ffffff",
      },
    };
  }

  if (avatar.mascotTemplate && avatar.mascotTemplate !== "gizzi") {
    return {
      ...defaults,
      avatarMode: "mascot",
      mascotTemplate: avatar.mascotTemplate as MascotTemplate,
      gizziColor: avatar.colors?.primary || accent,
    };
  }

  const emotion = avatar.currentEmotion;
  return {
    ...defaults,
    avatarMode: "gizzi",
    gizziColor: avatar.colors?.primary || accent,
    gizziEmotion: GIZZI_EMOTIONS.includes(emotion as GizziEmotion)
      ? (emotion as GizziEmotion)
      : "pleased",
  };
}

export function buildAvatarConfigFromEditor(
  state: AvatarEditorValues,
  accent: string,
): AvatarConfig {
  switch (state.avatarMode) {
    case "initials":
      return {
        type: "color",
        colors: {
          primary: state.avatarPicker.bgColor,
          secondary: state.avatarPicker.textColor,
          glow: state.avatarPicker.bgColor,
        },
        style: { primaryColor: state.avatarPicker.bgColor, accentColor: state.avatarPicker.textColor },
      } as AvatarConfig;
    case "image":
      return {
        type: "image",
        uri: state.imageDataUrl || undefined,
        colors: { primary: accent, secondary: "#ffffff", glow: accent },
      } as AvatarConfig;
    case "packs": {
      const pack = AVATAR_PACKS.find((p) => p.id === state.packSelection.packId);
      const sprite = pack?.sprites.find((s) => s.id === state.packSelection.spriteId);
      if (pack && sprite?.sheetUrl) {
        return {
          type: "mascot",
          mascotTemplate: "pet",
          colors: { primary: accent, secondary: "#ffffff", glow: accent },
          pet: {
            spriteUrl: sprite.sheetUrl,
            frameWidth: 192,
            frameHeight: 208,
            columns: 8,
            rows: 9,
          },
        } as AvatarConfig;
      }
      return {
        type: "image",
        uri: sprite?.portraitUrl,
        colors: { primary: accent, secondary: "#ffffff", glow: accent },
      } as AvatarConfig;
    }
    case "pet":
      return {
        type: "mascot",
        mascotTemplate: "pet",
        colors: { primary: accent, secondary: "#ffffff", glow: accent },
        pet: state.petUrl
          ? {
              spriteUrl: state.petUrl,
              frameWidth: 192,
              frameHeight: 208,
              columns: 8,
              rows: 9,
            }
          : undefined,
      } as AvatarConfig;
    case "mascot":
      return {
        type: "mascot",
        mascotTemplate: state.mascotTemplate,
        colors: { primary: accent, secondary: "#ffffff", glow: accent },
      } as AvatarConfig;
    case "gizzi":
    default:
      return {
        type: "mascot",
        mascotTemplate: "gizzi",
        colors: { primary: state.gizziColor, secondary: "#ffffff", glow: state.gizziColor },
        currentEmotion: state.gizziEmotion,
      } as AvatarConfig;
  }
}
