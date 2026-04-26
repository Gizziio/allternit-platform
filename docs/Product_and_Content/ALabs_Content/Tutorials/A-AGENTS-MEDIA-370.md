# A://AGENTS-MEDIA-370 — Build a Content Repurposing Pipeline

**Outcome:** Automated system converting longform content into summaries, posts, scripts  
**Artifact:** Working repurposing pipeline with multi-format output  
**Prerequisites:** A://OPS-CONTENT-203, API integration  
**Time:** 5-7 hours  
**Difficulty:** Intermediate

---

## Problem

Content creation is inefficient:
- One piece of content, one use
- Manual reformatting for each channel
- Inconsistent messaging
- Missed distribution opportunities

---

## What You're Building

A repurposing pipeline that:
1. Ingests longform content (video, blog, podcast)
2. Extracts key points
3. Generates multiple formats
4. Optimizes for each channel
5. Outputs ready-to-publish assets

**System Flow:**
```
Content → Transcribe/Extract → Analyze → Generate Formats → Optimize → Export
```

---

## Stack

| Component | Recommendation | Alternative |
|-----------|---------------|-------------|
| Transcription | Deepgram | Whisper API |
| Analysis | GPT-4 | Claude 3 |
| Image Gen | DALL-E 3 | Midjourney API |
| Storage | S3/Cloudflare R2 | GCP Storage |
| Backend | Python/FastAPI | Node.js |

---

## Implementation

### Step 1: Content Ingestion

```python
from typing import Dict, List
import requests

class ContentIngester:
    def ingest_url(self, url: str) -> Dict:
        """Ingest content from URL."""
        # Determine content type
        if "youtube.com" in url or "youtu.be" in url:
            return self._ingest_youtube(url)
        elif url.endswith(".mp3") or url.endswith(".mp4"):
            return self._ingest_media(url)
        else:
            return self._ingest_webpage(url)
    
    def _ingest_youtube(self, url: str) -> Dict:
        """Extract YouTube transcript and metadata."""
        # Use youtube-transcript-api or similar
        from youtube_transcript_api import YouTubeTranscriptApi
        
        video_id = self._extract_youtube_id(url)
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        
        full_text = " ".join([entry["text"] for entry in transcript])
        
        return {
            "source_type": "youtube",
            "source_url": url,
            "content": full_text,
            "metadata": {
                "video_id": video_id,
                "duration": sum(entry.get("duration", 0) for entry in transcript)
            }
        }
    
    def _ingest_media(self, url: str) -> Dict:
        """Transcribe audio/video file."""
        # Use Deepgram or Whisper
        import deepgram
        
        dg_client = deepgram.Deepgram(os.getenv("DEEPGRAM_API_KEY"))
        
        source = {'url': url}
        response = dg_client.transcription.sync_prerecorded(
            source,
            {'punctuate': True, 'paragraphs': True}
        )
        
        transcript = response["results"]["channels"][0]["alternatives"][0]["transcript"]
        
        return {
            "source_type": "media",
            "source_url": url,
            "content": transcript,
            "metadata": {
                "confidence": response["results"]["channels"][0]["alternatives"][0]["confidence"]
            }
        }
    
    def _ingest_webpage(self, url: str) -> Dict:
        """Extract article content."""
        import requests
        from readability import Document
        from bs4 import BeautifulSoup
        
        response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
        doc = Document(response.text)
        
        soup = BeautifulSoup(doc.summary(), 'html.parser')
        text = soup.get_text(separator='\n', strip=True)
        
        return {
            "source_type": "webpage",
            "source_url": url,
            "title": doc.title(),
            "content": text,
            "metadata": {}
        }
    
    def _extract_youtube_id(self, url: str) -> str:
        """Extract YouTube video ID."""
        from urllib.parse import urlparse, parse_qs
        
        parsed = urlparse(url)
        if parsed.hostname == 'youtu.be':
            return parsed.path[1:]
        if parsed.hostname in ('www.youtube.com', 'youtube.com'):
            return parse_qs(parsed.query).get('v', [None])[0]
        return None
```

### Step 2: Content Analysis

