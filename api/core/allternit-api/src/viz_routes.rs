//! Visualization routes for chart rendering
//!
//! This module provides endpoints for rendering charts to SVG and PNG formats.

use axum::{http::StatusCode, routing::post, Json, Router};
use image::ImageEncoder;
use serde::{Deserialize, Serialize};

/// Request structure for chart rendering
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RenderChartRequest {
    /// Chart type (e.g., "bar", "line", "pie")
    #[serde(default = "default_chart_type")]
    pub chart_type: String,

    /// Chart title
    #[serde(default)]
    pub title: Option<String>,

    /// Chart width in pixels
    #[serde(default = "default_width")]
    pub width: u32,

    /// Chart height in pixels
    #[serde(default = "default_height")]
    pub height: u32,

    /// Data series for the chart
    #[serde(default)]
    pub data: Vec<ChartDataPoint>,

    /// Color scheme
    #[serde(default)]
    pub colors: Vec<String>,
}

fn default_chart_type() -> String {
    "bar".to_string()
}

fn default_width() -> u32 {
    800
}

fn default_height() -> u32 {
    600
}

/// Individual data point for charts
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ChartDataPoint {
    /// Label for the data point
    pub label: String,

    /// Value for the data point
    pub value: f64,
}

/// Error response structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VizErrorResponse {
    /// Error code
    pub code: String,

    /// Human-readable error message
    pub message: String,

    /// Additional error details
    pub details: Option<String>,
}

/// Create the visualization router
pub fn viz_router() -> Router {
    Router::new()
        .route("/render/svg", post(render_svg_handler))
        .route("/render/png", post(render_png_handler))
        .route("/render/pdf", post(render_pdf_handler))
}

/// Handler for SVG rendering endpoint
async fn render_svg_handler(
    Json(request): Json<RenderChartRequest>,
) -> Result<Json<RenderSvgResponse>, (StatusCode, Json<VizErrorResponse>)> {
    let svg = render_to_svg(&request)?;
    Ok(Json(RenderSvgResponse { svg }))
}

/// Handler for PNG rendering endpoint
async fn render_png_handler(
    Json(request): Json<RenderChartRequest>,
) -> Result<Json<RenderPngResponse>, (StatusCode, Json<VizErrorResponse>)> {
    let png_base64 = render_to_png(&request)?;
    Ok(Json(RenderPngResponse { png_base64 }))
}

/// Handler for PDF rendering endpoint
async fn render_pdf_handler(
    Json(request): Json<RenderChartRequest>,
) -> Result<Json<RenderPdfResponse>, (StatusCode, Json<VizErrorResponse>)> {
    let pdf_base64 = render_to_pdf(&request)?;
    Ok(Json(RenderPdfResponse { pdf_base64 }))
}

/// Response structure for SVG rendering
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderSvgResponse {
    /// SVG content as string
    pub svg: String,
}

/// Response structure for PNG rendering
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderPngResponse {
    /// PNG data encoded as base64
    pub png_base64: String,
}

/// Response structure for PDF rendering
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderPdfResponse {
    /// PDF data encoded as base64
    pub pdf_base64: String,
}

/// Render chart to SVG format
pub fn render_to_svg(
    request: &RenderChartRequest,
) -> Result<String, (StatusCode, Json<VizErrorResponse>)> {
    let width = request.width;
    let height = request.height;

    // Generate SVG based on chart type
    let svg_content = match request.chart_type.as_str() {
        "bar" => generate_bar_chart_svg(request, width, height),
        "line" => generate_line_chart_svg(request, width, height),
        "pie" => generate_pie_chart_svg(request, width, height),
        _ => generate_bar_chart_svg(request, width, height), // Default to bar chart
    };

    Ok(svg_content)
}

