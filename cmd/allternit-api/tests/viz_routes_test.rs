//! Integration tests for visualization routes

use api::viz_routes::{RenderChartRequest, ChartDataPoint, render_to_png, render_to_pdf};

/// PNG signature bytes
const PNG_SIGNATURE: [u8; 8] = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

/// PDF signature bytes (starts with %PDF-)
const PDF_SIGNATURE: &[u8] = b"%PDF-";

#[test]
fn test_render_to_png_produces_valid_png() {
    // Create a simple chart request
    let request = RenderChartRequest {
        chart_type: "bar".to_string(),
        title: Some("Test Chart".to_string()),
        width: 400,
        height: 300,
        data: vec![
            ChartDataPoint { label: "A".to_string(), value: 10.0 },
            ChartDataPoint { label: "B".to_string(), value: 20.0 },
            ChartDataPoint { label: "C".to_string(), value: 15.0 },
        ],
        colors: vec!["#FF6384".to_string(), "#36A2EB".to_string(), "#FFCE56".to_string()],
    };
    
    // Render to PNG
    let result = render_to_png(&request);
    
    // Verify
    assert!(result.is_ok(), "render_to_png should succeed");
    let png_base64 = result.unwrap();
    
    // Decode base64
    let png_data = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, png_base64)
        .expect("Should decode base64 successfully");
    
    // Verify PNG signature (first 8 bytes: 89 50 4E 47 0D 0A 1A 0A)
    assert_eq!(
        &png_data[0..8], 
        &PNG_SIGNATURE,
        "PNG signature should be valid"
    );
    
    // Verify PNG has some content (more than just header)
    assert!(png_data.len() > 100, "PNG should have substantial content");
}

#[test]
fn test_render_to_png_line_chart() {
    let request = RenderChartRequest {
        chart_type: "line".to_string(),
        title: Some("Line Chart".to_string()),
        width: 600,
        height: 400,
        data: vec![
            ChartDataPoint { label: "Jan".to_string(), value: 100.0 },
            ChartDataPoint { label: "Feb".to_string(), value: 150.0 },
            ChartDataPoint { label: "Mar".to_string(), value: 120.0 },
            ChartDataPoint { label: "Apr".to_string(), value: 180.0 },
        ],
        colors: vec!["#4CAF50".to_string()],
    };
    
    let result = render_to_png(&request);
    assert!(result.is_ok());
    
    let png_base64 = result.unwrap();
    let png_data = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, png_base64)
        .expect("Should decode base64");
    
    // Verify PNG signature
    assert_eq!(&png_data[0..8], &PNG_SIGNATURE);
}

#[test]
fn test_render_to_png_pie_chart() {
    let request = RenderChartRequest {
        chart_type: "pie".to_string(),
        title: Some("Distribution".to_string()),
        width: 500,
        height: 500,
        data: vec![
            ChartDataPoint { label: "Category A".to_string(), value: 40.0 },
            ChartDataPoint { label: "Category B".to_string(), value: 30.0 },
            ChartDataPoint { label: "Category C".to_string(), value: 20.0 },
            ChartDataPoint { label: "Category D".to_string(), value: 10.0 },
        ],
        colors: vec![],
    };
    
    let result = render_to_png(&request);
    assert!(result.is_ok());
    
    let png_base64 = result.unwrap();
    let png_data = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, png_base64)
        .expect("Should decode base64");
    
    // Verify PNG signature
    assert_eq!(&png_data[0..8], &PNG_SIGNATURE);
}

#[test]
fn test_render_to_png_empty_data() {
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
    let png_data = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, png_base64)
        .expect("Should decode base64");
    
    // Verify PNG signature
    assert_eq!(&png_data[0..8], &PNG_SIGNATURE);
}

#[test]
fn test_render_to_png_custom_dimensions() {
    let request = RenderChartRequest {
        chart_type: "bar".to_string(),
        title: None,
        width: 1920,
        height: 1080,
        data: vec![ChartDataPoint { label: "X".to_string(), value: 100.0 }],
        colors: vec!["#000000".to_string()],
    };
    
    let result = render_to_png(&request);
    assert!(result.is_ok());
    
    let png_base64 = result.unwrap();
    let png_data = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, png_base64)
        .expect("Should decode base64");
    
    // Verify PNG signature
    assert_eq!(&png_data[0..8], &PNG_SIGNATURE);
}

