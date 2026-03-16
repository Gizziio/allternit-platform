//! API library for visualization rendering

pub mod viz_routes;

pub use viz_routes::{
    AppState,
    ChartDataPoint,
    RenderChartRequest,
    RenderPngResponse,
    RenderSvgResponse,
    VizErrorResponse,
    render_to_png,
    render_to_svg,
    viz_router,
};
