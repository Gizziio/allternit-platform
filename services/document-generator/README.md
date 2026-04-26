# Summit Copilot Skills API

This is a FastAPI-based skill server that provides REST actions for a Microsoft 365 Copilot declarative agent. It generates academic artifacts (PPTX photo-card decks, DOCX/PDF study guides, XLSX rubrics/trackers) and returns a SharePoint link.

## Features

- Generate photo-card style PPTX decks
- Create DOCX/PDF study guides
- Generate XLSX rubrics and spreadsheets
- Upload artifacts to SharePoint
- API key authentication
- Request/response logging for audit
- OpenAPI 3.0 specification

## Endpoints

- `GET /health` - Health check
- `POST /actions/generatePhotoCardDeck` - Generate PPTX deck
- `POST /actions/generateStudyGuide` - Generate DOCX/PDF study guide
- `POST /actions/generateRubricSpreadsheet` - Generate XLSX rubric/spreadsheet

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set environment variables:
```bash
export API_KEY=your-secret-api-key
export TENANT_ID=your-tenant-id
export CLIENT_ID=your-client-id
export CLIENT_SECRET=your-client-secret
```

3. Run the server:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Docker

Build and run with Docker:

```bash
docker build -t summit-copilot-skills .
docker run -p 8000:8000 -e API_KEY=your-secret-api-key summit-copilot-skills
```

## Testing

Run the test script:
```bash
python test_endpoints.py
```

## Integration with Copilot Studio

To integrate with Microsoft Copilot Studio:

1. Host your skill server at a public URL
2. In Copilot Studio → Agent → Actions → Add action → API / OpenAPI
3. Upload the `openapi.yaml` file or provide the URL to your OpenAPI spec
4. Map parameters automatically (Copilot infers from schema)
5. Set the API key in the connector/action auth

## API Key Authentication

All action endpoints require the `X-API-Key` header with a valid API key. The default key is `your-secret-api-key` but it should be set via the `API_KEY` environment variable in production.

## SharePoint Integration

The application is designed to upload generated files to SharePoint using Microsoft Graph API. In the current implementation, it returns mock URLs. To enable real SharePoint integration, provide valid Azure AD credentials via environment variables.