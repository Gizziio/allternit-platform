# Template Preview Cards - UI/UX Guide

## What Are Template Preview Cards?

Template Preview Cards are **polished visual previews** that appear when users select a mode in the chat interface. Similar to Kimi and MiniMax, these cards show **4-6 template examples** with beautiful gradient previews, making it easy for users to get started.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CHAT INTERFACE                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User: [Click "Create"]                                                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ CREATE TEMPLATES (6)                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │  🎨         │  │  📸         │  │  🏔️         │  │  ✨         │      │
│  │             │  │             │  │             │  │             │      │
│  │   Gradient  │  │   Gradient  │  │   Gradient  │  │   Gradient  │      │
│  │   Preview   │  │   Preview   │  │   Preview   │  │   Preview   │      │
│  │             │  │             │  │             │  │             │      │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤  ├─────────────┤      │
│  │ Product     │  │ Portrait    │  │ Landscape   │  │ Abstract    │      │
│  │ Photo       │  │ Art         │  │             │  │ Art         │      │
│  │             │  │             │  │             │  │             │      │
│  │ Professional│  │ Artistic    │  │ Stunning    │  │ Creative    │      │
│  │ studio shots│  │ portraits   │  │ natural     │  │ compositions│      │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘      │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐                                         │
│  │  🏠         │  │  🍽️         │  [+2 more]                             │
│  │             │  │             │                                         │
│  │   Gradient  │  │   Gradient  │                                         │
│  │   Preview   │  │   Preview   │                                         │
│  │             │  │             │                                         │
│  ├─────────────┤  ├─────────────┤                                         │
│  │ Interior    │  │ Food        │                                         │
│  │ Design      │  │ Photo       │                                         │
│  │             │  │             │                                         │
│  │ Modern      │  │ Appetizing  │                                         │
│  │ spaces      │  │ food shots  │                                         │
│  └─────────────┘  └─────────────┘                                         │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ✨ Or type your own request above...                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ What would you like to create?                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## How It Works

### 1. User Selects a Mode

```
User clicks: 🟣 Create → Image
```

### 2. Template Cards Appear

**4-6 polished cards** appear below the mode selector:
- **Visual preview** - Beautiful gradient representing the output
- **Icon** - Lucide icon for quick recognition  
- **Name** - Short, clear template name
- **Description** - One-line explanation

### 3. User Clicks a Card

```
User clicks: "Product Photography" card

Result: Prompt auto-fills in chat input
"A sleek wireless headphones product photo, floating on white 
background, soft studio lighting, professional commercial 
photography, 8k, detailed textures"
```

### 4. User Sends Message

User can:
- **Send as-is** - Use the template prompt directly
- **Edit first** - Modify the prompt before sending
- **Type their own** - Ignore templates and type custom request

## Template Categories

### 🟣 CREATE (Violet Gradients)

| Mode | Templates | Preview Style |
|------|-----------|---------------|
| **Image** | Product Photo, Portrait Art, Landscape, Abstract, Interior, Food | Vibrant artistic gradients |
| **Video** | Cinematic, Nature Motion, Product Demo, Animation | Dynamic blue-purple tones |
| **Slides** | Pitch Deck, QTR Review, Training Deck, Research | Professional business colors |
| **Website** | Landing Page, Portfolio, Dashboard, E-commerce | Modern web design gradients |

### 🔵 ANALYZE (Blue Gradients)

| Mode | Templates | Preview Style |
|------|-----------|---------------|
| **Research** | Market Analysis, Competitor Intel, Trends, Regulatory | Trustworthy blues |
| **Data** | CSV Analysis, SQL Queries, Visualization, Forecasting | Data-inspired greens/blues |

### 🟢 BUILD (Emerald Gradients)

| Mode | Templates | Preview Style |
|------|-----------|---------------|
| **Code** | React Component, API Endpoint, Python Script, SQL Schema | Developer-friendly colors |

### 🟡 AUTOMATE (Amber Gradients)

| Mode | Templates | Preview Style |
|------|-----------|---------------|
| **Swarms** | Code Review, Research Team, Content Team | Warm energetic tones |
| **Flow** | Email Automation, Data Pipeline, Approval Flow | Workflow oranges |

## Visual Design

### Card Anatomy

