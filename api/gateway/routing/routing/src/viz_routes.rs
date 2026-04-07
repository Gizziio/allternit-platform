#![allow(dead_code, unused_variables, unused_imports)]
//! Data Visualization API Routes
//!
//! Provides REST API for data visualization integration:
//! - POST /viz/render - Render chart to SVG/PNG
//! - POST /viz/data - Process and return chart data
//! - GET /viz/palettes - List available color palettes
//! - POST /viz/export - Export chart in various formats

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::get,
    routing::post,
    Router,
};
use resvg;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::info;
use utoipa::ToSchema;
use validator::Validate;

use crate::AppState;

// ============================================================================
// Types and DTOs
// ============================================================================

/// Chart type
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum ChartType {
    Line,
    Bar,
    Pie,
    Doughnut,
    Area,
    Scatter,
    Bubble,
    Radar,
    Heatmap,
    Gauge,
    Treemap,
    Sankey,
    Funnel,
    Candlestick,
    Boxplot,
    Histogram,
    Timeline,
}

/// Data series
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct DataSeries {
    /// Series name
    pub name: String,
    /// Series data points
    pub data: Vec<serde_json::Value>,
    /// Series color (optional)
    pub color: Option<String>,
    /// Series type (for mixed charts)
    #[serde(rename = "type")]
    pub series_type: Option<String>,
    /// Additional series options
    #[serde(flatten)]
    pub options: Option<HashMap<String, serde_json::Value>>,
}

/// Chart data
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct ChartData {
    /// X-axis labels or categories
    pub labels: Option<Vec<String>>,
    /// Data series
    pub series: Vec<DataSeries>,
    /// X-axis configuration
    pub x_axis: Option<AxisConfig>,
    /// Y-axis configuration
    pub y_axis: Option<AxisConfig>,
    /// Additional data metadata
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Axis configuration
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct AxisConfig {
    /// Axis title
    pub title: Option<String>,
    /// Min value
    pub min: Option<f64>,
    /// Max value
    pub max: Option<f64>,
    /// Tick interval
    pub interval: Option<f64>,
    /// Format string
    pub format: Option<String>,
    /// Grid visibility
    pub show_grid: Option<bool>,
    /// Logarithmic scale
    pub log_scale: Option<bool>,
}

/// Chart configuration
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct ChartConfig {
    /// Chart width in pixels
    pub width: Option<u32>,
    /// Chart height in pixels
    pub height: Option<u32>,
    /// Chart title
    pub title: Option<String>,
    /// Chart subtitle
    pub subtitle: Option<String>,
    /// Show legend
    pub show_legend: Option<bool>,
    /// Legend position
    pub legend_position: Option<String>,
    /// Color palette name
    pub palette: Option<String>,
    /// Background color
    pub background_color: Option<String>,
    /// Theme (light/dark)
    pub theme: Option<String>,
    /// Font family
    pub font_family: Option<String>,
    /// Animation enabled
    pub animation: Option<bool>,
    /// Interactivity enabled
    pub interactive: Option<bool>,
    /// Show tooltips
    pub show_tooltips: Option<bool>,
    /// Show data labels
    pub show_data_labels: Option<bool>,
    /// Chart-specific options
    pub options: Option<serde_json::Value>,
}

/// Render format
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum RenderFormat {
    Svg,
    Png,
    Pdf,
    Html,
    Json,
}

/// Render chart request
#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct RenderChartRequest {
    /// Chart type
    #[serde(rename = "type")]
    pub chart_type: ChartType,
    /// Chart data
    pub data: ChartData,
    /// Chart configuration
    pub config: Option<ChartConfig>,
    /// Output format
    pub format: Option<RenderFormat>,
}

/// Render chart response
#[derive(Debug, Serialize, ToSchema)]
pub struct RenderChartResponse {
    /// Rendered chart content (SVG string, base64 PNG, etc.)
    pub content: String,
    /// Content type
    pub content_type: String,
    /// Format
    pub format: String,
    /// Generated timestamp
    pub generated_at: String,
}

/// Process data request
#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct ProcessDataRequest {
    /// Raw input data
    pub data: serde_json::Value,
    /// Data transformation pipeline
    pub transformations: Option<Vec<DataTransformation>>,
    /// Aggregation configuration
    pub aggregation: Option<AggregationConfig>,
    /// Filter configuration
    pub filter: Option<FilterConfig>,
}