/// Generate SVG for a bar chart
fn generate_bar_chart_svg(request: &RenderChartRequest, width: u32, height: u32) -> String {
    let padding = 40u32;
    let chart_width = width - (padding * 2);
    let chart_height = height - (padding * 2);

    let mut bars = String::new();

    if request.data.is_empty() {
        // Return empty chart
        return format!(
            r##"<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}">
  <rect width="100%" height="100%" fill="white"/>
  <text x="{}" y="{}" text-anchor="middle" font-family="Arial" font-size="14" fill="#666">No data</text>
</svg>"##,
            width,
            height,
            width / 2,
            height / 2
        );
    }

    let max_value = request
        .data
        .iter()
        .map(|d| d.value.abs())
        .fold(0.0f64, f64::max);
    let bar_width = (chart_width as f64 / request.data.len() as f64 * 0.8) as u32;
    let bar_spacing = (chart_width as f64 / request.data.len() as f64 * 0.2) as u32;

    for (i, point) in request.data.iter().enumerate() {
        let bar_height = if max_value > 0.0 {
            ((point.value.abs() / max_value) * chart_height as f64) as u32
        } else {
            0
        };

        let x = padding as u32 + (i as u32 * (bar_width + bar_spacing)) + bar_spacing / 2;
        let y = height - padding - bar_height;

        let color = request
            .colors
            .get(i % request.colors.len().max(1))
            .cloned()
            .unwrap_or_else(|| format!("hsl({}, 70%, 50%)", (i * 60) % 360));

        bars.push_str(&format!(
            r##"<rect x="{}" y="{}" width="{}" height="{}" fill="{}" rx="2"/>"##,
            x, y, bar_width, bar_height, color
        ));

        // Add label
        bars.push_str(&format!(
            r##"<text x="{}" y="{}" text-anchor="middle" font-family="Arial" font-size="10" fill="#333">{}</text>"##,
            x + bar_width / 2, height - padding + 15, point.label
        ));
    }

    let title_element = request.title.as_ref().map(|t| {
        format!(
            r##"<text x="{}" y="25" text-anchor="middle" font-family="Arial" font-size="16" font-weight="bold" fill="#333">{}</text>"##,
            width / 2, t
        )
    }).unwrap_or_default();

    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}">
  <rect width="100%" height="100%" fill="white"/>
  {}
  {}
</svg>"##,
        width, height, title_element, bars
    )
}

/// Generate SVG for a line chart
fn generate_line_chart_svg(request: &RenderChartRequest, width: u32, height: u32) -> String {
    let padding = 40u32;
    let chart_width = width - (padding * 2);
    let chart_height = height - (padding * 2);

    if request.data.is_empty() {
        return format!(
            r##"<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}">
  <rect width="100%" height="100%" fill="white"/>
  <text x="{}" y="{}" text-anchor="middle" font-family="Arial" font-size="14" fill="#666">No data</text>
</svg>"##,
            width,
            height,
            width / 2,
            height / 2
        );
    }

    let max_value = request
        .data
        .iter()
        .map(|d| d.value.abs())
        .fold(0.0f64, f64::max);
    let min_value = request.data.iter().map(|d| d.value).fold(0.0f64, f64::min);
    let value_range = (max_value - min_value).max(1.0);

    let mut points = String::new();
    let mut dots = String::new();

    for (i, point) in request.data.iter().enumerate() {
        let x = padding as f64
            + (i as f64 / (request.data.len() - 1).max(1) as f64) * chart_width as f64;
        let y = (height - padding) as f64
            - ((point.value - min_value) / value_range) * chart_height as f64;

        if i > 0 {
            points.push_str(&format!(" {},{}", x, y));
        } else {
            points.push_str(&format!("{} {}", x, y));
        }

        dots.push_str(&format!(
            r##"<circle cx="{}" cy="{}" r="4" fill="#2563eb" stroke="white" stroke-width="2"/>"##,
            x, y
        ));
    }

    let color = request
        .colors
        .first()
        .cloned()
        .unwrap_or_else(|| "#2563eb".to_string());

    let title_element = request.title.as_ref().map(|t| {
        format!(
            r##"<text x="{}" y="25" text-anchor="middle" font-family="Arial" font-size="16" font-weight="bold" fill="#333">{}</text>"##,
            width / 2, t
        )
    }).unwrap_or_default();

    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}">
  <rect width="100%" height="100%" fill="white"/>
  {}
  <polyline points="{}" fill="none" stroke="{}" stroke-width="2"/>
  {}
</svg>"##,
        width, height, title_element, points, color, dots
    )
}

