use crate::models::{Asset, AssetRatingSummary, AssetSearchFilters, AssetSortBy, CategoryTree};
use crate::service::MarketplaceService;
use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyEvent},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::CrosstermBackend,
    layout::{Alignment, Constraint, Direction, Layout, Margin},
    style::{Color, Modifier, Style},
    text::{Line, Span, Text},
    widgets::{
        Block, Borders, Cell, Clear, Gauge, List, ListItem, ListState, Paragraph, Row, Table,
        TableState, Tabs, Wrap,
    },
    Frame, Terminal,
};
use std::io;
use std::time::{Duration, Instant};
use tokio::time::sleep;

#[derive(PartialEq, Clone, Copy)]
pub enum InputMode {
    Normal,
    Searching,
    Filtering,
}

#[derive(PartialEq, Clone, Copy)]
pub enum ActiveTab {
    Assets,
    Categories,
    Publishers,
}

#[derive(PartialEq, Clone, Copy)]
pub enum ActivePane {
    AssetList,
    AssetDetails,
    Filters,
}

pub struct MarketplaceTui {
    pub service: MarketplaceService,
    pub assets: Vec<Asset>,
    pub categories: Vec<CategoryTree>,
    pub current_filters: AssetSearchFilters,
    pub active_tab: ActiveTab,
    pub active_pane: ActivePane,
    pub input_mode: InputMode,
    pub search_query: String,
    pub asset_list_state: ListState,
    pub asset_details_state: TableState,
    pub category_state: ListState,
    pub selected_asset: Option<Asset>,
    pub selected_asset_rating: Option<AssetRatingSummary>,
    pub status_msg: String,
    pub should_quit: bool,
    pub is_loading: bool,
    pub loading_progress: f64,
    pub last_update: Instant,
}

impl MarketplaceTui {
    pub fn new(service: MarketplaceService) -> Self {
        let mut asset_list_state = ListState::default();
        asset_list_state.select(Some(0));

        let mut category_state = ListState::default();
        category_state.select(Some(0));

        Self {
            service,
            assets: Vec::new(),
            categories: Vec::new(),
            current_filters: AssetSearchFilters::default(),
            active_tab: ActiveTab::Assets,
            active_pane: ActivePane::AssetList,
            input_mode: InputMode::Normal,
            search_query: String::new(),
            asset_list_state,
            asset_details_state: TableState::default(),
            category_state,
            selected_asset: None,
            selected_asset_rating: None,
            status_msg: "Press 's' to search, 'f' to filter, 'q' to quit".to_string(),
            should_quit: false,
            is_loading: false,
            loading_progress: 0.0,
            last_update: Instant::now(),
        }
    }

    pub async fn refresh_data(&mut self) {
        if self.is_loading {
            return;
        }

        self.is_loading = true;
        self.loading_progress = 0.0;
        self.status_msg = "Loading marketplace data...".to_string();

        for i in 1..=10 {
            self.loading_progress = i as f64 / 10.0;
            tokio::time::sleep(Duration::from_millis(50)).await;
        }

        match self.service.search_assets(&self.current_filters).await {
            Ok(result) => {
                self.assets = result.assets;
                self.status_msg = format!("Loaded {} assets", self.assets.len());
            }
            Err(e) => {
                self.status_msg = format!("Error loading assets: {}", e);
            }
        }

        if let Ok(categories) = self.service.get_category_tree().await {
            self.categories = categories;
        }

        self.is_loading = false;
        self.last_update = Instant::now();

        if !self.assets.is_empty() {
            self.asset_list_state.select(Some(0));
            if let Some(index) = self.asset_list_state.selected() {
                self.selected_asset = self.assets.get(index).cloned();
            }
        }
    }

    pub async fn apply_search(&mut self) {
        if self.search_query.is_empty() {
            self.current_filters.query = None;
        } else {
            self.current_filters.query = Some(self.search_query.clone());
        }
        self.refresh_data().await;
    }

    pub async fn on_tick(&mut self) {
        if self.last_update.elapsed() > Duration::from_secs(30) {
            self.refresh_data().await;
        }
    }

    pub async fn handle_input(&mut self, key: KeyEvent) {
        match self.input_mode {
            InputMode::Normal => self.handle_normal_input(key).await,
            InputMode::Searching => self.handle_search_input(key).await,
            InputMode::Filtering => self.handle_filter_input(key).await,
        }
    }