```python
import openai
from typing import List, Dict

class ContentAnalyzer:
    def __init__(self):
        openai.api_key = os.getenv("OPENAI_API_KEY")
    
    def analyze(self, content: str) -> Dict:
        """Extract key points and themes."""
        
        prompt = f"""Analyze the following content and extract key elements for repurposing.

Content:
{content[:8000]}

Extract JSON:
{{
    "title": "Content title",
    "summary": "One paragraph summary",
    "key_points": [
        {{
            "point": "key insight",
            "timestamp": "approximate timestamp if video/audio",
            "quote": "memorable quote"
        }}
    ],
    "themes": ["theme 1", "theme 2"],
    "audience": "target audience",
    "tone": "tone of content",
    "actionable_takeaways": ["takeaway 1", "takeaway 2"],
    "hooks": ["attention-grabbing hook 1", "hook 2"]
}}"""

        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)
```

### Step 3: Format Generators

```python
class FormatGenerator:
    def __init__(self):
        openai.api_key = os.getenv("OPENAI_API_KEY")
    
    def generate_formats(self, content: str, analysis: Dict) -> Dict:
        """Generate all repurposed formats."""
        
        return {
            "linkedin_post": self._generate_linkedin(content, analysis),
            "twitter_thread": self._generate_twitter_thread(content, analysis),
            "email_newsletter": self._generate_newsletter(content, analysis),
            "blog_summary": self._generate_blog_summary(content, analysis),
            "short_script": self._generate_short_script(content, analysis)
        }
    
    def _generate_linkedin(self, content: str, analysis: Dict) -> str:
        """Generate LinkedIn-optimized post."""
        
        hooks = "\n".join(f"- {h}" for h in analysis.get("hooks", []))
        takeaways = "\n".join(f"- {t}" for t in analysis.get("actionable_takeaways", []))
        
        prompt = f"""Create a LinkedIn post from this content.

Original Summary: {analysis['summary']}

Hooks to consider:
{hooks}

Key Takeaways:
{takeaways}

Requirements:
- Professional but conversational tone
- 3-5 paragraphs
- Line breaks for readability
- End with engagement question
- Include relevant hashtags (3-5)
- Under 3000 characters

Generate the post:"""

        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.6
        )
        
        return response.choices[0].message.content
    
    def _generate_twitter_thread(self, content: str, analysis: Dict) -> List[str]:
        """Generate Twitter/X thread."""
        
        key_points = "\n".join(f"- {p['point']}" for p in analysis.get("key_points", []))
        
        prompt = f"""Create a Twitter/X thread from this content.

Key Points:
{key_points}

Requirements:
- 5-10 tweets
- First tweet must be a hook (under 280 chars)
- Each tweet under 280 characters
- Progressive revelation (don't give everything away at start)
- Number tweets (1/10, 2/10, etc.)
- Last tweet should have CTA

Generate the thread as JSON array of tweets."""

        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.6,
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        return result.get("tweets", [])
    
    def _generate_newsletter(self, content: str, analysis: Dict) -> str:
        """Generate email newsletter format."""
        # Implementation similar to above
        pass
    
    def _generate_blog_summary(self, content: str, analysis: Dict) -> str:
        """Generate blog post summary."""
        pass
    
    def _generate_short_script(self, content: str, analysis: Dict) -> str:
        """Generate short-form video script."""
        pass
```

### Step 4: Pipeline

```python
class RepurposingPipeline:
    def __init__(self):
        self.ingester = ContentIngester()
        self.analyzer = ContentAnalyzer()
        self.generator = FormatGenerator()
    
    def process(self, source_url: str) -> Dict:
        """Run full repurposing pipeline."""
        
        # Ingest
        ingested = self.ingester.ingest_url(source_url)
        
        # Analyze
        analysis = self.analyzer.analyze(ingested["content"])
        
        # Generate formats
        formats = self.generator.generate_formats(ingested["content"], analysis)
        
        return {
            "source": {
                "url": source_url,
                "type": ingested["source_type"],
                "title": analysis.get("title", "Untitled")
            },
            "analysis": analysis,
            "outputs": formats,
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "content_length": len(ingested["content"])
            }
        }
```

---

## Capstone

Submit:
1. Working pipeline with 3+ output formats
2. Before/after content examples
3. Channel optimization proof
4. Export functionality

---

**Build this. Deploy it. Multiply your content.**
