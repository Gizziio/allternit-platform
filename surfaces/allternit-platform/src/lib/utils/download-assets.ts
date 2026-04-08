import type { FilePart, ImagePart } from "ai";

// CoreMessage type matching AI SDK v3
interface CoreMessage {
  role: "user" | "assistant" | "system";
  content: string | Array<{ type: string; [key: string]: unknown }>;
}

/**
 * Downloads file URLs and replaces them with binary data for LLM consumption.
 * This allows files to be sent to models that support binary input.
 */
export async function replaceFilePartUrlByBinaryDataInMessages(
  messages: CoreMessage[]
): Promise<CoreMessage[]> {
  return Promise.all(
    messages.map(async (message) => {
      if (typeof message.content === "string") {
        return message;
      }

      const updatedContent = await Promise.all(
        message.content.map(async (part: { type: string; [key: string]: unknown }) => {
          // Handle file parts with URLs
          if (part.type === "file" && "data" in part && isUrl(part.data)) {
            const dataValue = part.data;
            if (typeof dataValue !== 'string') {
              throw new Error('Expected string data for file part');
            }
            const binaryData = await fetchBinaryData(dataValue);
            if (binaryData) {
              return {
                ...part,
                data: binaryData,
              } as FilePart;
            }
          }

          // Handle image parts with URLs
          if (part.type === "image" && "image" in part && isUrl(part.image)) {
            const imageValue = part.image;
            if (typeof imageValue !== 'string') {
              throw new Error('Expected string data for image part');
            }
            const binaryData = await fetchBinaryData(imageValue);
            if (binaryData) {
              return {
                ...part,
                image: binaryData,
              } as ImagePart;
            }
          }

          return part;
        })
      );

      return {
        ...message,
        content: updatedContent,
      } as CoreMessage;
    })
  );
}

/**
 * Check if a value is a URL string
 */
function isUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return value.startsWith("http://") || value.startsWith("https://");
}

/**
 * Fetch binary data from a URL
 */
async function fetchBinaryData(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch ${url}: ${response.statusText}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.warn(`Error fetching ${url}:`, error);
    return null;
  }
}
