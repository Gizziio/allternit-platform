/**
 * Clipboard utilities for Agentation
 */

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

/**
 * Copy JSON to clipboard (formatted)
 */
export async function copyJSON(data: unknown): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  await copyToClipboard(json);
}