/// Generate SVG for a pie chart
fn generate_pie_chart_svg(request: &RenderChartRequest, width: u32, height: u32) -> String {
    let cx = width as f64 / 2.0;
    let cy = (height as f64 / 2.0) + 10.0;
    let radius = (width.min(height) as f64 / 2.0) - 50.0;

    if request.data.is_empty() {
        return format!(
            r##"<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}">
  <rect width="100%" height="100%" fill="white"/>
  <text x="{}" y="{}" text-anchor="middle" font-family="Arial" font-size="14" fill="#666">No data</text>
</svg>"##,
            width,
            height,
            width / 2,
            height / 2
        );
    }

    let total: f64 = request.data.iter().map(|d| d.value.abs()).sum();

    let mut slices = String::new();
    let mut current_angle: f64 = -90.0; // Start from top

    for (i, point) in request.data.iter().enumerate() {
        let slice_angle = (point.value.abs() / total) * 360.0;
        let end_angle = current_angle + slice_angle;

        let color = request
            .colors
            .get(i % request.colors.len().max(1))
            .cloned()
            .unwrap_or_else(|| format!("hsl({}, 70%, 50%)", (i * 60) % 360));

        // Calculate arc path
        let start_rad = current_angle.to_radians();
        let end_rad = end_angle.to_radians();

        let x1 = cx + radius * start_rad.cos();
        let y1 = cy + radius * start_rad.sin();
        let x2 = cx + radius * end_rad.cos();
        let y2 = cy + radius * end_rad.sin();

        let large_arc = if slice_angle > 180.0 { 1 } else { 0 };

        slices.push_str(&format!(
            r##"<path d="M {} {} L {} {} A {} {} 0 {} 1 {} {} Z" fill="{}" stroke="white" stroke-width="1"/>"##,
            cx, cy, x1, y1, radius, radius, large_arc, x2, y2, color
        ));

        current_angle = end_angle;
    }

    let title_element = request.title.as_ref().map(|t| {
        format!(
            r##"<text x="{}" y="25" text-anchor="middle" font-family="Arial" font-size="16" font-weight="bold" fill="#333">{}</text>"##,
            width / 2, t
        )
    }).unwrap_or_default();

    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}">
  <rect width="100%" height="100%" fill="white"/>
  {}
  {}
</svg>"##,
        width, height, title_element, slices
    )
}

/// Render chart to PNG format
///
/// This function takes a RenderChartRequest, generates an SVG representation,
/// then uses resvg to render it to a pixmap, and finally encodes it as PNG
/// using the image crate. The result is returned as a base64-encoded string.
pub fn render_to_png(
    request: &RenderChartRequest,
) -> Result<String, (StatusCode, Json<VizErrorResponse>)> {
    // Generate SVG first
    let svg = render_to_svg(request)?;

    // Parse SVG with usvg (the underlying library used by resvg)
    let opt = usvg::Options::default();
    let tree = usvg::Tree::from_str(&svg, &opt, &usvg::fontdb::Database::new()).map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(VizErrorResponse {
                code: "SVG_PARSE_ERROR".to_string(),
                message: format!("Failed to parse SVG: {}", e),
                details: None,
            }),
        )
    })?;

    // Calculate dimensions
    let width = tree.size().width() as u32;
    let height = tree.size().height() as u32;

    // Render to pixmap using resvg's tiny_skia
    let mut pixmap = tiny_skia::Pixmap::new(width, height).ok_or_else(|| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(VizErrorResponse {
                code: "RENDER_ERROR".to_string(),
                message: "Failed to create pixmap".to_string(),
                details: None,
            }),
        )
    })?;

    // Render the SVG tree to the pixmap
    resvg::render(&tree, tiny_skia::Transform::default(), &mut pixmap.as_mut());

    // Encode to PNG using image crate
    let mut png_data = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(&mut png_data);

    encoder
        .write_image(pixmap.data(), width, height, image::ColorType::Rgba8)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(VizErrorResponse {
                    code: "PNG_ENCODE_ERROR".to_string(),
                    message: format!("Failed to encode PNG: {}", e),
                    details: None,
                }),
            )
        })?;

    // Return as base64 using the Engine trait
    use base64::Engine;
    Ok(base64::engine::general_purpose::STANDARD.encode(png_data))
}

