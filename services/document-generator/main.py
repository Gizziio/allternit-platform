from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
import logging
from enum import Enum
import os


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Enums
class Audience(str, Enum):
    student = "student"
    instructor = "instructor"
    exec = "exec"


class ArtifactType(str, Enum):
    pptx = "pptx"
    docx = "docx"
    pdf = "pdf"
    xlsx = "xlsx"


class TemplateType(str, Enum):
    rubric = "rubric"
    tracker = "tracker"
    study_plan = "study_plan"
    grade_calc = "grade_calc"


# Request/Response Models
class Citation(BaseModel):
    title: str
    url: str
    source_id: Optional[str] = None
    excerpt: Optional[str] = None


class SharePointTarget(BaseModel):
    site_url: str
    folder_path: str
    drive_id: Optional[str] = None


class RequestMeta(BaseModel):
    user_id: Optional[str] = None
    course_id: Optional[str] = None
    module_id: Optional[str] = None
    assignment_id: Optional[str] = None
    locale: Optional[str] = None


class OutputOptions(BaseModel):
    file_name_hint: Optional[str] = None
    include_citations_slide_or_section: bool = True
    include_timestamp_in_filename: bool = True


class GeneratePhotoCardDeckRequest(BaseModel):
    request_meta: Optional[RequestMeta] = None
    title: str
    audience: Optional[Audience] = Audience.student
    slide_count: Optional[int] = Field(default=6, ge=4, le=10)
    deck_style: Optional[str] = "photo_card"
    key_points: Optional[List[str]] = []
    outline: Optional[Dict[str, Any]] = None
    images: Optional[List[str]] = []
    citations: Optional[List[Citation]] = []
    sharepoint_target: Optional[SharePointTarget] = None
    output: Optional[OutputOptions] = None


class GenerateStudyGuideRequest(BaseModel):
    request_meta: Optional[RequestMeta] = None
    topic: str
    audience: Optional[Audience] = Audience.student
    format: Optional[ArtifactType] = ArtifactType.docx
    length: Optional[str] = "short"
    learning_objectives: Optional[List[str]] = []
    key_terms: Optional[List[str]] = []
    include_self_check: Optional[bool] = True
    examples: Optional[List[str]] = []
    citations: Optional[List[Citation]] = []
    sharepoint_target: Optional[SharePointTarget] = None
    output: Optional[OutputOptions] = None


class GenerateRubricSpreadsheetRequest(BaseModel):
    request_meta: Optional[RequestMeta] = None
    template_type: TemplateType
    title: Optional[str] = None
    columns: Optional[List[str]] = []
    rows: Optional[List[List[str]]] = []
    validation: Optional[Dict[str, Any]] = {}
    formulas: Optional[Dict[str, Any]] = {}
    citations: Optional[List[Citation]] = []
    sharepoint_target: Optional[SharePointTarget] = None
    output: Optional[OutputOptions] = None


class CreateCanvasModuleRequest(BaseModel):
    course_id: str
    name: str
    request_meta: Optional[RequestMeta] = None


class HealthResponse(BaseModel):
    ok: bool
    service: str
    version: str
    time_utc: str


class ArtifactResponse(BaseModel):
    request_id: str
    artifact_type: ArtifactType
    file_name: str
    sharepoint_file_url: str
    expires_at_utc: Optional[str] = None
    warnings: List[str] = []


class ErrorResponse(BaseModel):
    request_id: str
    error_code: str
    message: str
    details: Optional[Dict[str, Any]] = None


# Import utility modules
from utils.pptx_generator import create_photo_card_deck
from utils.docx_generator import create_study_guide
from utils.xlsx_generator import create_rubric_spreadsheet
from utils.sharepoint_uploader import SharePointUploader
from utils.canvas_connector import CanvasConnector

canvas_connector = CanvasConnector()

# API Key Authentication
API_KEY = os.getenv("API_KEY", "your-secret-api-key")  # Use environment variable or default


async def get_api_key(api_key_header: str = Header(None, alias="X-API-Key")):
    if api_key_header != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return api_key_header