    async fn handle_normal_input(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Char('q') => self.should_quit = true,
            KeyCode::Char('s') => {
                self.input_mode = InputMode::Searching;
                self.status_msg = "Enter search query (ESC to cancel, ENTER to search)".to_string();
            }
            KeyCode::Char('f') => {
                self.input_mode = InputMode::Filtering;
                self.status_msg = "Filter mode: Use arrow keys to adjust filters".to_string();
            }
            KeyCode::Char('r') => {
                self.status_msg = "Refreshing data...".to_string();
                self.refresh_data().await;
            }
            KeyCode::Char('t') => {
                self.current_filters.sort_by = match self.current_filters.sort_by {
                    None => Some(AssetSortBy::Relevance),
                    Some(AssetSortBy::Relevance) => Some(AssetSortBy::MostDownloads),
                    Some(AssetSortBy::MostDownloads) => Some(AssetSortBy::HighestRated),
                    Some(AssetSortBy::HighestRated) => Some(AssetSortBy::MostReviews),
                    Some(AssetSortBy::MostReviews) => Some(AssetSortBy::Newest),
                    Some(AssetSortBy::Newest) => Some(AssetSortBy::Oldest),
                    Some(AssetSortBy::Oldest) => Some(AssetSortBy::Relevance),
                };
                self.status_msg = format!("Sorted by: {:?}", self.current_filters.sort_by);
                self.refresh_data().await;
            }
            KeyCode::Tab => {
                self.active_tab = match self.active_tab {
                    ActiveTab::Assets => ActiveTab::Categories,
                    ActiveTab::Categories => ActiveTab::Publishers,
                    ActiveTab::Publishers => ActiveTab::Assets,
                };
            }
            KeyCode::Down => {
                if self.active_tab == ActiveTab::Assets {
                    let i = match self.asset_list_state.selected() {
                        Some(i) => {
                            if i < self.assets.len().saturating_sub(1) {
                                i + 1
                            } else {
                                0
                            }
                        }
                        None => 0,
                    };
                    self.asset_list_state.select(Some(i));
                    if let Some(index) = self.asset_list_state.selected() {
                        self.selected_asset = self.assets.get(index).cloned();
                        if let Some(asset) = &self.selected_asset {
                            if let Ok(rating) =
                                self.service.get_rating_summary(&asset.asset_id).await
                            {
                                self.selected_asset_rating = Some(rating);
                            }
                        }
                    }
                } else if self.active_tab == ActiveTab::Categories {
                    let i = match self.category_state.selected() {
                        Some(i) => {
                            if i < self.categories.len().saturating_sub(1) {
                                i + 1
                            } else {
                                0
                            }
                        }
                        None => 0,
                    };
                    self.category_state.select(Some(i));
                    if let Some(cat) = self.categories.get(i) {
                        self.current_filters.category_id = Some(cat.slug.clone());
                        self.status_msg = format!("Filtering by category: {}", cat.name);
                        self.refresh_data().await;
                    }
                }
            }
            KeyCode::Up => {
                if self.active_tab == ActiveTab::Assets {
                    let i = match self.asset_list_state.selected() {
                        Some(i) => {
                            if i > 0 {
                                i - 1
                            } else {
                                self.assets.len().saturating_sub(1)
                            }
                        }
                        None => 0,
                    };
                    self.asset_list_state.select(Some(i));
                    if let Some(index) = self.asset_list_state.selected() {
                        self.selected_asset = self.assets.get(index).cloned();
                        if let Some(asset) = &self.selected_asset {
                            if let Ok(rating) =
                                self.service.get_rating_summary(&asset.asset_id).await
                            {
                                self.selected_asset_rating = Some(rating);
                            }
                        }
                    }
                } else if self.active_tab == ActiveTab::Categories {
                    let i = match self.category_state.selected() {
                        Some(i) => {
                            if i > 0 {
                                i - 1
                            } else {
                                self.categories.len().saturating_sub(1)
                            }
                        }
                        None => 0,
                    };
                    self.category_state.select(Some(i));
                }
            }
            KeyCode::Left | KeyCode::Right => if self.active_tab == ActiveTab::Publishers {},
            KeyCode::Esc => {
                self.current_filters = AssetSearchFilters::default();
                self.search_query.clear();
                self.status_msg = "Filters cleared".to_string();
                self.refresh_data().await;
            }
            KeyCode::Enter => {
                if let Some(asset) = &self.selected_asset {
                    self.status_msg = format!("Selected: {} - Press 'd' to download", asset.name);
                }
            }
            KeyCode::Char('d') => {
                if let Some(asset) = &self.selected_asset {
                    self.status_msg = format!("Downloading {}...", asset.name);
                    tokio::time::sleep(Duration::from_millis(500)).await;
                    self.status_msg = format!("✓ Downloaded {} successfully!", asset.name);
                }
            }
            _ => {}
        }
    }

    async fn handle_search_input(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Enter => {
                self.apply_search().await;
                self.input_mode = InputMode::Normal;
                self.status_msg = format!("Found {} assets", self.assets.len());
            }
            KeyCode::Char(c) => {
                self.search_query.push(c);
            }
            KeyCode::Backspace => {
                self.search_query.pop();
            }
            KeyCode::Esc => {
                self.input_mode = InputMode::Normal;
                self.status_msg = "Search cancelled".to_string();
            }
            _ => {}
        }
    }

    async fn handle_filter_input(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Esc => {
                self.input_mode = InputMode::Normal;
                self.status_msg = "Filter mode exited".to_string();
            }
            KeyCode::Char('1') => {
                self.current_filters.asset_type = Some("capsule".to_string());
                self.status_msg = "Filter: Capsules only".to_string();
                self.refresh_data().await;
            }
            KeyCode::Char('2') => {
                self.current_filters.asset_type = Some("agent".to_string());
                self.status_msg = "Filter: Agents only".to_string();
                self.refresh_data().await;
            }
            KeyCode::Char('3') => {
                self.current_filters.asset_type = Some("pack".to_string());
                self.status_msg = "Filter: Packs only".to_string();
                self.refresh_data().await;
            }
            KeyCode::Char('0') => {
                self.current_filters.asset_type = None;
                self.status_msg = "Filter: All types".to_string();
                self.refresh_data().await;
            }
            KeyCode::Char('+') => {
                if let Some(min_downloads) = &mut self.current_filters.min_downloads {
                    *min_downloads = min_downloads.saturating_add(100);
                } else {
                    self.current_filters.min_downloads = Some(100);
                }
                self.status_msg = format!(
                    "Min downloads: {}",
                    self.current_filters.min_downloads.unwrap_or(0)
                );
                self.refresh_data().await;
            }
            KeyCode::Char('-') => {
                if let Some(min_downloads) = &mut self.current_filters.min_downloads {
                    *min_downloads = min_downloads.saturating_sub(100);
                    if *min_downloads == 0 {
                        self.current_filters.min_downloads = None;
                    }
                }
                self.status_msg = format!(
                    "Min downloads: {}",
                    self.current_filters.min_downloads.unwrap_or(0)
                );
                self.refresh_data().await;
            }
            _ => {}
        }
    }
}