/// Data transformation
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct DataTransformation {
    /// Transformation type
    #[serde(rename = "type")]
    pub transform_type: String,
    /// Transformation parameters
    pub params: Option<serde_json::Value>,
}

/// Aggregation configuration
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct AggregationConfig {
    /// Group by fields
    pub group_by: Vec<String>,
    /// Aggregations to perform
    pub aggregations: Vec<Aggregation>,
}

/// Aggregation definition
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct Aggregation {
    /// Field to aggregate
    pub field: String,
    /// Aggregation function (sum, avg, min, max, count, etc.)
    pub function: String,
    /// Output alias
    pub alias: Option<String>,
}

/// Filter configuration
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct FilterConfig {
    /// Filter conditions
    pub conditions: Vec<FilterCondition>,
    /// Logical operator (and/or)
    pub operator: Option<String>,
}

/// Filter condition
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct FilterCondition {
    /// Field to filter
    pub field: String,
    /// Operator (eq, ne, gt, lt, gte, lte, in, contains, etc.)
    pub operator: String,
    /// Value to compare
    pub value: serde_json::Value,
}

/// Process data response
#[derive(Debug, Serialize, ToSchema)]
pub struct ProcessDataResponse {
    /// Processed chart data
    pub chart_data: ChartData,
    /// Processing metadata
    pub metadata: DataProcessingMetadata,
}

/// Data processing metadata
#[derive(Debug, Serialize, ToSchema)]
pub struct DataProcessingMetadata {
    /// Input row count
    pub input_rows: usize,
    /// Output row count
    pub output_rows: usize,
    /// Processing time in milliseconds
    pub processing_time_ms: u64,
    /// Applied transformations
    pub applied_transformations: Vec<String>,
}

/// Color palette
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ColorPalette {
    /// Palette name
    pub name: String,
    /// Display name
    pub display_name: String,
    /// Colors in the palette
    pub colors: Vec<String>,
    /// Palette type (sequential, diverging, qualitative)
    #[serde(rename = "type")]
    pub palette_type: String,
    /// Number of colors
    pub count: usize,
}

/// List palettes response
#[derive(Debug, Serialize, ToSchema)]
pub struct ListPalettesResponse {
    /// Available palettes
    pub palettes: Vec<ColorPalette>,
    /// Total count
    pub total: usize,
}

/// Export format query parameter
#[derive(Debug, Deserialize, IntoParams)]
pub struct ExportFormatQuery {
    /// Export format
    pub format: Option<String>,
    /// Filename (without extension)
    pub filename: Option<String>,
}

/// Export chart request
#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct ExportChartRequest {
    /// Chart type
    #[serde(rename = "type")]
    pub chart_type: ChartType,
    /// Chart data
    pub data: ChartData,
    /// Chart configuration
    pub config: Option<ChartConfig>,
    /// Export format
    pub format: ExportFormat,
    /// Export options
    pub options: Option<ExportOptions>,
}

/// Export format
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Png,
    Jpeg,
    Svg,
    Pdf,
    Csv,
    Excel,
    Json,
    Html,
}

/// Export options
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct ExportOptions {
    /// Image scale factor (for raster formats)
    pub scale: Option<f64>,
    /// DPI for PDF export
    pub dpi: Option<u32>,
    /// Include data table
    pub include_data_table: Option<bool>,
    /// Custom CSS for HTML export
    pub custom_css: Option<String>,
}

/// Export response
#[derive(Debug, Serialize, ToSchema)]
pub struct ExportResponse {
    /// Export URL (temporary download link)
    pub download_url: Option<String>,
    /// Base64 encoded content (for small exports)
    pub content: Option<String>,
    /// Content type
    pub content_type: String,
    /// Filename
    pub filename: String,
    /// Expiration timestamp
    pub expires_at: Option<String>,
}

/// Error response
#[derive(Debug, Serialize, ToSchema)]
pub struct VizErrorResponse {
    /// Error code
    pub code: String,
    /// Error message
    pub message: String,
    /// Additional details
    pub details: Option<serde_json::Value>,
}

/// Health response
#[derive(Debug, Serialize, ToSchema)]
pub struct VizHealthResponse {
    /// Service status
    pub status: String,
    /// Available renderers
    pub available_renderers: Vec<String>,
    /// Supported formats
    pub supported_formats: Vec<String>,
}

// ============================================================================
// Route Handlers
// ============================================================================