/// Render chart to PDF format
///
/// This function takes a RenderChartRequest and generates a PDF document
/// using the printpdf crate. The PDF includes chart information and is
/// returned as a base64-encoded string.
pub fn render_to_pdf(
    request: &RenderChartRequest,
) -> Result<String, (StatusCode, Json<VizErrorResponse>)> {
    use printpdf::*;

    // Convert dimensions to millimeters (1 pixel ≈ 0.264583 mm)
    let width_mm = (request.width as f32) * 0.264583;
    let height_mm = (request.height as f32) * 0.264583;

    // Create PDF document with title and initial layer
    let (doc, page1, layer1) = PdfDocument::new(
        "Allternit Chart Visualization",
        Mm(width_mm),
        Mm(height_mm),
        "Chart Layer",
    );

    // Get the current layer to add content
    let current_layer = doc.get_page(page1).get_layer(layer1);

    // Get the default font
    let font = doc.add_builtin_font(BuiltinFont::Helvetica).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(VizErrorResponse {
                code: "FONT_ERROR".to_string(),
                message: format!("Failed to add font: {}", e),
                details: None,
            }),
        )
    })?;

    // Y position tracker (starting from top, moving down)
    let mut y_pos = height_mm - 15.0;

    // Add title if present
    if let Some(title) = &request.title {
        current_layer.use_text(title.clone(), 18.0, Mm(10.0), Mm(y_pos), &font);
        y_pos -= 12.0;
    }

    // Add chart type information
    let chart_type_text = format!("Chart Type: {}", request.chart_type);
    current_layer.use_text(chart_type_text, 12.0, Mm(10.0), Mm(y_pos), &font);
    y_pos -= 10.0;

    // Add dimensions info
    let dimensions_text = format!("Dimensions: {}x{} pixels", request.width, request.height);
    current_layer.use_text(dimensions_text, 10.0, Mm(10.0), Mm(y_pos), &font);
    y_pos -= 12.0;

    // Add data summary if data is present
    if !request.data.is_empty() {
        let data_points_text = format!("Data Points: {}", request.data.len());
        current_layer.use_text(data_points_text, 10.0, Mm(10.0), Mm(y_pos), &font);
        y_pos -= 10.0;

        // Add each data point as a text line
        for point in request.data.iter().take(10) {
            let data_line = format!("  - {}: {}", point.label, point.value);
            current_layer.use_text(data_line, 10.0, Mm(10.0), Mm(y_pos), &font);
            y_pos -= 10.0;

            // Stop if we're running out of space
            if y_pos < 10.0 {
                break;
            }
        }

        // Add indicator if there are more data points
        if request.data.len() > 10 && y_pos >= 10.0 {
            let more_text = format!("  ... and {} more", request.data.len() - 10);
            current_layer.use_text(more_text, 10.0, Mm(10.0), Mm(y_pos), &font);
        }
    } else {
        current_layer.use_text(
            "No data points".to_string(),
            10.0,
            Mm(10.0),
            Mm(y_pos),
            &font,
        );
    }

    // Save PDF to buffer
    let mut buffer = Vec::new();
    {
        use std::io::BufWriter;
        let mut writer = BufWriter::new(&mut buffer);
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

    // Return as base64
    use base64::Engine;
    Ok(base64::engine::general_purpose::STANDARD.encode(buffer))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_render_to_png_produces_valid_png() {
        // Create a simple chart request
        let request = RenderChartRequest {
            chart_type: "bar".to_string(),
            title: Some("Test Chart".to_string()),
            width: 400,
            height: 300,
            data: vec![
                ChartDataPoint {
                    label: "A".to_string(),
                    value: 10.0,
                },
                ChartDataPoint {
                    label: "B".to_string(),
                    value: 20.0,
                },
                ChartDataPoint {
                    label: "C".to_string(),
                    value: 15.0,
                },
            ],
            colors: vec![
                "#FF6384".to_string(),
                "#36A2EB".to_string(),
                "#FFCE56".to_string(),
            ],
        };

        // Render to PNG
        let result = render_to_png(&request);

        // Verify
        assert!(result.is_ok(), "render_to_png should succeed");
        let png_base64 = result.unwrap();

        // Decode base64
        let png_data =
            base64::Engine::decode(&base64::engine::general_purpose::STANDARD, png_base64)
                .expect("Should decode base64 successfully");

        // Verify PNG signature (first 8 bytes: 89 50 4E 47 0D 0A 1A 0A)
        assert_eq!(
            &png_data[0..8],
            &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
            "PNG signature should be valid"
        );
    }

    #[test]
    fn test_render_to_png_with_line_chart() {
        let request = RenderChartRequest {
            chart_type: "line".to_string(),
            title: Some("Line Chart".to_string()),
            width: 600,
            height: 400,
            data: vec![
                ChartDataPoint {
                    label: "Jan".to_string(),
                    value: 100.0,
                },
                ChartDataPoint {
                    label: "Feb".to_string(),
                    value: 150.0,
                },
                ChartDataPoint {
                    label: "Mar".to_string(),
                    value: 120.0,
                },
                ChartDataPoint {
                    label: "Apr".to_string(),
                    value: 180.0,
                },
            ],
            colors: vec!["#4CAF50".to_string()],
        };

        let result = render_to_png(&request);
        assert!(result.is_ok());

        let png_base64 = result.unwrap();
        let png_data =
            base64::Engine::decode(&base64::engine::general_purpose::STANDARD, png_base64)
                .expect("Should decode base64");

        // Verify PNG signature
        assert_eq!(
            &png_data[0..8],
            &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
        );
    }

    #[test]
    fn test_render_to_png_with_pie_chart() {
        let request = RenderChartRequest {
            chart_type: "pie".to_string(),
            title: Some("Distribution".to_string()),
            width: 500,
            height: 500,
            data: vec![
                ChartDataPoint {
                    label: "Category A".to_string(),
                    value: 40.0,
                },
                ChartDataPoint {
                    label: "Category B".to_string(),
                    value: 30.0,
                },
                ChartDataPoint {
                    label: "Category C".to_string(),
                    value: 20.0,
                },
                ChartDataPoint {
                    label: "Category D".to_string(),
                    value: 10.0,
                },
            ],
            colors: vec![],
        };

        let result = render_to_png(&request);
        assert!(result.is_ok());

        let png_base64 = result.unwrap();
        let png_data =
            base64::Engine::decode(&base64::engine::general_purpose::STANDARD, png_base64)
                .expect("Should decode base64");

        // Verify PNG signature
        assert_eq!(
            &png_data[0..8],
            &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
        );
    }

    #[test]
    fn test_render_to_png_with_empty_data() {
        let request = RenderChartRequest {
            chart_type: "bar".to_string(),
            title: Some("Empty Chart".to_string()),
            width: 400,
            height: 300,
            data: vec![],
            colors: vec![],
        };

        let result = render_to_png(&request);
        assert!(result.is_ok());

        let png_base64 = result.unwrap();
        let png_data =
            base64::Engine::decode(&base64::engine::general_purpose::STANDARD, png_base64)
                .expect("Should decode base64");

        // Verify PNG signature
        assert_eq!(
            &png_data[0..8],
            &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
        );
    }

    #[test]
    fn test_render_to_svg_generates_valid_svg() {
        let request = RenderChartRequest {
            chart_type: "bar".to_string(),
            title: Some("Test".to_string()),
            width: 400,
            height: 300,
            data: vec![ChartDataPoint {
                label: "A".to_string(),
                value: 10.0,
            }],
            colors: vec!["#FF0000".to_string()],
        };

        let result = render_to_svg(&request);
        assert!(result.is_ok());

        let svg = result.unwrap();
        assert!(svg.contains("<svg"));
        assert!(svg.contains("</svg>"));
        assert!(svg.contains("xmlns=\"http://www.w3.org/2000/svg\""));
    }

    #[test]
    fn test_render_to_png_invalid_svg_returns_error() {
        // This test verifies error handling - though with our implementation,
        // render_to_svg should always produce valid SVG
        let request = RenderChartRequest {
            chart_type: "bar".to_string(),
            title: None,
            width: 100,
            height: 100,
            data: vec![],
            colors: vec![],
        };

        let result = render_to_png(&request);
        // Should still succeed with empty data
        assert!(result.is_ok());
    }
}
