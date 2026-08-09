import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import JSZip from 'jszip';
import type { ToolRegistry } from '../tools/registry.js';

const PRESENTATION_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const DRAWING_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CONTENT_TYPES_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';

const OFFICE_DOCUMENT_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument';
const SLIDE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function presentationXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="${PRESENTATION_NS}" xmlns:a="${DRAWING_NS}" xmlns:r="${REL_NS}">
  <p:sldIdLst></p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000" type="screen4x3"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
}

function packageRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PACKAGE_REL_NS}">
  <Relationship Id="rId1" Type="${OFFICE_DOCUMENT_REL}" Target="ppt/presentation.xml"/>
</Relationships>`;
}

function presentationRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PACKAGE_REL_NS}"></Relationships>`;
}

function contentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="${CONTENT_TYPES_NS}">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
</Types>`;
}

function slideXml(index: number, title: string, content: string): string {
  const safeTitle = escapeXml(title.replace(/\r?\n/g, ' '));
  const safeContent = escapeXml(content.replace(/\r?\n/g, ' '));

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="${PRESENTATION_NS}" xmlns:a="${DRAWING_NS}" xmlns:r="${REL_NS}">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title ${index}"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="1270000" y="685800"/>
            <a:ext cx="6858000" cy="762000"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${safeTitle}</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Content ${index}"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="1270000" y="1600200"/>
            <a:ext cx="6858000" cy="4343400"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${safeContent}</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;
}

function createEmptyPresentation(): JSZip {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypesXml());
  zip.folder('_rels')!.file('.rels', packageRelsXml());
  const ppt = zip.folder('ppt')!;
  ppt.file('presentation.xml', presentationXml());
  ppt.folder('_rels')!.file('presentation.xml.rels', presentationRelsXml());
  return zip;
}

function countSlides(zip: JSZip): number {
  return Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length;
}

async function updateXmlFile(zip: JSZip, path: string, updater: (xml: string) => string): Promise<void> {
  const file = zip.file(path);
  if (!file) throw new Error(`Missing ${path} in .pptx archive`);
  const xml = await file.async('string');
  zip.file(path, updater(xml));
}

async function addSlideToPresentation(zip: JSZip, index: number): Promise<void> {
  const slidePath = `ppt/slides/slide${index}.xml`;
  const relId = `rIdSlide${index}`;
  const slideId = 255 + index;

  zip.file(slidePath, slideXml(index, '', ''));

  await updateXmlFile(zip, 'ppt/presentation.xml', (xml) =>
    xml.replace('</p:sldIdLst>', `  <p:sldId id="${slideId}" r:id="${relId}"/>\n  </p:sldIdLst>`)
  );

  await updateXmlFile(zip, 'ppt/_rels/presentation.xml.rels', (xml) =>
    xml.replace(
      '</Relationships>',
      `  <Relationship Id="${relId}" Type="${SLIDE_REL}" Target="slides/slide${index}.xml"/>\n</Relationships>`
    )
  );

  await updateXmlFile(zip, '[Content_Types].xml', (xml) =>
    xml.replace(
      '</Types>',
      `  <Override PartName="/${slidePath}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>\n</Types>`
    )
  );
}

export interface PowerPointSlideInput {
  path: string;
  title?: string;
  content?: string;
}

export interface PowerPointCreateResult {
  path: string;
  slideCount: number;
}

export interface PowerPointAddSlideResult {
  path: string;
  slideCount: number;
}

/**
 * Minimal PowerPoint skill that builds valid .pptx files without requiring
 * external presentation libraries.
 */
export class PowerPointSkill {
  readonly name = 'allternit/powerpoint';
  readonly version = '0.1.0';
  readonly description = 'Create and edit .pptx presentations';

  register(registry: ToolRegistry): void {
    registry.registerTool(
      {
        name: 'create_presentation',
        description: 'Create a new blank .pptx presentation at the given path',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Output file path' },
            title: { type: 'string', description: 'Presentation title (stored on the title slide when one is added)' },
          },
          required: ['path'],
        },
        execute: async (args: { path: string; title?: string }): Promise<PowerPointCreateResult> => {
          const path = args.path;
          await mkdir(dirname(path), { recursive: true });
          const zip = createEmptyPresentation();
          const buffer = await zip.generateAsync({ type: 'nodebuffer' });
          await writeFile(path, buffer);
          return { path, slideCount: 0 };
        },
      }
    );

    registry.registerTool(
      {
        name: 'add_slide',
        description: 'Add a slide to an existing .pptx presentation',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to the .pptx file' },
            title: { type: 'string', description: 'Slide title' },
            content: { type: 'string', description: 'Slide body text' },
          },
          required: ['path'],
        },
        execute: async (args: PowerPointSlideInput): Promise<PowerPointAddSlideResult> => {
          const path = args.path;
          const buffer = await readFile(path);
          const zip = await JSZip.loadAsync(buffer);
          const nextIndex = countSlides(zip) + 1;

          const title = args.title ?? '';
          const content = args.content ?? '';

          zip.file(`ppt/slides/slide${nextIndex}.xml`, slideXml(nextIndex, title, content));
          await addSlideToPresentation(zip, nextIndex);

          const output = await zip.generateAsync({ type: 'nodebuffer' });
          await writeFile(path, output);

          return { path, slideCount: nextIndex };
        },
      }
    );
  }
}