/// Render chart to specified format
#[utoipa::path(
    post,
    path = "/api/v1/viz/render",
    request_body = RenderChartRequest,
    responses(
        (status = 200, description = "Chart rendered successfully", body = RenderChartResponse),
        (status = 400, description = "Invalid request", body = VizErrorResponse),
        (status = 422, description = "Unsupported chart type or format", body = VizErrorResponse),
        (status = 500, description = "Rendering failed", body = VizErrorResponse)
    )
)]
async fn render_chart(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<RenderChartRequest>,
) -> Result<Json<RenderChartResponse>, (StatusCode, Json<VizErrorResponse>)> {
    // Validate request
    if let Err(validation_errors) = request.validate() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(VizErrorResponse {
                code: "VALIDATION_ERROR".to_string(),
                message: format!("Validation failed: {}", validation_errors),
                details: None,
            }),
        ));
    }

    info!(
        chart_type = ?request.chart_type,
        format = ?request.format,
        "Rendering chart"
    );

    let format = request.format.clone().unwrap_or(RenderFormat::Svg);
    let (content, content_type) = match &format {
        RenderFormat::Svg => {
            let svg = render_to_svg(&request)?;
            (svg, "image/svg+xml")
        }
        RenderFormat::Png => {
            let png_data = render_to_png(&request)?;
            (png_data, "image/png")
        }
        RenderFormat::Pdf => {
            let pdf_data = render_to_pdf(&request)?;
            (pdf_data, "application/pdf")
        }
        RenderFormat::Html => {
            let html = render_to_html(&request)?;
            (html, "text/html")
        }
        RenderFormat::Json => {
            let json = render_to_json(&request)?;
            (json, "application/json")
        }
    };

    let response = RenderChartResponse {
        content,
        content_type: content_type.to_string(),
        format: format_str(&format).to_string(),
        generated_at: chrono::Utc::now().to_rfc3339(),
    };

    Ok(Json(response))
}

/// Process raw data into chart-ready format
#[utoipa::path(
    post,
    path = "/api/v1/viz/data",
    request_body = ProcessDataRequest,
    responses(
        (status = 200, description = "Data processed successfully", body = ProcessDataResponse),
        (status = 400, description = "Invalid request", body = VizErrorResponse),
        (status = 422, description = "Unsupported transformation", body = VizErrorResponse),
        (status = 500, description = "Processing failed", body = VizErrorResponse)
    )
)]
async fn process_data(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<ProcessDataRequest>,
) -> Result<Json<ProcessDataResponse>, (StatusCode, Json<VizErrorResponse>)> {
    // Validate request
    if let Err(validation_errors) = request.validate() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(VizErrorResponse {
                code: "VALIDATION_ERROR".to_string(),
                message: format!("Validation failed: {}", validation_errors),
                details: None,
            }),
        ));
    }

    info!("Processing data for visualization");

    let start_time = std::time::Instant::now();

    // Process the data
    let chart_data = process_raw_data(&request)?;

    let processing_time_ms = start_time.elapsed().as_millis() as u64;

    let metadata = DataProcessingMetadata {
        input_rows: estimate_row_count(&request.data),
        output_rows: chart_data.series.first().map(|s| s.data.len()).unwrap_or(0),
        processing_time_ms,
        applied_transformations: request
            .transformations
            .as_ref()
            .map(|t| t.iter().map(|tr| tr.transform_type.clone()).collect())
            .unwrap_or_default(),
    };

    let response = ProcessDataResponse {
        chart_data,
        metadata,
    };

    Ok(Json(response))
}

