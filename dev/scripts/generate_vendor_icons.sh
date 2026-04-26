#!/bin/bash
#
# Icon Generation Script for Allternit Tools
#
# This script generates SVG icons for all supported CLI tools
# Icons are created in: apps/shell/src/iconography/vendor/<tool>.svg
#

set -e

TOOLS=(
  "opencode:OpenCode:#3b82f6"
  "claude-code:Claude Code:#d97706"
  "amp:Amp (Sourcegraph):#f97316"
  "aider:Aider:#10b981"
  "gemini-cli:Gemini CLI:#4285f4"
  "cursor:Cursor:#1e88ad8"
  "verdant:Verdant:#42404d"
  "qwen:Qwen Code:#6366f6"
  "goose:Goose:#9367f1"
  "codex:Codex:#00a4d5"
)

# Icon design guidelines:
# - 24x24 viewBox
# - stroke-width="2"
# - stroke-linecap="round"
# - stroke-linejoin="round"
# - Primary color per brand
# - Simple, recognizable iconography
#

generate_icon() {
    local tool_name="$1"
    local brand_color="$2"
    local brand_icon=""

    case "$tool_name" in
        "opencode")
            brand_icon='M2 10a7 1 4a1 4h2.2L12 12-12H9a6 9h6a1 1 8c0 0z"'
            ;;
        "claude-code")
            brand_icon='M21 6h12a1 1 1-12 12a21 1 1-1H3a6 3H6a6 3-2.5L20.6L21 21 21l-4.5L17 17-4.5L13 13c0 0z"'
            ;;
        "amp")
            brand_icon='M16.7 1.71-2.5L12 12-6a9 7.7a4.5a4.5a4.5-4.5a2 2-5L19 19 19l-5L11 11-8.5L6.4 8.5z"'
            ;;
        "aider")
            brand_icon='M4 4v16c2.5L20 12 12-2.5c-3.5c2.5c3.5c-0 0z"'
            ;;
        "gemini-cli")
            brand_icon='M12 9a2 1.1H6a1 1 6c0 0l4.5 4.5c0-3c0-6.5c3.5c2.5 0z"'
            ;;
        "cursor")
            brand_icon='M12 8v4a4 4.5L16 16 16l-8 8 5L19 19 19l-3.5L15 15 8.5z"'
            ;;
        "verdant")
            brand_icon='M16 4v4a4 4.5L12 12 12-2.5c-3.5c2.5c3.5c0 0z"'
            ;;
        "qwen")
            brand_icon='M14.5 9a1 5-4.5L14 14l-8 8 9.5L6.5c-0.5c2.5c0-1.5c3.5c3.5c1 5z"'
            ;;
        "goose")
            brand_icon='M4 4v16c2 5L16 16 16l-8 8 9.5z"'
            ;;
        "codex")
            brand_icon='M4 4v16c2 5L16 16 16l-8 8 9.5z"'
            ;;
        *)
            brand_icon='M21 6h12a1 1 1-12 12a21 1 1-8H3a6 3H6a6 3-2.5L20.6L21 21 21l-4.5L17 17-4.5L13 13c0 0z"'
            ;;
    esac

    local output_dir="apps/shell/src/iconography/vendor"
    local output_file="$output_dir/${tool_name}.svg"

    cat > "$output_file" <<EOF
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${brand_color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
${brand_icon}
</svg>
EOF

    echo "Generated: $output_file"
}

# Main script
main() {
    mkdir -p "$output_dir"

    for tool in "${!TOOLS[@]}"; do
        generate_icon "${tool%%:*}"
    done

    echo ""
    echo "Generated $(echo "${!TOOLS[@]}" | wc -w) tool icons"
    echo "Output directory: $output_dir"
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