#[test]
fn test_render_to_png_multiple_colors() {
    let request = RenderChartRequest {
        chart_type: "bar".to_string(),
        title: Some("Multi-color Chart".to_string()),
        width: 800,
        height: 600,
        data: vec![
            ChartDataPoint { label: "1".to_string(), value: 10.0 },
            ChartDataPoint { label: "2".to_string(), value: 20.0 },
            ChartDataPoint { label: "3".to_string(), value: 30.0 },
            ChartDataPoint { label: "4".to_string(), value: 40.0 },
            ChartDataPoint { label: "5".to_string(), value: 50.0 },
        ],
        colors: vec![
            "#FF0000".to_string(),
            "#00FF00".to_string(),
            "#0000FF".to_string(),
            "#FFFF00".to_string(),
            "#FF00FF".to_string(),
        ],
    };

    let result = render_to_png(&request);
    assert!(result.is_ok());

    let png_base64 = result.unwrap();
    let png_data = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, png_base64)
        .expect("Should decode base64");

    // Verify PNG signature
    assert_eq!(&png_data[0..8], &PNG_SIGNATURE);
}

// ==================== PDF Rendering Tests ====================

#[test]
fn test_render_to_pdf_produces_valid_pdf() {
    // Create a simple chart request
    let request = RenderChartRequest {
        chart_type: "bar".to_string(),
        title: Some("Test Chart".to_string()),
        width: 400,
        height: 300,
        data: vec![
            ChartDataPoint { label: "A".to_string(), value: 10.0 },
            ChartDataPoint { label: "B".to_string(), value: 20.0 },
            ChartDataPoint { label: "C".to_string(), value: 15.0 },
        ],
        colors: vec!["#FF6384".to_string(), "#36A2EB".to_string(), "#FFCE56".to_string()],
    };

    // Render to PDF
    let result = render_to_pdf(&request);

    // Verify
    assert!(result.is_ok(), "render_to_pdf should succeed");
    let pdf_base64 = result.unwrap();

    // Decode base64
    let pdf_data = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, pdf_base64)
        .expect("Should decode base64 successfully");

    // Verify PDF signature (starts with %PDF-)
    assert_eq!(
        &pdf_data[0..5],
        PDF_SIGNATURE,
        "PDF signature should be valid (starts with %PDF-)"
    );

    // Verify PDF has some content (more than just header)
    assert!(pdf_data.len() > 100, "PDF should have substantial content");
}

#[test]
fn test_render_to_pdf_line_chart() {
    let request = RenderChartRequest {
        chart_type: "line".to_string(),
        title: Some("Line Chart".to_string()),
        width: 600,
        height: 400,
        data: vec![
            ChartDataPoint { label: "Jan".to_string(), value: 100.0 },
            ChartDataPoint { label: "Feb".to_string(), value: 150.0 },
            ChartDataPoint { label: "Mar".to_string(), value: 120.0 },
            ChartDataPoint { label: "Apr".to_string(), value: 180.0 },
        ],
        colors: vec!["#4CAF50".to_string()],
    };

    let result = render_to_pdf(&request);
    assert!(result.is_ok());

    let pdf_base64 = result.unwrap();
    let pdf_data = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, pdf_base64)
        .expect("Should decode base64");

    // Verify PDF signature
    assert_eq!(&pdf_data[0..5], PDF_SIGNATURE);
}

#[test]
fn test_render_to_pdf_pie_chart() {
    let request = RenderChartRequest {
        chart_type: "pie".to_string(),
        title: Some("Distribution".to_string()),
        width: 500,
        height: 500,
        data: vec![
            ChartDataPoint { label: "Category A".to_string(), value: 40.0 },
            ChartDataPoint { label: "Category B".to_string(), value: 30.0 },
            ChartDataPoint { label: "Category C".to_string(), value: 20.0 },
            ChartDataPoint { label: "Category D".to_string(), value: 10.0 },
        ],
        colors: vec![],
    };

    let result = render_to_pdf(&request);
    assert!(result.is_ok());

    let pdf_base64 = result.unwrap();
    let pdf_data = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, pdf_base64)
        .expect("Should decode base64");

    // Verify PDF signature
    assert_eq!(&pdf_data[0..5], PDF_SIGNATURE);
}