/// List available color palettes
#[utoipa::path(
    get,
    path = "/api/v1/viz/palettes",
    responses(
        (status = 200, description = "List of color palettes", body = ListPalettesResponse),
        (status = 500, description = "Internal server error", body = VizErrorResponse)
    )
)]
async fn list_palettes() -> Json<ListPalettesResponse> {
    let palettes = vec![
        ColorPalette {
            name: "default".to_string(),
            display_name: "Default".to_string(),
            colors: vec![
                "#4CAF50".to_string(),
                "#2196F3".to_string(),
                "#FF9800".to_string(),
                "#F44336".to_string(),
                "#9C27B0".to_string(),
                "#00BCD4".to_string(),
            ],
            palette_type: "qualitative".to_string(),
            count: 6,
        },
        ColorPalette {
            name: "ocean".to_string(),
            display_name: "Ocean".to_string(),
            colors: vec![
                "#006994".to_string(),
                "#0085B5".to_string(),
                "#00A0D6".to_string(),
                "#4DB8E8".to_string(),
                "#99D0F5".to_string(),
            ],
            palette_type: "sequential".to_string(),
            count: 5,
        },
        ColorPalette {
            name: "sunset".to_string(),
            display_name: "Sunset".to_string(),
            colors: vec![
                "#FF6B6B".to_string(),
                "#FF8E53".to_string(),
                "#FE6B8B".to_string(),
                "#FF8E53".to_string(),
                "#C73E1D".to_string(),
            ],
            palette_type: "diverging".to_string(),
            count: 5,
        },
        ColorPalette {
            name: "monochrome".to_string(),
            display_name: "Monochrome".to_string(),
            colors: vec![
                "#212121".to_string(),
                "#424242".to_string(),
                "#616161".to_string(),
                "#757575".to_string(),
                "#9E9E9E".to_string(),
                "#BDBDBD".to_string(),
            ],
            palette_type: "sequential".to_string(),
            count: 6,
        },
        ColorPalette {
            name: "vibrant".to_string(),
            display_name: "Vibrant".to_string(),
            colors: vec![
                "#E91E63".to_string(),
                "#9C27B0".to_string(),
                "#673AB7".to_string(),
                "#3F51B5".to_string(),
                "#2196F3".to_string(),
                "#03A9F4".to_string(),
                "#00BCD4".to_string(),
                "#009688".to_string(),
            ],
            palette_type: "qualitative".to_string(),
            count: 8,
        },
    ];

    let total = palettes.len();

    Json(ListPalettesResponse { palettes, total })
}

/// Export chart in various formats
#[utoipa::path(
    post,
    path = "/api/v1/viz/export",
    request_body = ExportChartRequest,
    responses(
        (status = 200, description = "Chart exported successfully", body = ExportResponse),
        (status = 400, description = "Invalid request", body = VizErrorResponse),
        (status = 415, description = "Unsupported export format", body = VizErrorResponse),
        (status = 500, description = "Export failed", body = VizErrorResponse)
    )
)]
async fn export_chart(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<ExportChartRequest>,
) -> Result<Json<ExportResponse>, (StatusCode, Json<VizErrorResponse>)> {
    // Validate request
    if let Err(validation_errors) = request.validate() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(VizErrorResponse {
                code: "VALIDATION_ERROR".to_string(),
                message: format!("Validation failed: {}", validation_errors),
                details: None,
            }),
        ));
    }

    info!(format = ?request.format, "Exporting chart");

    let extension = match request.format {
        ExportFormat::Png => "png",
        ExportFormat::Jpeg => "jpg",
        ExportFormat::Svg => "svg",
        ExportFormat::Pdf => "pdf",
        ExportFormat::Csv => "csv",
        ExportFormat::Excel => "xlsx",
        ExportFormat::Json => "json",
        ExportFormat::Html => "html",
    };

    let content_type = match request.format {
        ExportFormat::Png => "image/png",
        ExportFormat::Jpeg => "image/jpeg",
        ExportFormat::Svg => "image/svg+xml",
        ExportFormat::Pdf => "application/pdf",
        ExportFormat::Csv => "text/csv",
        ExportFormat::Excel => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ExportFormat::Json => "application/json",
        ExportFormat::Html => "text/html",
    };

    let filename = format!("chart_export_{}.{}", uuid::Uuid::new_v4(), extension);

    // Create a RenderChartRequest from ExportChartRequest
    let render_request = RenderChartRequest {
        chart_type: request.chart_type.clone(),
        data: request.data.clone(),
        config: request.config.clone(),
        format: None, // Will be determined by the rendering function
    };

    // Generate actual export content based on format
    let content = match &request.format {
        ExportFormat::Svg => render_to_svg(&render_request).ok(),
        ExportFormat::Png => render_to_png(&render_request).ok(),
        ExportFormat::Pdf => render_to_pdf(&render_request).ok(),
        ExportFormat::Html => render_to_html(&render_request).ok(),
        ExportFormat::Json => render_to_json(&render_request).ok(),
        _ => None,
    };

    let response = ExportResponse {
        download_url: Some(format!("/api/v1/viz/downloads/{}", filename)),
        content,
        content_type: content_type.to_string(),
        filename,
        expires_at: Some((chrono::Utc::now() + chrono::Duration::hours(1)).to_rfc3339()),
    };

    Ok(Json(response))
}