pub async fn run_marketplace_tui(service: MarketplaceService) -> anyhow::Result<()> {
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let mut app = MarketplaceTui::new(service);
    app.refresh_data().await;

    let tick_rate = Duration::from_millis(100);
    let mut last_tick = Instant::now();

    loop {
        terminal.draw(|f| ui(f, &app))?;

        let timeout = tick_rate
            .checked_sub(last_tick.elapsed())
            .unwrap_or_else(|| Duration::from_secs(0));

        if event::poll(timeout)? {
            if let Event::Key(key) = event::read()? {
                app.handle_input(key).await;
            }
        }

        if last_tick.elapsed() >= tick_rate {
            app.on_tick().await;
            last_tick = Instant::now();
        }

        if app.should_quit {
            break;
        }
    }

    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    Ok(())
}

fn ui(f: &mut Frame, app: &MarketplaceTui) {
    if app.is_loading {
        let area = f.size();
        let block = Block::default()
            .title(" Loading Marketplace ")
            .borders(Borders::ALL);
        f.render_widget(Clear, area);
        f.render_widget(block, area);

        let gauge = Gauge::default()
            .block(Block::default())
            .gauge_style(Style::default().fg(Color::Cyan).bg(Color::DarkGray))
            .percent((app.loading_progress * 100.0) as u16)
            .label(format!("Loading... {:.0}%", app.loading_progress * 100.0));

        let centered = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(1),
                Constraint::Length(3),
                Constraint::Length(1),
            ])
            .split(area);

        f.render_widget(gauge, centered[1]);
        return;
    }

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Min(10),
            Constraint::Length(3),
        ])
        .split(f.size());

    let titles = vec!["Assets", "Categories", "Publishers"];
    let tabs = Tabs::new(titles)
        .block(Block::default().borders(Borders::ALL))
        .style(Style::default().fg(Color::White))
        .highlight_style(
            Style::default()
                .fg(Color::Cyan)
                .add_modifier(Modifier::BOLD),
        )
        .divider(Span::raw(" | "))
        .select(match app.active_tab {
            ActiveTab::Assets => 0,
            ActiveTab::Categories => 1,
            ActiveTab::Publishers => 2,
        });
    f.render_widget(tabs, chunks[0]);

    match app.active_tab {
        ActiveTab::Assets => draw_assets_tab(f, app, chunks[1]),
        ActiveTab::Categories => draw_categories_tab(f, app, chunks[1]),
        ActiveTab::Publishers => draw_publishers_tab(f, app, chunks[1]),
    }

    let status_style = match app.input_mode {
        InputMode::Normal => Style::default().fg(Color::White),
        InputMode::Searching => Style::default().fg(Color::Yellow),
        InputMode::Filtering => Style::default().fg(Color::Green),
    };

    let status_text = match app.input_mode {
        InputMode::Normal => format!(
            " {} | [Tab] Switch Tab | [s] Search | [f] Filter | [r] Refresh | [t] Sort | [d] Download | [q] Quit",
            app.status_msg
        ),
        InputMode::Searching => format!(" > {} (ESC to cancel, ENTER to search)", app.search_query),
        InputMode::Filtering => {
            " > Filter: [1] Capsules [2] Agents [3] Packs [0] All [+/-] Downloads (ESC to exit)".to_string()
        }
    };

    let status_bar = Paragraph::new(status_text)
        .style(status_style)
        .block(Block::default().borders(Borders::ALL).title(" Status "));
    f.render_widget(status_bar, chunks[2]);
}