#[test]
fn test_render_to_pdf_empty_data() {
    let request = RenderChartRequest {
        chart_type: "bar".to_string(),
        title: Some("Empty Chart".to_string()),
        width: 400,
        height: 300,
        data: vec![],
        colors: vec![],
    };

    let result = render_to_pdf(&request);
    assert!(result.is_ok());

    let pdf_base64 = result.unwrap();
    let pdf_data = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, pdf_base64)
        .expect("Should decode base64");

    // Verify PDF signature
    assert_eq!(&pdf_data[0..5], PDF_SIGNATURE);
}

#[test]
fn test_render_to_pdf_custom_dimensions() {
    let request = RenderChartRequest {
        chart_type: "bar".to_string(),
        title: None,
        width: 1920,
        height: 1080,
        data: vec![ChartDataPoint { label: "X".to_string(), value: 100.0 }],
        colors: vec!["#000000".to_string()],
    };

    let result = render_to_pdf(&request);
    assert!(result.is_ok());

    let pdf_base64 = result.unwrap();
    let pdf_data = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, pdf_base64)
        .expect("Should decode base64");

    // Verify PDF signature
    assert_eq!(&pdf_data[0..5], PDF_SIGNATURE);
}

#[test]
fn test_render_to_pdf_multiple_colors() {
    let request = RenderChartRequest {
        chart_type: "bar".to_string(),
        title: Some("Multi-color Chart".to_string()),
        width: 800,
        height: 600,
        data: vec![
            ChartDataPoint { label: "1".to_string(), value: 10.0 },
            ChartDataPoint { label: "2".to_string(), value: 20.0 },
            ChartDataPoint { label: "3".to_string(), value: 30.0 },
            ChartDataPoint { label: "4".to_string(), value: 40.0 },
            ChartDataPoint { label: "5".to_string(), value: 50.0 },
        ],
        colors: vec![
            "#FF0000".to_string(),
            "#00FF00".to_string(),
            "#0000FF".to_string(),
            "#FFFF00".to_string(),
            "#FF00FF".to_string(),
        ],
    };

    let result = render_to_pdf(&request);
    assert!(result.is_ok());

    let pdf_base64 = result.unwrap();
    let pdf_data = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, pdf_base64)
        .expect("Should decode base64");

    // Verify PDF signature
    assert_eq!(&pdf_data[0..5], PDF_SIGNATURE);
}

#[test]
fn test_render_to_pdf_large_dataset() {
    // Test with many data points to verify pagination handling
    let mut data = Vec::new();
    for i in 1..=50 {
        data.push(ChartDataPoint {
            label: format!("Item {}", i),
            value: i as f64 * 10.0,
        });
    }

    let request = RenderChartRequest {
        chart_type: "bar".to_string(),
        title: Some("Large Dataset".to_string()),
        width: 800,
        height: 600,
        data,
        colors: vec!["#3498db".to_string()],
    };

    let result = render_to_pdf(&request);
    assert!(result.is_ok());

    let pdf_base64 = result.unwrap();
    let pdf_data = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, pdf_base64)
        .expect("Should decode base64");

    // Verify PDF signature
    assert_eq!(&pdf_data[0..5], PDF_SIGNATURE);
}

#[test]
fn test_render_to_pdf_no_title() {
    let request = RenderChartRequest {
        chart_type: "bar".to_string(),
        title: None,
        width: 400,
        height: 300,
        data: vec![ChartDataPoint { label: "Test".to_string(), value: 50.0 }],
        colors: vec!["#FF0000".to_string()],
    };

    let result = render_to_pdf(&request);
    assert!(result.is_ok());

    let pdf_base64 = result.unwrap();
    let pdf_data = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, pdf_base64)
        .expect("Should decode base64");

    // Verify PDF signature
    assert_eq!(&pdf_data[0..5], PDF_SIGNATURE);
}