# FastAPI App
app = FastAPI(
    title="Summit Copilot Skills API",
    version="0.1.0",
    description="REST actions for a Microsoft 365 Copilot declarative agent. Generates academic artifacts (PPTX photo-card decks, DOCX/PDF study guides, XLSX rubrics/trackers) and returns a SharePoint link."
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint
    """
    return HealthResponse(
        ok=True,
        service="summit-copilot-skills",
        version="0.1.0",
        time_utc=datetime.utcnow().isoformat() + "Z"
    )


@app.post("/actions/generatePhotoCardDeck", response_model=ArtifactResponse)
async def generate_photo_card_deck(
    request: GeneratePhotoCardDeckRequest,
    api_key: str = Depends(get_api_key)
):
    """
    Generate a short photo-card style PPTX deck and upload to SharePoint
    """
    request_id = f"req_{uuid.uuid4().hex[:16]}"

    # Log the request for audit
    logger.info(f"Request ID: {request_id} - GeneratePhotoCardDeck called")

    try:
        # Generate the PPTX file
        citations_list = [citation.dict() for citation in request.citations] if request.citations else []
        images_list = request.images if request.images else []

        pptx_file_path = create_photo_card_deck(
            title=request.title,
            key_points=request.key_points or [],
            slide_count=request.slide_count,
            citations=citations_list,
            images=images_list
        )

        # Determine file name
        file_name = request.output.file_name_hint if request.output and request.output.file_name_hint else request.title.replace(' ', '_')
        if request.output and request.output.include_timestamp_in_filename:
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            file_name = f"{file_name}_{timestamp}.pptx"
        else:
            file_name = f"{file_name}.pptx"

        # Upload to SharePoint
        sharepoint_url = "https://example.sharepoint.com/sites/CourseHub/Shared%20Documents/Artifacts/mock.pptx"  # Mock for now
        if request.sharepoint_target:
            # Use the SharePointUploader to upload the file
            uploader = SharePointUploader(
                tenant_id=os.getenv("TENANT_ID", "mock-tenant-id"),
                client_id=os.getenv("CLIENT_ID", "mock-client-id"),
                client_secret=os.getenv("CLIENT_SECRET", "mock-client-secret")
            )
            sharepoint_url = await uploader.upload_file(
                site_url=request.sharepoint_target.site_url,
                folder_path=request.sharepoint_target.folder_path,
                file_path=pptx_file_path,
                file_name=file_name
            )

        if not sharepoint_url:
            raise Exception("Failed to upload file to SharePoint")

        # Clean up temporary file
        os.remove(pptx_file_path)

        response = ArtifactResponse(
            request_id=request_id,
            artifact_type=ArtifactType.pptx,
            file_name=file_name,
            sharepoint_file_url=sharepoint_url,
            expires_at_utc=None,
            warnings=[]
        )

        logger.info(f"Request ID: {request_id} - Generated artifact: {sharepoint_url}")
        return response

    except Exception as e:
        logger.error(f"Request ID: {request_id} - Error in generate_photo_card_deck: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                request_id=request_id,
                error_code="INTERNAL_ERROR",
                message=str(e)
            )
        )


@app.post("/actions/generateStudyGuide", response_model=ArtifactResponse)
async def generate_study_guide(
    request: GenerateStudyGuideRequest,
    api_key: str = Depends(get_api_key)
):
    """
    Generate a DOCX or PDF study guide and upload to SharePoint
    """
    request_id = f"req_{uuid.uuid4().hex[:16]}"

    # Log the request for audit
    logger.info(f"Request ID: {request_id} - GenerateStudyGuide called")

    try:
        # Generate the DOCX file
        citations_list = [citation.dict() for citation in request.citations] if request.citations else []

        docx_file_path = create_study_guide(
            topic=request.topic,
            learning_objectives=request.learning_objectives or [],
            key_terms=request.key_terms or [],
            include_self_check=request.include_self_check,
            citations=citations_list,
            length=request.length
        )

        # Determine file name
        file_name = request.output.file_name_hint if request.output and request.output.file_name_hint else request.topic.replace(' ', '_')
        if request.output and request.output.include_timestamp_in_filename:
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            file_name = f"{file_name}_{timestamp}.{request.format}"
        else:
            file_name = f"{file_name}.{request.format}"

        # Upload to SharePoint
        sharepoint_url = "https://example.sharepoint.com/sites/CourseHub/Shared%20Documents/Artifacts/mock.docx"  # Mock for now
        if request.sharepoint_target:
            # Use the SharePointUploader to upload the file
            uploader = SharePointUploader(
                tenant_id=os.getenv("TENANT_ID", "mock-tenant-id"),
                client_id=os.getenv("CLIENT_ID", "mock-client-id"),
                client_secret=os.getenv("CLIENT_SECRET", "mock-client-secret")
            )
            sharepoint_url = await uploader.upload_file(
                site_url=request.sharepoint_target.site_url,
                folder_path=request.sharepoint_target.folder_path,
                file_path=docx_file_path,
                file_name=file_name
            )

        if not sharepoint_url:
            raise Exception("Failed to upload file to SharePoint")

        # Clean up temporary file
        os.remove(docx_file_path)

        response = ArtifactResponse(
            request_id=request_id,
            artifact_type=request.format,
            file_name=file_name,
            sharepoint_file_url=sharepoint_url,
            expires_at_utc=None,
            warnings=[]
        )

        logger.info(f"Request ID: {request_id} - Generated artifact: {sharepoint_url}")
        return response

    except Exception as e:
        logger.error(f"Request ID: {request_id} - Error in generate_study_guide: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                request_id=request_id,
                error_code="INTERNAL_ERROR",
                message=str(e)
            )
        )


@app.post("/actions/generateRubricSpreadsheet", response_model=ArtifactResponse)
async def generate_rubric_spreadsheet(
    request: GenerateRubricSpreadsheetRequest,
    api_key: str = Depends(get_api_key)
):
    """
    Generate an XLSX rubric/tracker/study plan/grade calc and upload to SharePoint
    """
    request_id = f"req_{uuid.uuid4().hex[:16]}"

    # Log the request for audit
    logger.info(f"Request ID: {request_id} - GenerateRubricSpreadsheet called")

    try:
        # Generate the XLSX file
        citations_list = [citation.dict() for citation in request.citations] if request.citations else []

        xlsx_file_path = create_rubric_spreadsheet(
            template_type=request.template_type.value,
            title=request.title,
            columns=request.columns or [],
            rows=request.rows or [],
            formulas=request.formulas,
            citations=citations_list
        )

        # Determine file name
        file_name = request.output.file_name_hint if request.output and request.output.file_name_hint else (request.title.replace(' ', '_') if request.title else 'rubric')
        if request.output and request.output.include_timestamp_in_filename:
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            file_name = f"{file_name}_{timestamp}.xlsx"
        else:
            file_name = f"{file_name}.xlsx"

        # Upload to SharePoint
        sharepoint_url = "https://example.sharepoint.com/sites/CourseHub/Shared%20Documents/Artifacts/mock.xlsx"  # Mock for now
        if request.sharepoint_target:
            # Use the SharePointUploader to upload the file
            uploader = SharePointUploader(
                tenant_id=os.getenv("TENANT_ID", "mock-tenant-id"),
                client_id=os.getenv("CLIENT_ID", "mock-client-id"),
                client_secret=os.getenv("CLIENT_SECRET", "mock-client-secret")
            )
            sharepoint_url = await uploader.upload_file(
                site_url=request.sharepoint_target.site_url,
                folder_path=request.sharepoint_target.folder_path,
                file_path=xlsx_file_path,
                file_name=file_name
            )

        if not sharepoint_url:
            raise Exception("Failed to upload file to SharePoint")

        # Clean up temporary file
        os.remove(xlsx_file_path)

        response = ArtifactResponse(
            request_id=request_id,
            artifact_type=ArtifactType.xlsx,
            file_name=file_name,
            sharepoint_file_url=sharepoint_url,
            expires_at_utc=None,
            warnings=[]
        )

        logger.info(f"Request ID: {request_id} - Generated artifact: {sharepoint_url}")
        return response

    except Exception as e:
        logger.error(f"Request ID: {request_id} - Error in generate_rubric_spreadsheet: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                request_id=request_id,
                error_code="INTERNAL_ERROR",
                message=str(e)
            )
        )


@app.post("/actions/createCanvasModule")
async def create_canvas_module(
    request: CreateCanvasModuleRequest,
    api_key: str = Depends(get_api_key)
):
    """
    Action: create_canvas_module
    Pluggable Summit-specific action.
    """
    request_id = f"req_{uuid.uuid4().hex[:16]}"
    logger.info(f"Request ID: {request_id} - CreateCanvasModule called")

    try:
        result = await canvas_connector.create_module(
            course_id=request.course_id,
            name=request.name
        )
        return {
            "request_id": request_id,
            "status": "success",
            "canvas_result": result
        }
    except Exception as e:
        logger.error(f"Request ID: {request_id} - Canvas Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)