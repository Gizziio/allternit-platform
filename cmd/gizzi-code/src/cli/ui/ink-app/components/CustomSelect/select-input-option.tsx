import React, { type ReactNode, useEffect, useRef, useState } from 'react';
// eslint-disable-next-line custom-rules/prefer-use-keybindings -- UP arrow exit not in Attachments bindings
import { Box, Text, useInput } from '../../ink';
import { useKeybinding, useKeybindings } from '../../keybindings/useKeybinding';
import type { PastedContent } from '../../utils/config';
import { getImageFromClipboard } from '../../utils/imagePaste';
import type { ImageDimensions } from '../../utils/imageResizer';
import { ClickableImageRef } from '../ClickableImageRef';
import { ConfigurableShortcutHint } from '../ConfigurableShortcutHint';
import { Byline } from '../design-system/Byline';
import TextInput from '../TextInput';
import type { OptionWithDescription } from './select';
import { SelectOption } from './select-option';
type Props<T> = {
  option: Extract<OptionWithDescription<T>, {
    type: 'input';
  }>;
  isFocused: boolean;
  isSelected: boolean;
  shouldShowDownArrow: boolean;
  shouldShowUpArrow: boolean;
  maxIndexWidth: number;
  index: number;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onExit?: () => void;
  layout: 'compact' | 'expanded';
  children?: ReactNode;
  /**
   * When true, shows the label before the input field.
   * When false (default), uses the label as the placeholder.
   */
  showLabel?: boolean;
  /**
   * Callback to open external editor for editing the input value.
   * When provided, ctrl+g will trigger this callback with the current value
   * and a setter function to update the internal state.
   */
  onOpenEditor?: (currentValue: string, setValue: (value: string) => void) => void;
  /**
   * When true, automatically reset cursor to end of line when:
   * - Option becomes focused
   * - Input value changes
   * This prevents cursor position bugs when the input value updates asynchronously.
   */
  resetCursorOnUpdate?: boolean;
  /**
   * Optional callback when an image is pasted into the input.
   */
  onImagePaste?: (base64Image: string, mediaType?: string, filename?: string, dimensions?: ImageDimensions, sourcePath?: string) => void;
  /**
   * Pasted content to display inline above the input when focused.
   */
  pastedContents?: Record<number, PastedContent>;
  /**
   * Callback to remove a pasted image by its ID.
   */
  onRemoveImage?: (id: number) => void;
  /**
   * Whether image selection mode is active.
   */
  imagesSelected?: boolean;
  /**
   * Currently selected image index within the image attachments array.
   */
  selectedImageIndex?: number;
  /**
   * Callback to set image selection mode on/off.
   */
  onImagesSelectedChange?: (selected: boolean) => void;
  /**
   * Callback to change the selected image index.
   */
  onSelectedImageIndexChange?: (index: number) => void;
};
export function SelectInputOption<T>({
    option,
    isFocused,
    isSelected,
    shouldShowDownArrow,
    shouldShowUpArrow,
    maxIndexWidth,
    index,
    inputValue,
    onInputChange,
    onSubmit,
    onExit,
    layout,
    children,
    showLabel: t1,
    onOpenEditor,
    resetCursorOnUpdate: t2,
    onImagePaste,
    pastedContents,
    onRemoveImage,
    imagesSelected,
    selectedImageIndex: t3,
    onImagesSelectedChange,
    onSelectedImageIndexChange
}: Props<T>) {
  const showLabelProp = t1 === undefined ? false : t1;
  const resetCursorOnUpdate = t2 === undefined ? false : t2;
  const selectedImageIndex = t3 === undefined ? 0 : t3;
  const t4 = pastedContents ? Object.values(pastedContents).filter(_temp) : [];

  const imageAttachments = t4;
  const showLabel = showLabelProp || option.showLabelWithValue === true;
  const [cursorOffset, setCursorOffset] = useState(inputValue.length);
  const isUserEditing = useRef(false);
  const t5 = () => {
      if (resetCursorOnUpdate && isFocused) {
        if (isUserEditing.current) {
          isUserEditing.current = false;
        } else {
          setCursorOffset(inputValue.length);
        }
      }
    };

  const t6 = [resetCursorOnUpdate, isFocused, inputValue];

  useEffect(t5, t6);
  const t7 = () => {
      onOpenEditor?.(inputValue, onInputChange);
    };

  const t8 = isFocused && !!onOpenEditor;
  const t9 = {
      context: "Chat",
      isActive: t8
    };

  useKeybinding("chat:externalEditor", t7, t9);
  const t10 = () => {
      if (!onImagePaste) {
        return;
      }
      getImageFromClipboard().then(imageData => {
        if (imageData) {
          onImagePaste(imageData.base64, imageData.mediaType, undefined, imageData.dimensions);
        }
      });
    };

  const t11 = isFocused && !!onImagePaste;
  const t12 = {
      context: "Chat",
      isActive: t11
    };

  useKeybinding("chat:imagePaste", t10, t12);
  const t13 = () => {
      if (imageAttachments.length > 0 && onRemoveImage) {
        onRemoveImage(imageAttachments.at(-1).id);
      }
    };

  const t14 = isFocused && !imagesSelected && inputValue === "" && imageAttachments.length > 0 && !!onRemoveImage;
  const t15 = {
      context: "Attachments",
      isActive: t14
    };

  useKeybinding("attachments:remove", t13, t15);
  const t16 = () => {
      if (imageAttachments.length > 1) {
        onSelectedImageIndexChange?.((selectedImageIndex + 1) % imageAttachments.length);
      }
    };
  const t17 = () => {
      if (imageAttachments.length > 1) {
        onSelectedImageIndexChange?.((selectedImageIndex - 1 + imageAttachments.length) % imageAttachments.length);
      }
    };

  const t18 = () => {
      const img = imageAttachments[selectedImageIndex];
      if (img && onRemoveImage) {
        onRemoveImage(img.id);
        if (imageAttachments.length <= 1) {
          onImagesSelectedChange?.(false);
        } else {
          onSelectedImageIndexChange?.(Math.min(selectedImageIndex, imageAttachments.length - 2));
        }
      }
    };

  const t19 = () => {
      onImagesSelectedChange?.(false);
    };

  const t20 = {
      "attachments:next": t16,
      "attachments:previous": t17,
      "attachments:remove": t18,
      "attachments:exit": t19
    };

  const t21 = isFocused && !!imagesSelected;
  const t22 = {
      context: "Attachments",
      isActive: t21
    };

  useKeybindings(t20, t22);
  const t23 = (_input, key) => {
      if (key.upArrow) {
        onImagesSelectedChange?.(false);
      }
    };

  const t24 = isFocused && !!imagesSelected;
  const t25 = {
      isActive: t24
    };

  useInput(t23, t25);
  const t26 = () => {
      if (!isFocused && imagesSelected) {
        onImagesSelectedChange?.(false);
      }
    };
  const t27 = [isFocused, imagesSelected, onImagesSelectedChange];

  useEffect(t26, t27);
  const descriptionPaddingLeft = layout === "expanded" ? maxIndexWidth + 3 : maxIndexWidth + 4;
  const t28 = layout === "compact" ? 0 : undefined;
  const t29 = `${index}.`;
  const t30 = t29.padEnd(maxIndexWidth + 2);

  const t31 = <Text dimColor={true}>{t30}</Text>;

  const t32 = showLabel ? <><Text color={isFocused ? "suggestion" : undefined}>{option.label}</Text>{isFocused ? <><Text color="suggestion">{option.labelValueSeparator ?? ", "}</Text><TextInput value={inputValue} onChange={value => {
          isUserEditing.current = true;
          onInputChange(value);
          option.onChange(value);
        }} onSubmit={onSubmit} onExit={onExit} placeholder={option.placeholder} focus={!imagesSelected} showCursor={true} multiline={true} cursorOffset={cursorOffset} onChangeCursorOffset={setCursorOffset} columns={80} onImagePaste={onImagePaste} onPaste={pastedText => {
          isUserEditing.current = true;
          const before = inputValue.slice(0, cursorOffset);
          const after = inputValue.slice(cursorOffset);
          const newValue = before + pastedText + after;
          onInputChange(newValue);
          option.onChange(newValue);
          setCursorOffset(before.length + pastedText.length);
        }} /></> : inputValue && <Text>{option.labelValueSeparator ?? ", "}{inputValue}</Text>}</> : isFocused ? <TextInput value={inputValue} onChange={value_0 => {
      isUserEditing.current = true;
      onInputChange(value_0);
      option.onChange(value_0);
    }} onSubmit={onSubmit} onExit={onExit} placeholder={option.placeholder || (typeof option.label === "string" ? option.label : undefined)} focus={!imagesSelected} showCursor={true} multiline={true} cursorOffset={cursorOffset} onChangeCursorOffset={setCursorOffset} columns={80} onImagePaste={onImagePaste} onPaste={pastedText_0 => {
      isUserEditing.current = true;
      const before_0 = inputValue.slice(0, cursorOffset);
      const after_0 = inputValue.slice(cursorOffset);
      const newValue_0 = before_0 + pastedText_0 + after_0;
      onInputChange(newValue_0);
      option.onChange(newValue_0);
      setCursorOffset(before_0.length + pastedText_0.length);
    }} /> : <Text color={inputValue ? undefined : "inactive"}>{inputValue || option.placeholder || option.label}</Text>;

  const t33 = <Box flexDirection="row" flexShrink={t28}>{t31}{children}{t32}</Box>;

  const t34 = <SelectOption isFocused={isFocused} isSelected={isSelected} shouldShowDownArrow={shouldShowDownArrow} shouldShowUpArrow={shouldShowUpArrow} declareCursor={false}>{t33}</SelectOption>;

  const t35 = option.description && <Box paddingLeft={descriptionPaddingLeft}><Text dimColor={option.dimDescription !== false} color={isSelected ? "success" : isFocused ? "suggestion" : undefined}>{option.description}</Text></Box>;

  const t36 = imageAttachments.length > 0 && <Box flexDirection="row" gap={1} paddingLeft={descriptionPaddingLeft}>{imageAttachments.map((img_0, idx) => <ClickableImageRef key={img_0.id} imageId={img_0.id} isSelected={!!imagesSelected && idx === selectedImageIndex} />)}<Box flexGrow={1} justifyContent="flex-start" flexDirection="row"><Text dimColor={true}>{imagesSelected ? <Byline>{imageAttachments.length > 1 && <><ConfigurableShortcutHint action="attachments:next" context="Attachments" fallback={"\u2192"} description="next" /><ConfigurableShortcutHint action="attachments:previous" context="Attachments" fallback={"\u2190"} description="prev" /></>}<ConfigurableShortcutHint action="attachments:remove" context="Attachments" fallback="backspace" description="remove" /><ConfigurableShortcutHint action="attachments:exit" context="Attachments" fallback="esc" description="cancel" /></Byline> : isFocused ? "(\u2193 to select)" : null}</Text></Box></Box>;

  const t37 = layout === "expanded" && <Text> </Text>;

  const t38 = <Box flexDirection="column" flexShrink={0}>{t34}{t35}{t36}{t37}</Box>;

  return t38;
}
function _temp(c) {
  return c.type === "image";
}