fn draw_assets_tab(f: &mut Frame, app: &MarketplaceTui, area: ratatui::layout::Rect) {
    let chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(40), Constraint::Percentage(60)])
        .split(area);

    let asset_items: Vec<ListItem> = app
        .assets
        .iter()
        .map(|asset| {
            let rating_summary = if let Some(selected_asset) = &app.selected_asset {
                if selected_asset.asset_id == asset.asset_id {
                    app.selected_asset_rating.clone()
                } else {
                    None
                }
            } else {
                None
            };

            let rating_display = if let Some(rating) = &rating_summary {
                let filled_stars = "★".repeat(rating.average_rating.round() as usize);
                let empty_star_count = (5 as f64 - rating.average_rating.round()).max(0.0) as usize;
                let empty_stars = "☆".repeat(empty_star_count);
                let stars = format!("{}{}", filled_stars, empty_stars);

                let rating_color = if rating.average_rating >= 4.5 {
                    Color::Green
                } else if rating.average_rating >= 3.5 {
                    Color::Yellow
                } else if rating.average_rating >= 2.5 {
                    Color::LightRed
                } else {
                    Color::Red
                };

                Span::styled(
                    format!(" {} ({:.1})", stars, rating.average_rating),
                    Style::default().fg(rating_color),
                )
            } else {
                Span::styled(" (N/A)", Style::default().fg(Color::DarkGray))
            };

            let type_badge = match asset.asset_type.as_str() {
                "capsule" => "📦",
                "agent" => "🤖",
                "pack" => "📦",
                _ => "📄",
            };

            let line = Line::from(vec![
                Span::styled(type_badge, Style::default().fg(Color::White)),
                Span::raw(" "),
                Span::styled(
                    &asset.name,
                    Style::default()
                        .fg(Color::Cyan)
                        .add_modifier(Modifier::BOLD),
                ),
                Span::raw(" "),
                rating_display,
                Span::raw(" "),
                Span::styled(
                    format!("↓{}", asset.downloads),
                    Style::default().fg(Color::DarkGray),
                ),
            ]);

            ListItem::new(line)
        })
        .collect();

    let asset_list = List::new(asset_items)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title(format!(" Assets ({}) ", app.assets.len()))
                .border_style(Style::default().fg(Color::Cyan)),
        )
        .highlight_style(
            Style::default()
                .bg(Color::DarkGray)
                .add_modifier(Modifier::BOLD),
        )
        .highlight_symbol("► ");

    f.render_stateful_widget(asset_list, chunks[0], &mut app.asset_list_state.clone());

    let details_text = if let Some(asset) = &app.selected_asset {
        let rating_info = if let Some(rating) = &app.selected_asset_rating {
            let stars = "★".repeat(rating.average_rating.round() as usize);
            format!(
                "{} ({:.1}/5.0, {} votes)",
                stars, rating.average_rating, rating.total_ratings
            )
        } else {
            "N/A".to_string()
        };

        let lines = vec![
            Line::from(vec![
                Span::styled("Name: ", Style::default().fg(Color::Cyan)),
                Span::raw(asset.name.clone()),
            ]),
            Line::from(vec![
                Span::styled("Type: ", Style::default().fg(Color::Cyan)),
                Span::raw(asset.asset_type.clone()),
            ]),
            Line::from(vec![
                Span::styled("Author: ", Style::default().fg(Color::Cyan)),
                Span::raw(asset.author.clone()),
            ]),
            Line::from(vec![
                Span::styled("Version: ", Style::default().fg(Color::Cyan)),
                Span::raw(asset.version.clone()),
            ]),
            Line::from(vec![
                Span::styled("Rating: ", Style::default().fg(Color::Cyan)),
                Span::raw(rating_info),
            ]),
            Line::from(vec![
                Span::styled("Downloads: ", Style::default().fg(Color::Cyan)),
                Span::raw(format!("{}", asset.downloads)),
            ]),
            Line::from(vec![
                Span::styled("Trust Tier: ", Style::default().fg(Color::Cyan)),
                Span::styled(
                    asset.trust_tier.clone(),
                    trust_tier_color(&asset.trust_tier),
                ),
            ]),
            Line::from(""),
            Line::from(vec![
                Span::styled("Description: ", Style::default().fg(Color::Cyan)),
                Span::raw(asset.description.clone()),
            ]),
        ];

        Text::from(lines)
    } else {
        Text::from("Select an asset to view details")
    };

    let details = Paragraph::new(details_text)
        .wrap(Wrap { trim: true })
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title(" Asset Details ")
                .border_style(Style::default().fg(Color::Cyan)),
        );

    f.render_widget(details, chunks[1]);
}