```
┌─────────────────────────────┐
│     ┌───┐              →    │  ← Header: Icon + Hover arrow
│     │ 📸│                   │
│     └───┘                   │
│                             │
│    ╭───────────────────╮    │
│    │                   │    │  ← Preview Area: Gradient/image
│    │   GRADIENT/       │    │     (h-28 = 112px height)
│    │   IMAGE PREVIEW   │    │
│    │                   │    │
│    ╰───────────────────╯    │
│                             │
├─────────────────────────────┤
│ Portrait Art                │  ← Name (font-medium)
│                             │
│ Artistic portrait with      │  ← Description (text-xs, line-clamp-2)
│ custom style                │
│                             │
└─────────────────────────────┘
      ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔      ← Bottom accent line on hover
```

### Interactive States

| State | Visual Effect |
|-------|---------------|
| **Default** | Subtle border, full opacity |
| **Hover** | Card lifts up (-4px), scale 1.02, arrow appears |
| **Active** | Scale 0.98 (pressed effect) |
| **Selected** | Bottom gradient line animates in |

### Animation Specs

```typescript
// Card entrance (staggered)
initial: { opacity: 0, y: 20 }
animate: { opacity: 1, y: 0 }
transition: { delay: index * 0.05, duration: 0.3 }

// Hover
whileHover: { y: -4, scale: 1.02 }
whileTap: { scale: 0.98 }

// Preview line
opacity: 0 → 1 (on hover)
```

## Code Usage

### Basic Integration

```tsx
import { ConsolidatedModeSelector } from '@/components/chat/ConsolidatedModeSelector';

function ChatInput() {
  const [selectedMode, setSelectedMode] = useState(null);
  const [inputValue, setInputValue] = useState('');

  return (
    <div>
      <ConsolidatedModeSelector
        selectedMode={selectedMode}
        onSelectMode={setSelectedMode}
        onSelectTemplate={(prompt) => setInputValue(prompt)}
        showTemplates={true}
      />
      
      <textarea 
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />
    </div>
  );
}
```

### Standalone Template Cards

```tsx
import { TemplatePreviewCards } from '@/components/chat/TemplatePreviewCards';

function MyComponent() {
  return (
    <TemplatePreviewCards
      modeId="image"
      modeName="Image"
      modeColor="violet"
      onSelectTemplate={(prompt) => console.log(prompt)}
      isVisible={true}
    />
  );
}
```

### Adding Custom Templates

```typescript
// In TemplatePreviewCards.tsx, add to MODE_TEMPLATES:

const MODE_TEMPLATES: Record<string, TemplatePreview[]> = {
  image: [
    // ... existing templates ...
    {
      id: 'my-custom-template',
      name: 'My Template',
      description: 'Custom description',
      prompt: 'Your custom prompt here...',
      icon: MyIcon,
      preview: { 
        type: 'gradient', 
        gradient: 'from-purple-500 to-pink-500' 
      }
    }
  ]
};
```

## Benefits

### For Users

1. **Discoverability** - See what's possible without typing
2. **Speed** - One click to get a polished prompt
3. **Learning** - Learn good prompting by example
4. **Inspiration** - Jump-start creativity

### For Platform

1. **Higher Engagement** - Users try more features
2. **Better Results** - Quality prompts = better outputs
3. **Reduced Support** - Less "how do I..." questions
4. **Competitive** - Matches Kimi/MiniMax UX

## Comparison: With vs Without Templates

### Without Templates (Old)
```
User: [Selects Image mode]
System: [Empty input field]
User: "Um... what should I ask?"
User: [Types something basic]
"make an image of a cat"
[Mediocre result]
```

### With Templates (New)
```
User: [Selects Image mode]
System: [Shows 6 beautiful template cards]
User: "Oh, product photography looks cool!"
User: [Clicks card]
System: [Auto-fills professional prompt]
"A sleek wireless headphones product photo, 
floating on white background, soft studio 
lighting, professional commercial photography..."
[High-quality result]
```

## Technical Notes

### Responsive Grid

```
Desktop (lg):  4 columns
Tablet (sm):   2 columns
Mobile:        2 columns
```

### Performance

- Cards are **static data** (no API calls)
- Images use **CSS gradients** (no image assets)
- **Lazy entrance** animations (staggered)
- **Hardware accelerated** transforms

### Accessibility

- Full **keyboard navigation**
- **Screen reader** labels
- **High contrast** text
- **Focus indicators**

## Future Enhancements

1. **User Templates** - Save personal favorites
2. **AI Suggestions** - Generate templates based on context
3. **Community Templates** - Share with other users
4. **Template Ratings** - Upvote best prompts
5. **Preview Images** - Show actual AI-generated previews

---

## Summary

Template Preview Cards transform the chat interface from a **blank input** into an **inspiring creative workspace**. Users see what's possible, click to get started, and achieve better results with less effort.

**It's the difference between a text box and a creative studio.**
