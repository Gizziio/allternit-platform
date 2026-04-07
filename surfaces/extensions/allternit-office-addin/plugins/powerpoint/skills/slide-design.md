# Skill: Slide Design & Layout

## Trigger
Use this skill when applying visual design — backgrounds, brand colors, shape positioning, fonts, or z-order.

## Allternit Brand Palette
```javascript
const ALLTERNIT = {
  bgPrimary:     "#FDF8F3",  // sand-50  — main background
  bgSecondary:   "#F5EDE3",  // sand-100 — card/section background
  bgCard:        "#EDE0D3",  // sand-200 — elevated card
  accent:        "#B08D6E",  // sand-400 — primary accent
  accentDark:    "#9A7658",  // sand-500 — hover/active accent
  textPrimary:   "#2A1F16",  // sand-900 — body text
  textSecondary: "#6B4F35",  // sand-700 — secondary text
  textMuted:     "#9A8070",  // sand-600 — muted/placeholder
  white:         "#FFFFFF",
  dark:          "#1A1209",  // sand-950 — dark mode bg / cover slides
  border:        "#D4BFA8",  // sand-300 — dividers
};
```

## Slide Dimension Reference
```javascript
const SLIDE = {
  widescreen: { width: 960, height: 540 },  // 16:9 (default modern)
  standard:   { width: 720, height: 540 },  // 4:3 (legacy)
};

const MARGIN = { left: 60, right: 60, top: 40, bottom: 40 };
const CONTENT = {
  titleTop:      40,
  titleHeight:   70,
  bodyTop:       130,
  bodyHeight:    370,
  fullWidth:     840,  // 960 - 60*2
};
```

## Set Slide Background (Full-Bleed Rectangle)
```javascript
// PowerPoint JS has no direct slide.background API — use a full-slide shape
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(targetIndex);

  slide.shapes.addGeometricShape(PowerPoint.GeometricShapeType.rectangle, {
    left: 0, top: 0,
    width: 960, height: 540,
  });
  await context.sync();

  // Get the shape just added (last in list)
  slide.shapes.load("items");
  await context.sync();
  const bg = slide.shapes.items[slide.shapes.items.length - 1];
  bg.fill.setSolidColor(backgroundColor);
  bg.lineFormat.visible = false;
  bg.name = "Background";
  bg.zorderPosition = PowerPoint.ShapeZOrder.sendToBack;
  await context.sync();
});
```

## Standard Layout — Title + Content Slide
```javascript
// Title box
slide.shapes.addTextBox(titleText, {
  left:   MARGIN.left,
  top:    CONTENT.titleTop,
  width:  CONTENT.fullWidth,
  height: CONTENT.titleHeight,
});

// Content box
slide.shapes.addTextBox(bodyText, {
  left:   MARGIN.left,
  top:    CONTENT.bodyTop,
  width:  CONTENT.fullWidth,
  height: CONTENT.bodyHeight,
});
await context.sync();
```

## Two-Column Layout
```javascript
const colWidth = (CONTENT.fullWidth - 30) / 2; // 30pt gutter
// Left column
slide.shapes.addTextBox(leftText, {
  left: MARGIN.left, top: CONTENT.bodyTop,
  width: colWidth, height: CONTENT.bodyHeight,
});
// Right column
slide.shapes.addTextBox(rightText, {
  left: MARGIN.left + colWidth + 30, top: CONTENT.bodyTop,
  width: colWidth, height: CONTENT.bodyHeight,
});
await context.sync();
```

## Shape Z-Order
```javascript
shape.zorderPosition = PowerPoint.ShapeZOrder.bringForward;
shape.zorderPosition = PowerPoint.ShapeZOrder.bringToFront;
shape.zorderPosition = PowerPoint.ShapeZOrder.sendBackward;
shape.zorderPosition = PowerPoint.ShapeZOrder.sendToBack;
await context.sync();
```

## Typography Standards
```javascript
// Title shapes
titlePara.font.name = "Calibri";
titlePara.font.size = 32;
titlePara.font.bold = true;
titlePara.font.color = ALLTERNIT.textPrimary;

// Body / bullet shapes
bodyPara.font.name = "Calibri";
bodyPara.font.size = 18;
bodyPara.font.bold = false;
bodyPara.font.color = ALLTERNIT.textPrimary;

// Caption / note shapes
captionPara.font.size = 12;
captionPara.font.color = ALLTERNIT.textSecondary;
```

## Safety Rules
- Slide dimensions vary by template — read from `context.presentation.slideSizeHeight/Width` when available; default to widescreen 960×540
- Font names must be installed: safe choices are Calibri, Aptos, Arial, Georgia
- Background shapes must be sent to back immediately after creation
- Never assume shape index — always load and search by name
