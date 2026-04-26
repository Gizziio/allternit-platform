# Allternit → Glass Component Mapping

## Existing Allternit Components (Reusable)

| Glass Pattern | Allternit Equivalent | Location | Notes |
|--------------|---------------------|----------|-------|
| `IconButton` | `Button` with `size="icon"` | `@/components/ui/button` | ✅ Use existing |
| `List` | `Card` + custom list | `@/components/ui/card` | ✅ Adapt with Glass styling |
| `Picker` | Radix Select + custom | `@/components/ui/select` | ✅ Already exists |
| `Tab` | `Tabs` component | `@/components/ui/tabs` | ✅ Glass uses toggle group |
| `Popover` | `Popover` | `@/components/ui/popover` | ✅ Same functionality |
| `DropdownMenu` | `DropdownMenu` | `@/components/ui/dropdown-menu` | ✅ Same functionality |
| `Tooltip` | `Tooltip` | `@/components/ui/tooltip` | ✅ Same functionality |
| `Toggle` | `Switch` | `@/components/ui/switch` | ✅ Same functionality |
| `Badge` | `Badge` | `@/components/ui/badge` | ✅ Same functionality |
| `Input` | `Input` | `@/components/ui/input` | ✅ Same functionality |

## Glass Patterns → Allternit Implementation

### 1. **Registry Filter Tabs** (Glass style)
```tsx
// Glass: Toggle button group in muted background
<div className="flex items-center bg-muted rounded-lg p-1">
  {["All", "Active", "Disabled"].map((tab) => (
    <button
      key={tab}
      className={cn(
        "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
        activeTab === tab
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {tab}
    </button>
  ))}
</div>
```

### 2. **Agent Card** (Glass style)
```tsx
<Card className="p-4 flex flex-col hover:bg-muted/50 transition-colors">
  {/* Header: Icon + Name + Version + Install badge */}
  <div className="flex items-start justify-between mb-3">
    <div className="flex items-center gap-3">
      {icon ? <img src={icon} /> : <DefaultIcon />}
      <div>
        <h3 className="font-semibold">{name}</h3>
        <p className="text-xs text-muted-foreground">v{version}</p>
      </div>
    </div>
    {isInstalled && (
      <Badge variant="secondary">
        <Check className="w-3 h-3 mr-1" />
        Installed
      </Badge>
    )}
  </div>
  
  {/* Description */}
  <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
    {description}
  </p>
  
  {/* Footer: Links + Action button */}
  <div className="flex items-center justify-between pt-3 border-t">
    <div className="flex items-center gap-1">
      <Tooltip><GithubButton /></Tooltip>
      <Tooltip><WebsiteButton /></Tooltip>
    </div>
    <Button size="sm" onClick={isInstalled ? remove : install}>
      {isInstalled ? "Remove" : "Install"}
    </Button>
  </div>
</Card>
```

### 3. **Rule Card** (Glass style)
```tsx
<Card className="p-4 hover:bg-muted/50 transition-colors">
  <div className="flex items-start justify-between gap-4">
    <div className="flex-1 min-w-0">
      {/* Header: Icon + Name + Type + Severity */}
      <div className="flex items-center gap-3 mb-2">
        <TypeIcon className={typeColor} />
        <h3 className="font-semibold truncate">{name}</h3>
        <Badge variant="secondary">{typeLabel}</Badge>
        <Tooltip>
          <SeverityIndicator />
        </Tooltip>
      </div>
      
      {/* Description */}
      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
        {description}
      </p>
      
      {/* Meta: ID + Violations + Updated */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="font-mono">ID: {id}</span>
        {violations > 0 && (
          <span className="flex items-center gap-1 text-yellow-500">
            <Warning className="w-3 h-3" />
            {violations} violations
          </span>
        )}
        <span>Updated {date}</span>
      </div>
    </div>
    
    {/* Actions: More menu + Toggle */}
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <MoreActionsTrigger />
        <DropdownMenuContent>
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem>Duplicate</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Switch checked={isActive} onCheckedChange={toggle} />
    </div>
  </div>
</Card>
```

### 4. **Add Agent Dropdown** (Glass pattern)
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button>
      <Plus className="w-4 h-4 mr-2" />
      Add Agent
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="start" className="w-56">
    <DropdownMenuLabel>Create Agent</DropdownMenuLabel>
    <DropdownMenuItem onClick={() => router.push("/agents/new")}>
      <Robot className="w-4 h-4 mr-2" />
      From Scratch
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => setDocModalOpen(true)}>
      <Upload className="w-4 h-4 mr-2" />
      From Documents
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuLabel>Discovery</DropdownMenuLabel>
    <DropdownMenuItem onClick={() => setAcpModalOpen(true)}>
      <Globe className="w-4 h-4 mr-2" />
      ACP Registry
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

## Quick Implementation Checklist

- [x] `RulesManager.tsx` - Filter tabs + cards
- [x] `AcpRegistry.tsx` - Grid + install/remove
- [x] `AddAgentFromDocument.tsx` - Dropzone + wizard
- [x] Navigation integration - Add Agent dropdown

## Key Icons (Phosphor)

| Purpose | Icon |
|---------|------|
| Add | `Plus` |
| Agent | `Robot` |
| Document | `FileText` |
| Upload | `Upload` |
| Registry | `Globe` |
| Security | `Shield` |
| Rules | `ShieldCheck` |
| Install | `Download` |
| Remove | `Trash` |
| Installed | `Check` |
| More actions | `DotsThreeVertical` |
| Edit | `PencilSimple` |
| Duplicate | `Copy` |
| Search | `MagnifyingGlass` |
| Filter | `Funnel` |
| Warning | `Warning` |
| Clock | `Clock` |
| Lock | `Lock` |

---

*Ready to implement - 2026-04-03*