/// Visualization service health check
#[utoipa::path(
    get,
    path = "/api/v1/viz/health",
    responses(
        (status = 200, description = "Service is healthy", body = VizHealthResponse),
        (status = 503, description = "Service is unhealthy", body = VizErrorResponse)
    )
)]
async fn viz_health() -> Json<VizHealthResponse> {
    Json(VizHealthResponse {
        status: "healthy".to_string(),
        available_renderers: vec!["svg".to_string(), "canvas".to_string(), "html".to_string()],
        supported_formats: vec![
            "svg".to_string(),
            "png".to_string(),
            "pdf".to_string(),
            "html".to_string(),
            "json".to_string(),
            "csv".to_string(),
            "excel".to_string(),
        ],
    })
}

// ============================================================================
// Helper Functions
// ============================================================================

fn format_str(format: &RenderFormat) -> &'static str {
    match format {
        RenderFormat::Svg => "svg",
        RenderFormat::Png => "png",
        RenderFormat::Pdf => "pdf",
        RenderFormat::Html => "html",
        RenderFormat::Json => "json",
    }
}

fn render_to_svg(
    request: &RenderChartRequest,
) -> Result<String, (StatusCode, Json<VizErrorResponse>)> {
    let width = request.config.as_ref().and_then(|c| c.width).unwrap_or(800);
    let height = request
        .config
        .as_ref()
        .and_then(|c| c.height)
        .unwrap_or(600);
    let title = request.config.as_ref().and_then(|c| c.title.clone());

    // Generate a simple SVG based on chart type
    let svg = match request.chart_type {
        ChartType::Line | ChartType::Bar | ChartType::Area => {
            generate_bar_line_svg(request, width, height, title)
        }
        ChartType::Pie | ChartType::Doughnut => generate_pie_svg(request, width, height, title),
        _ => generate_generic_svg(request, width, height, title),
    };

    Ok(svg)
}

fn render_to_html(
    request: &RenderChartRequest,
) -> Result<String, (StatusCode, Json<VizErrorResponse>)> {
    let json_data = serde_json::to_string(&request.data).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(VizErrorResponse {
                code: "SERIALIZATION_ERROR".to_string(),
                message: format!("Failed to serialize data: {}", e),
                details: None,
            }),
        )
    })?;

    let html = format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <title>{}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        #chart {{ width: 100%; height: 600px; }}
    </style>
</head>
<body>
    <div id="chart"></div>
    <script>
        const chartData = {};
        console.log('Chart data loaded:', chartData);
        // Chart rendering would be implemented here
        document.getElementById('chart').innerHTML = '<pre>' + JSON.stringify(chartData, null, 2) + '</pre>';
    </script>
</body>
</html>"#,
        request
            .config
            .as_ref()
            .and_then(|c| c.title.clone())
            .unwrap_or_else(|| "Chart".to_string()),
        json_data
    );

    Ok(html)
}

fn render_to_png(
    request: &RenderChartRequest,
) -> Result<String, (StatusCode, Json<VizErrorResponse>)> {
    // Generate SVG first
    let svg = render_to_svg(request)?;

    // Parse the SVG using resvg
    let tree = match resvg::usvg::Tree::from_str(&svg, &resvg::usvg::Options::default()) {
        Ok(tree) => tree,
        Err(e) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(VizErrorResponse {
                    code: "SVG_PARSE_ERROR".to_string(),
                    message: format!("Failed to parse SVG: {}", e),
                    details: None,
                }),
            ));
        }
    };

    // Apply scaling based on request options (default: 2x for high DPI)
    let scale = request
        .config
        .as_ref()
        .and_then(|c| c.options.as_ref())
        .and_then(|o| o.get("scale"))
        .and_then(|s| s.as_f64())
        .unwrap_or(2.0) as f32;

    let size = tree.size().to_int_size();
    let scaled_width = (size.width() as f32 * scale) as u32;
    let scaled_height = (size.height() as f32 * scale) as u32;

    // Create a pixmap to render into
    let mut pixmap = match resvg::tiny_skia::Pixmap::new(scaled_width, scaled_height) {
        Some(pixmap) => pixmap,
        None => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(VizErrorResponse {
                    code: "RENDER_ERROR".to_string(),
                    message: "Failed to create render buffer".to_string(),
                    details: None,
                }),
            ));
        }
    };

    // Render the SVG to the pixmap
    resvg::render(
        &tree,
        resvg::tiny_skia::Transform::from_scale(scale, scale),
        &mut pixmap.as_mut(),
    );

    // Encode the pixmap as PNG
    let png_data = pixmap.encode_png().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(VizErrorResponse {
                code: "ENCODE_ERROR".to_string(),
                message: format!("Failed to encode PNG: {}", e),
                details: None,
            }),
        )
    })?;

    // Encode as base64
    let base64_png = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &png_data);

    Ok(base64_png)
}

