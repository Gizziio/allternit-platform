import { BONSAI_MODEL_REPOSITORY, BONSAI_MODEL_REVISION } from "./model-spec";

const TOKENIZER_PATH = "text_encoder-mlx-4bit/tokenizer.json";
const TOKENIZER_SHA256 = "aeb13307a71acd8fe81861d94ad54ab689df773318809eed3cbe794b4492dae4";
const PAD_TOKEN = 151_643;
const SPLIT_PATTERN = /(?:'s|'t|'re|'ve|'m|'ll|'d)|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+/giu;

interface TokenizerJson {
  added_tokens: Array<{ id: number; content: string }>;
  model: { vocab: Record<string, number>; merges: Array<[string, string]> };
}

export interface TokenizedPrompt {
  ids: Uint32Array;
  validTokens: number;
}

export class QwenBpeTokenizer {
  private readonly ranks = new Map<string, number>();
  private readonly specials = new Map<string, number>();
  private readonly cache = new Map<string, number[]>();
  private readonly byteCharacters = byteToUnicode();
  private readonly reverseVocab = new Map<number, string>();
  private readonly specialById = new Map<number, string>();

  constructor(private readonly vocab: Record<string, number>, merges: Array<[string, string]>,
    addedTokens: Array<{ id: number; content: string }>) {
    merges.forEach((pair, rank) => this.ranks.set(pairKey(pair[0], pair[1]), rank));
    addedTokens.forEach(token => { this.specials.set(token.content, token.id); this.specialById.set(token.id, token.content); });
    for (const [piece, id] of Object.entries(vocab)) this.reverseVocab.set(id, piece);
  }

  static async fromPretrained(fetchImpl: typeof fetch = fetch): Promise<QwenBpeTokenizer> {
    const url = `https://huggingface.co/${BONSAI_MODEL_REPOSITORY}/resolve/${BONSAI_MODEL_REVISION}/${TOKENIZER_PATH}`;
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`Tokenizer download failed with HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map(value => value.toString(16).padStart(2, "0")).join("");
    if (hash !== TOKENIZER_SHA256) throw new Error(`Tokenizer checksum mismatch: ${hash}`);
    const json = JSON.parse(new TextDecoder().decode(bytes)) as TokenizerJson;
    return new QwenBpeTokenizer(json.model.vocab, json.model.merges, json.added_tokens);
  }

  tokenizePrompt(prompt: string, maxLength = 512, bucketed = true): TokenizedPrompt {
    const formatted = `<|im_start|>user\n${prompt}<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n`;
    const tokens = this.encode(formatted);
    const sequence = bucketed ? pickBucket(tokens.length, maxLength) : maxLength;
    const validTokens = Math.min(tokens.length, sequence);
    const ids = new Uint32Array(sequence).fill(PAD_TOKEN);
    ids.set(tokens.slice(0, sequence));
    return { ids, validTokens };
  }

  encode(text: string): number[] {
    const specialPattern = new RegExp([...this.specials.keys()].sort((a, b) => b.length - a.length)
      .map(escapeRegex).join("|"), "g");
    const output: number[] = [];
    let offset = 0;
    for (const match of text.matchAll(specialPattern)) {
      const index = match.index ?? 0;
      output.push(...this.encodeOrdinary(text.slice(offset, index)));
      output.push(this.specials.get(match[0])!);
      offset = index + match[0].length;
    }
    output.push(...this.encodeOrdinary(text.slice(offset)));
    return output;
  }

  decode(ids: number[] | Uint32Array): string {
    const reverseUnicode = unicodeToByte(this.byteCharacters);
    let output = "";
    for (const id of ids) {
      const special = this.specialById.get(id);
      if (special !== undefined) { output += special; continue; }
      const piece = this.reverseVocab.get(id);
      if (piece === undefined) { output += "\uFFFD"; continue; }
      let bytes = "";
      for (const char of piece) {
        const byte = reverseUnicode[char.codePointAt(0)!];
        if (byte !== undefined) bytes += String.fromCharCode(byte);
      }
      output += bytes;
    }
    try { return new TextDecoder("utf-8", { fatal: false }).decode(new TextEncoder().encode(output)); }
    catch { return output; }
  }

  decodeStreaming(ids: number[] | Uint32Array, previousLength: number): string {
    const full = this.decode(ids);
    if (previousLength <= 0) return full;
    const previous = this.decode(Array.isArray(ids) ? ids.slice(0, previousLength) : ids.slice(0, previousLength));
    return full.slice(previous.length);
  }

  vocabularySize(): number { return this.reverseVocab.size + this.specials.size; }

  private encodeOrdinary(text: string): number[] {
    const normalized = text.normalize("NFC");
    const output: number[] = [];
    for (const match of normalized.matchAll(SPLIT_PATTERN)) {
      const bytes = new TextEncoder().encode(match[0]);
      let piece = "";
      for (const byte of bytes) piece += this.byteCharacters[byte];
      const cached = this.cache.get(piece);
      if (cached) { output.push(...cached); continue; }
      const symbols = Array.from(piece);
      while (symbols.length > 1) {
        let bestRank = Number.POSITIVE_INFINITY;
        let bestPair: [string, string] | undefined;
        for (let index = 0; index < symbols.length - 1; index += 1) {
          const rank = this.ranks.get(pairKey(symbols[index], symbols[index + 1]));
          if (rank !== undefined && rank < bestRank) { bestRank = rank; bestPair = [symbols[index], symbols[index + 1]]; }
        }
        if (!bestPair) break;
        const merged: string[] = [];
        for (let index = 0; index < symbols.length;) {
          if (index < symbols.length - 1 && symbols[index] === bestPair[0] && symbols[index + 1] === bestPair[1]) {
            merged.push(bestPair[0] + bestPair[1]); index += 2;
          } else { merged.push(symbols[index]); index += 1; }
        }
        symbols.splice(0, symbols.length, ...merged);
      }
      const ids = symbols.map(symbol => {
        const id = this.vocab[symbol];
        if (id === undefined) throw new Error(`Tokenizer vocabulary is missing byte piece ${JSON.stringify(symbol)}`);
        return id;
      });
      this.cache.set(piece, ids);
      output.push(...ids);
    }
    return output;
  }
}

function byteToUnicode(): string[] {
  const bytes = [...range(33, 126), ...range(161, 172), ...range(174, 255)];
  const characters = [...bytes];
  let extra = 0;
  for (let byte = 0; byte < 256; byte += 1) if (!bytes.includes(byte)) { bytes.push(byte); characters.push(256 + extra++); }
  const mapping: string[] = [];
  bytes.forEach((byte, index) => { mapping[byte] = String.fromCodePoint(characters[index]); });
  return mapping;
}
function range(start: number, end: number): number[] { return Array.from({ length: end - start + 1 }, (_, index) => start + index); }
function pairKey(left: string, right: string): string { return `${left}\u0000${right}`; }
function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function unicodeToByte(mapping: string[]): Record<number, number> {
  const reverse: Record<number, number> = {};
  for (let byte = 0; byte < 256; byte += 1) {
    const unicode = mapping[byte];
    if (unicode !== undefined) reverse[unicode.codePointAt(0)!] = byte;
  }
  return reverse;
}

function pickBucket(length: number, cap: number): number {
  for (const bucket of [32, 64, 128, 256, 512]) if (bucket <= cap && bucket >= length) return bucket;
  return cap;
}

