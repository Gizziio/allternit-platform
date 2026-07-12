/**
 * Bundled Allternit Design plugins that ship inside Allternit.
 */

import { parsePluginManifest, type PluginManifest } from './plugin-manifest';

import reactExport from '../../../plugins/scenarios/od-react-export/open-design.json';
import editorialCover from '../../../plugins/image-templates/editorial-cover/open-design.json';
import heroCard from '../../../plugins/atoms/hero-card/open-design.json';
import docsPage from '../../../plugins/examples/docs-page/open-design.json';
import blogPost from '../../../plugins/examples/blog-post/open-design.json';
import dataReport from '../../../plugins/examples/data-report/open-design.json';
import cartesianDeck from '../../../plugins/examples/html-ppt-zhangzara-cartesian/open-design.json';

const RAW_PLUGINS: { id: string; raw: unknown }[] = [
  { id: 'od-react-export', raw: reactExport },
  { id: 'editorial-cover', raw: editorialCover },
  { id: 'hero-card', raw: heroCard },
  { id: 'docs-page', raw: docsPage },
  { id: 'blog-post', raw: blogPost },
  { id: 'data-report', raw: dataReport },
  { id: 'html-ppt-zhangzara-cartesian', raw: cartesianDeck },
];

export const BUNDLED_PLUGINS: PluginManifest[] = RAW_PLUGINS.map((p) =>
  parsePluginManifest(p.id, JSON.stringify(p.raw)),
);

export function getBundledPluginById(id: string): PluginManifest | undefined {
  return BUNDLED_PLUGINS.find((p) => p.id === id);
}

export function getBundledPluginsByCategory(category: string): PluginManifest[] {
  return BUNDLED_PLUGINS.filter((p) => p.category === category);
}