fn render_to_pdf(
    request: &RenderChartRequest,
) -> Result<String, (StatusCode, Json<VizErrorResponse>)> {
    use printpdf::*;
    use std::io::Cursor;

    // Get chart dimensions and title
    let width = request.config.as_ref().and_then(|c| c.width).unwrap_or(800) as f64;
    let height = request
        .config
        .as_ref()
        .and_then(|c| c.height)
        .unwrap_or(600) as f64;
    let title = request
        .config
        .as_ref()
        .and_then(|c| c.title.clone())
        .unwrap_or_else(|| "Chart".to_string());

    // Create a new PDF document
    let (doc, page1, layer1) = PdfDocument::new(
        &title,
        Mm((width * 0.264583) as f32), // Convert pixels to mm (1px ≈ 0.264583mm at 96 DPI)
        Mm((height * 0.264583) as f32),
        "Layer1",
    );

    // Get the first page layer reference
    let current_layer = doc.get_page(page1).get_layer(layer1);

    // Add title text
    let font = doc.add_builtin_font(BuiltinFont::Helvetica).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(VizErrorResponse {
                code: "PDF_FONT_ERROR".to_string(),
                message: format!("Failed to add font: {}", e),
                details: None,
            }),
        )
    })?;

    // Add chart title at the top
    current_layer.use_text(
        &title,
        16.0,
        Mm(10.0),
        Mm(((height * 0.264583) - 10.0) as f32),
        &font,
    );

    // Generate SVG and render it to a pixmap for embedding in PDF
    let svg = render_to_svg(request)?;

    // Parse and render the SVG
    let tree = match resvg::usvg::Tree::from_str(&svg, &resvg::usvg::Options::default()) {
        Ok(tree) => tree,
        Err(e) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(VizErrorResponse {
                    code: "SVG_PARSE_ERROR".to_string(),
                    message: format!("Failed to parse SVG: {}", e),
                    details: None,
                }),
            ));
        }
    };

    // Scale the tree to a reasonable size for PDF embedding
    let scale_factor = 1.5;
    let size = tree.size().to_int_size();
    let scaled_width = (size.width() as f32 * scale_factor) as u32;
    let scaled_height = (size.height() as f32 * scale_factor) as u32;

    let mut pixmap = match resvg::tiny_skia::Pixmap::new(scaled_width, scaled_height) {
        Some(pixmap) => pixmap,
        None => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(VizErrorResponse {
                    code: "RENDER_ERROR".to_string(),
                    message: "Failed to create render buffer".to_string(),
                    details: None,
                }),
            ));
        }
    };

    resvg::render(
        &tree,
        resvg::tiny_skia::Transform::from_scale(scale_factor, scale_factor),
        &mut pixmap.as_mut(),
    );

    // Encode pixmap to PNG for embedding
    let png_data = pixmap.encode_png().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(VizErrorResponse {
                code: "ENCODE_ERROR".to_string(),
                message: format!("Failed to encode PNG: {}", e),
                details: None,
            }),
        )
    })?;

    // Embed the PNG image in the PDF
    let dynamic_image = printpdf::image_crate::load_from_memory(&png_data).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(VizErrorResponse {
                code: "IMAGE_LOAD_ERROR".to_string(),
                message: format!("Failed to load image: {}", e),
                details: None,
            }),
        )
    })?;

    let image = Image::from(ImageXObject::from_dynamic_image(&dynamic_image));

    // Add the image to the PDF, positioned below the title
    let image_x = Mm(10.0);
    let image_y = Mm(10.0);
    let image_width = Mm((scaled_width as f32) * 0.264583);
    let image_height = Mm((scaled_height as f32) * 0.264583);

    image.add_to_layer(
        current_layer.clone(),
        ImageTransform {
            translate_x: Some(image_x),
            translate_y: Some(image_y),
            scale_x: Some(image_width.0 / dynamic_image.width() as f32),
            scale_y: Some(image_height.0 / dynamic_image.height() as f32),
            rotate: None,
            dpi: Some(150.0),
        },
    );

    // Serialize the PDF to bytes
    let mut pdf_data = Vec::new();
    {
        let mut writer = std::io::BufWriter::new(std::io::Cursor::new(&mut pdf_data));
        doc.save(&mut writer).map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(VizErrorResponse {
                    code: "PDF_SAVE_ERROR".to_string(),
                    message: format!("Failed to save PDF: {}", e),
                    details: None,
                }),
            )
        })?;
    }

    // Encode as base64
    let base64_pdf = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, pdf_data);

    Ok(base64_pdf)
}

