use anyhow::Result;
use canvas_protocol::CanvasEvent;
use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::{Backend, CrosstermBackend},
    layout::{Constraint, Direction, Layout},
    style::{Color, Modifier, Style},
    widgets::{Block, Borders, List, ListItem, Paragraph},
    Frame, Terminal,
};
use std::{io, time::Duration};
use linemux::MuxedLines;
use tokio::sync::mpsc;

struct App {
    events: Vec<CanvasEvent>,
}

impl App {
    fn new() -> App {
        App { events: Vec::new() }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    // setup terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // create app and run it
    let app = App::new();
    let res = run_app(&mut terminal, app).await;

    // restore terminal
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    if let Err(err) = res {
        println!("{:?}", err)
    }

    Ok(())
}

async fn run_app<B: Backend>(terminal: &mut Terminal<B>, mut app: App) -> Result<()> {
    let (tx, mut rx) = mpsc::channel(100);

    // File tailing task
    tokio::spawn(async move {
        let mut lines = MuxedLines::new().expect("Failed to create MuxedLines");
        lines.add_file("/tmp/a2rchitech.canvas.jsonl").await.expect("Failed to add file");

        while let Ok(Some(line)) = lines.next_line().await {
            if let Ok(event) = serde_json::from_str::<CanvasEvent>(line.line()) {
                let _ = tx.send(event).await;
            }
        }
    });

    loop {
        terminal.draw(|f| ui(f, &app))?;

        if event::poll(Duration::from_millis(100))? {
            if let Event::Key(key) = event::read()? {
                if let KeyCode::Char('q') = key.code {
                    return Ok(());
                }
            }
        }

        while let Ok(event) = rx.try_recv() {
            app.events.push(event);
            if app.events.len() > 100 {
                app.events.remove(0);
            }
        }
    }
}

fn ui(f: &mut Frame, app: &App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(3), Constraint::Min(0)].as_ref())
        .split(f.size());

    let title = Paragraph::new("A2rchitech External Monitor (Canvas)")
        .style(Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD))
        .block(Block::default().borders(Borders::ALL));
    f.render_widget(title, chunks[0]);

    let events: Vec<ListItem> = app
        .events
        .iter()
        .rev()
        .map(|e| {
            let color = match e.event_type {
                canvas_protocol::CanvasEventType::Render => Color::Green,
                canvas_protocol::CanvasEventType::Status => Color::Yellow,
                canvas_protocol::CanvasEventType::ToolResult => Color::Blue,
                canvas_protocol::CanvasEventType::Notification => Color::Magenta,
            };
            let content = format!("[{:?}] {}: {}", e.event_type, e.topic, e.payload);
            ListItem::new(content).style(Style::default().fg(color))
        })
        .collect();

    let events_list = List::new(events)
        .block(Block::default().borders(Borders::ALL).title("Canvas Events (latest first)"));
    f.render_widget(events_list, chunks[1]);
}