fn draw_categories_tab(f: &mut Frame, app: &MarketplaceTui, area: ratatui::layout::Rect) {
    let category_items: Vec<ListItem> = app
        .categories
        .iter()
        .map(|cat| {
            let desc = if cat.description.is_empty() {
                String::new()
            } else {
                format!(" ({})", cat.description)
            };
            ListItem::new(format!("{}{}", cat.name, desc))
        })
        .collect();

    let category_list = List::new(category_items)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title(format!(" Categories ({}) ", app.categories.len()))
                .border_style(Style::default().fg(Color::Cyan)),
        )
        .highlight_style(
            Style::default()
                .bg(Color::DarkGray)
                .add_modifier(Modifier::BOLD),
        )
        .highlight_symbol("► ");

    f.render_stateful_widget(category_list, area, &mut app.category_state.clone());
}

fn draw_publishers_tab(f: &mut Frame, _app: &MarketplaceTui, area: ratatui::layout::Rect) {
    let publishers_text = Text::from(vec![
        Line::from("Publishers view"),
        Line::from(""),
        Line::from("Browse verified publishers and their assets"),
        Line::from(""),
        Line::from("Feature coming soon..."),
    ]);

    let publishers = Paragraph::new(publishers_text)
        .wrap(Wrap { trim: true })
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title(" Publishers ")
                .border_style(Style::default().fg(Color::Cyan)),
        );

    f.render_widget(publishers, area);
}

fn trust_tier_color(tier: &str) -> Style {
    match tier.to_lowercase().as_str() {
        "verified" | "official" => Style::default()
            .fg(Color::Green)
            .add_modifier(Modifier::BOLD),
        "trusted" => Style::default().fg(Color::Cyan),
        "community" => Style::default().fg(Color::Yellow),
        "experimental" => Style::default().fg(Color::Red),
        _ => Style::default().fg(Color::Gray),
    }
}
