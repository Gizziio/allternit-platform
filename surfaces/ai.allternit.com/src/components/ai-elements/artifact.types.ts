"use client";

import React from 'react';
import {
  FileText,
  Code,
  Globe,
  GitBranch,
  Image as ImageIcon,
} from '@phosphor-icons/react';

export type ArtifactKind =
  | "document"
  | "code"
  | "image"
  | "svg"
  | "html"
  | "jsx"
  | "mermaid"
  | "sheet"
  | "openui";

export interface SelectedArtifact {
  title: string;
  kind: ArtifactKind;
  content?: string;
  url?: string;
  /** Optional: language hint for code kind */
  language?: string;
}

export const KIND_META: Record<
  ArtifactKind,
  { label: string; icon: React.ReactNode; accent: string }
> = {
  document: {
    label: "Document",
    icon: React.createElement(FileText, { size: 15 }),
    accent: "rgba(212,176,140,0.7)",
  },
  code: {
    label: "Code",
    icon: React.createElement(Code, { size: 15 }),
    accent: "rgba(97,175,239,0.7)",
  },
  image: {
    label: "Image",
    icon: React.createElement(ImageIcon, { size: 15 }),
    accent: "rgba(74,222,128,0.7)",
  },
  svg: {
    label: "SVG",
    icon: React.createElement(GitBranch, { size: 15 }),
    accent: "rgba(192,132,252,0.7)",
  },
  html: {
    label: "HTML",
    icon: React.createElement(Globe, { size: 15 }),
    accent: "rgba(248,165,113,0.7)",
  },
  jsx: {
    label: "React",
    icon: React.createElement(Code, { size: 15 }),
    accent: "rgba(97,218,251,0.7)",
  },
  mermaid: {
    label: "Diagram",
    icon: React.createElement(GitBranch, { size: 15 }),
    accent: "rgba(192,132,252,0.7)",
  },
  sheet: {
    label: "Spreadsheet",
    icon: React.createElement(FileText, { size: 15 }),
    accent: "rgba(74,222,128,0.7)",
  },
  openui: {
    label: "Interactive UI",
    icon: React.createElement(GitBranch, { size: 15 }),
    accent: "rgba(212,176,140,0.7)",
  },
};