fn render_to_json(
    request: &RenderChartRequest,
) -> Result<String, (StatusCode, Json<VizErrorResponse>)> {
    let output = serde_json::json!({
        "chart_type": request.chart_type,
        "data": request.data,
        "config": request.config,
    });

    serde_json::to_string_pretty(&output).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(VizErrorResponse {
                code: "SERIALIZATION_ERROR".to_string(),
                message: format!("Failed to serialize: {}", e),
                details: None,
            }),
        )
    })
}

fn generate_bar_line_svg(
    request: &RenderChartRequest,
    width: u32,
    height: u32,
    title: Option<String>,
) -> String {
    let chart_height = height - 100;
    let chart_width = width - 100;
    let chart_y = 80;
    let chart_x = 60;

    let mut svg = format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {} {}" width="{}" height="{}">
  <rect width="100%" height="100%" fill="#fafafa"/>
  <rect x="{}" y="{}" width="{}" height="{}" fill="white" stroke="#ddd" stroke-width="1"/>
"##,
        width, height, width, height, chart_x, chart_y, chart_width, chart_height
    );

    // Add title
    if let Some(t) = title {
        svg.push_str(&format!(
            r##"  <text x="{}" y="30" text-anchor="middle" font-size="18" font-weight="bold" fill="#333">{}</text>
"##,
            width / 2, t
        ));
    }

    // Add sample data visualization
    let series_count = request.data.series.len().max(1);
    let colors = vec![
        "#4CAF50", "#2196F3", "#FF9800", "#F44336", "#9C27B0", "#00BCD4",
    ];

    for (i, series) in request.data.series.iter().enumerate() {
        let color = colors.get(i).unwrap_or(&"#4CAF50");
        let bar_width = chart_width as f64 / (series.data.len().max(1) * series_count + 1) as f64;

        for (j, value) in series.data.iter().enumerate() {
            if let Some(val) = value.as_f64().or_else(|| value.as_i64().map(|v| v as f64)) {
                let bar_height = (val / 100.0) * chart_height as f64;
                let x = chart_x as f64 + (j * series_count + i + 1) as f64 * bar_width;
                let y = chart_y as f64 + chart_height as f64 - bar_height;

                svg.push_str(&format!(
                    r#"  <rect x="{}" y="{}" width="{}" height="{}" fill="{}" opacity="0.8"/>
"#,
                    x,
                    y,
                    bar_width * 0.8,
                    bar_height,
                    color
                ));
            }
        }

        // Add legend
        svg.push_str(&format!(
            r##"  <rect x="{}" y="{}" width="12" height="12" fill="{}"/>
  <text x="{}" y="{}" font-size="12" fill="#333">{}</text>
"##,
            width - 150,
            60 + i * 20,
            color,
            width - 135,
            71 + i * 20,
            series.name
        ));
    }

    // Close SVG
    svg.push_str("</svg>");
    svg
}

