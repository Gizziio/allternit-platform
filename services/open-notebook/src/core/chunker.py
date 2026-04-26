import re
from typing import List


class TextChunk:
    def __init__(self, text: str, index: int, source_id: str, notebook_id: str = "", metadata: dict = None):
        self.text = text
        self.index = index
        self.source_id = source_id
        self.notebook_id = notebook_id
        self.metadata = metadata or {}


def chunk_text(text: str, source_id: str, notebook_id: str = "", chunk_size: int = 500, overlap: int = 50) -> List[TextChunk]:
    """Simple sentence-aware chunking."""
    # Clean text
    text = re.sub(r'\s+', ' ', text).strip()
    
    # Split into sentences (simple heuristic)
    sentences = re.split(r'(?<=[.!?])\s+', text)
    
    chunks = []
    current_chunk = []
    current_length = 0
    chunk_index = 0
    
    for sentence in sentences:
        sentence_length = len(sentence)
        
        if current_length + sentence_length > chunk_size and current_chunk:
            # Save current chunk
            chunk_text_str = ' '.join(current_chunk)
            chunks.append(TextChunk(
                text=chunk_text_str,
                index=chunk_index,
                source_id=source_id,
                notebook_id=notebook_id,
                metadata={"length": len(chunk_text_str)}
            ))
            chunk_index += 1
            
            # Start new chunk with overlap
            overlap_sentences = []
            overlap_length = 0
            for s in reversed(current_chunk):
                if overlap_length + len(s) <= overlap:
                    overlap_sentences.insert(0, s)
                    overlap_length += len(s) + 1
                else:
                    break
            current_chunk = overlap_sentences + [sentence]
            current_length = overlap_length + sentence_length
        else:
            current_chunk.append(sentence)
            current_length += sentence_length + 1
    
    # Don't forget the last chunk
    if current_chunk:
        chunk_text_str = ' '.join(current_chunk)
        chunks.append(TextChunk(
            text=chunk_text_str,
            index=chunk_index,
            source_id=source_id,
            notebook_id=notebook_id,
            metadata={"length": len(chunk_text_str)}
        ))
    
    return chunks
