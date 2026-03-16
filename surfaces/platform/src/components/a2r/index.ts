/**
 * A2R Component Library
 * 
 * A2R-native components wrapping third-party libraries.
 * All components are themed to match the A2R design system.
 */

export { A2RDocumentEditor } from './A2RDocumentEditor';
export { A2RDataGrid } from './A2RDataGrid';
export { A2RDeckPlayer } from './A2RDeckPlayer';

// Inline cards for chat thread
export { DocumentCard } from './cards/DocumentCard';
export { DataCard } from './cards/DataCard';
export { DeckCard } from './cards/DeckCard';

// Import themes
import './a2r-document-theme.css';
import './a2r-data-theme.css';
import './a2r-deck-theme.css';