fn generate_pie_svg(
    request: &RenderChartRequest,
    width: u32,
    height: u32,
    title: Option<String>,
) -> String {
    let cx = width as f64 / 2.0;
    let cy = height as f64 / 2.0 + 20.0;
    let radius = (width.min(height) as f64 / 2.0 - 60.0).max(50.0);

    let mut svg = format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {} {}" width="{}" height="{}">
  <rect width="100%" height="100%" fill="#fafafa"/>
"##,
        width, height, width, height
    );

    // Add title
    if let Some(t) = title {
        svg.push_str(&format!(
            r##"  <text x="{}" y="30" text-anchor="middle" font-size="18" font-weight="bold" fill="#333">{}</text>
"##,
            width / 2, t
        ));
    }

    // Generate pie slices
    let colors = vec![
        "#4CAF50", "#2196F3", "#FF9800", "#F44336", "#9C27B0", "#00BCD4",
    ];
    let mut start_angle = 0.0;

    if let Some(series) = request.data.series.first() {
        let total: f64 = series
            .data
            .iter()
            .filter_map(|v| v.as_f64().or_else(|| v.as_i64().map(|i| i as f64)))
            .sum();

        for (i, value) in series.data.iter().enumerate() {
            if let Some(val) = value.as_f64().or_else(|| value.as_i64().map(|i| i as f64)) {
                let angle = (val / total) * 2.0 * std::f64::consts::PI;
                let end_angle = start_angle + angle;

                let x1 = cx + radius * start_angle.cos();
                let y1 = cy + radius * start_angle.sin();
                let x2 = cx + radius * end_angle.cos();
                let y2 = cy + radius * end_angle.sin();

                let large_arc = if angle > std::f64::consts::PI { 1 } else { 0 };

                svg.push_str(&format!(
                    r#"  <path d="M {} {} L {} {} A {} {} 0 {} 1 {} {} Z" fill="{}" opacity="0.8" stroke="white" stroke-width="2"/>
"#,
                    cx, cy, x1, y1, radius, radius, large_arc, x2, y2,
                    colors.get(i).unwrap_or(&"#4CAF50")
                ));

                start_angle = end_angle;
            }
        }
    }

    svg.push_str("</svg>");
    svg
}

fn generate_generic_svg(
    request: &RenderChartRequest,
    width: u32,
    height: u32,
    title: Option<String>,
) -> String {
    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {} {}" width="{}" height="{}">
  <rect width="100%" height="100%" fill="#fafafa"/>
  <text x="{}" y="30" text-anchor="middle" font-size="18" font-weight="bold" fill="#333">{}</text>
  <text x="{}" y="{}" text-anchor="middle" font-size="14" fill="#666">{} Chart</text>
  <text x="{}" y="{}" text-anchor="middle" font-size="12" fill="#999">Data points: {}</text>
</svg>"##,
        width,
        height,
        width,
        height,
        width / 2,
        title.unwrap_or_else(|| "Chart".to_string()),
        width / 2,
        height / 2,
        format!("{:?}", request.chart_type),
        width / 2,
        height / 2 + 30,
        request
            .data
            .series
            .iter()
            .map(|s| s.data.len())
            .sum::<usize>()
    )
}

fn process_raw_data(
    request: &ProcessDataRequest,
) -> Result<ChartData, (StatusCode, Json<VizErrorResponse>)> {
    // In production, apply transformations, aggregations, and filters
    // For now, return a simple transformation

    let series = vec![DataSeries {
        name: "Processed".to_string(),
        data: vec![
            serde_json::json!(10),
            serde_json::json!(25),
            serde_json::json!(15),
            serde_json::json!(30),
            serde_json::json!(20),
        ],
        color: Some("#4CAF50".to_string()),
        series_type: None,
        options: None,
    }];

    Ok(ChartData {
        labels: Some(vec![
            "A".to_string(),
            "B".to_string(),
            "C".to_string(),
            "D".to_string(),
            "E".to_string(),
        ]),
        series,
        x_axis: Some(AxisConfig {
            title: Some("Category".to_string()),
            min: None,
            max: None,
            interval: None,
            format: None,
            show_grid: Some(true),
            log_scale: Some(false),
        }),
        y_axis: Some(AxisConfig {
            title: Some("Value".to_string()),
            min: Some(0.0),
            max: Some(50.0),
            interval: Some(10.0),
            format: None,
            show_grid: Some(true),
            log_scale: Some(false),
        }),
        metadata: None,
    })
}

fn estimate_row_count(data: &serde_json::Value) -> usize {
    if let Some(array) = data.as_array() {
        array.len()
    } else if let Some(obj) = data.as_object() {
        obj.values()
            .next()
            .and_then(|v| v.as_array())
            .map(|a| a.len())
            .unwrap_or(0)
    } else {
        0
    }
}

// ============================================================================
// Router
// ============================================================================

/// Create visualization routes
pub fn create_viz_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/v1/viz/render", post(render_chart))
        .route("/api/v1/viz/data", post(process_data))
        .route("/api/v1/viz/palettes", get(list_palettes))
        .route("/api/v1/viz/export", post(export_chart))
        .route("/api/v1/viz/health", get(viz_health))
}

// Bring IntoParams into scope for utoipa
use utoipa::IntoParams;
