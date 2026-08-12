# CLI customization

You can customize the appearance and keybindings of `gizzi-code` through `config.toml`.

## Themes

Set the active theme in your user config:

```toml
theme = "dark"
```

Built-in themes include `dark`, `light`, and `high-contrast`. To list available themes in the TUI, use the `theme_list` keybinding (default `<leader>t`).

### Syntax highlighting

Code blocks in the TUI are highlighted based on the active theme. The highlighting engine supports common languages and adapts to the theme's color palette.

### Custom colors

Some UI elements can be customized with hex colors in the agent config:

```toml
[agent.build]
color = "#FF5733"
```

Or use theme color names such as `primary`, `secondary`, or `error`.

## Keybindings

Keyboard shortcuts are configurable under the `keybinds` table. See [Advanced configuration](./advanced-configuration.md) for the full list.

## Related pages

- [Advanced configuration](./advanced-configuration.md)
- [TUI options](./advanced-configuration.md#tui-options)
