# alabs-curator

Generate interactive courseware from any codebase.

## Installation

```bash
npm install -g @allternit/alabs-curator
```

## Usage

### 1. Ingest a codebase

```bash
alabs-curator ingest -r ./my-project -e src -d 3
```

Scans the repository and extracts file structure, exports, and imports.

### 2. Analyze topics

```bash
alabs-curator analyze -i ingestion.json -o analysis.json
```

Identifies curriculum topics and generates a learning path.

### 3. Generate module content

```bash
alabs-curator generate -a analysis.json -t "State Management" -o ./modules
```

Generates structured content for a specific topic.

### 4. Build HTML modules

```bash
alabs-curator build -c ./modules -t ./template.html -o ./dist
```

Builds self-contained HTML files from content + template.

### 5. Publish to Canvas

```bash
alabs-curator publish -d ./dist --course-id 12345 --token $CANVAS_TOKEN
```

Uploads modules to Canvas LMS.

## Pipeline

```
ingest → analyze → generate → build → publish
```

## Configuration

Set `CANVAS_TOKEN` environment variable for Canvas publishing.

## Template Format

The template HTML should include these placeholders:
- `{{title}}` — Module title
- `{{content}}` — Module content JSON
