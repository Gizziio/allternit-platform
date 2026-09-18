import type { EvidenceKind } from './capsule-spec';

export type ContainerLayout = 'column' | 'row' | 'stack' | 'grid';
export type ContainerGap = 'xs' | 'sm' | 'md' | 'lg';
export type ContainerPadding = 'none' | 'sm' | 'md' | 'lg';
export type CardVariant = 'default' | 'hero' | 'muted';
export type TextStyle = 'h1' | 'h2' | 'body' | 'subtle' | 'mono';
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type BadgeTone = 'neutral' | 'info' | 'warn' | 'danger' | 'success';

export interface BaseProps {
    id: string;
    visibleWhen?: VisibleCondition;
}

export interface VisibleCondition {
    path: string;
    eq?: unknown;
    ne?: unknown;
}

export interface ContainerProps {
    base: BaseProps;
    layout: ContainerLayout;
    gap?: ContainerGap;
    padding?: ContainerPadding;
    children?: ComponentNode[];
}

export interface CardProps {
    base: BaseProps;
    title?: string;
    variant?: CardVariant;
    children?: ComponentNode[];
}

export interface TextProps {
    base: BaseProps;
    text?: string;
    textPath?: string;
    style?: TextStyle;
    truncate?: boolean;
}

export interface ButtonProps {
    base: BaseProps;
    label: string;
    actionId: string;
    variant?: ButtonVariant;
    requiresConfirm?: boolean;
}

export interface TextFieldProps {
    base: BaseProps;
    label?: string;
    placeholder?: string;
    valuePath: string;
    onChangeBinding?: OnChangeBinding;
    submitActionId?: string;
}

export interface OnChangeBinding {
    to: string;
}

export interface ListProps {
    base: BaseProps;
    itemsPath: string;
    itemTitlePath: string;
    itemMetaPath?: string;
    emptyText?: string;
}

export interface DataTableProps {
    base: BaseProps;
    rowsPath: string;
    columns: DataTableColumn[];
    rowActionId?: string;
}

export interface DataTableColumn {
    key: string;
    label: string;
}

export interface TabsProps {
    base: BaseProps;
    tabs: TabDefinition[];
    activeTabPath: string;
    onTabSelectBinding?: OnChangeBinding;
}

export interface TabDefinition {
    id: string;
    label: string;
    icon?: string;
}

export interface BadgeProps {
    base: BaseProps;
    text?: string;
    textPath?: string;
    tone?: BadgeTone;
}

export interface AccordionProps {
    base: BaseProps;
    itemsPath: string;
    itemTitlePath: string;
    itemBodyTextPath?: string;
}

// New components for polish features
export interface SplitPaneProps {
    base: BaseProps;
    layout: 'horizontal' | 'vertical';
    leftPane: ComponentNode;
    centerPane: ComponentNode;
    rightPane?: ComponentNode;
    mobileBreakpoint?: number;
}

export interface EvidenceCardProps {
    base: BaseProps;
    evidenceId: string;
    kind: EvidenceKind;
    title: string;
    uri?: string;
    favicon?: string;
    extractionStatus: 'loading' | 'ready' | 'error';
    pinState: 'none' | 'pinned' | 'excluded';
    freshness: 'recent' | 'stale';
    confidence: number;
    onPinToggle?: (evidenceId: string) => void;
}

export interface ChipProps {
    base: BaseProps;
    text: string;
    variant: 'intent' | 'entity' | 'constraint' | 'risk' | 'confidence';
    onClick?: () => void;
    onDelete?: () => void;
}

export interface ToastProps {
    base: BaseProps;
    id: string;
    message: string;
    type: 'success' | 'info' | 'warn' | 'error';
    duration: number;
    onClose?: () => void;
}

export interface DrawerProps {
    base: BaseProps;
    isOpen: boolean;
    position: 'left' | 'right' | 'top' | 'bottom';
    children?: ComponentNode[];
    onClose?: () => void;
}

export interface DiffPanelProps {
    base: BaseProps;
    events: Array<{
        type: string;
        message: string;
        timestamp: number;
        evidenceId?: string;
    }>;
    onHighlightSection?: (sectionId: string) => void;
}

export type ComponentNode =
    | { type: 'Container'; } & ContainerProps
    | { type: 'Card'; } & CardProps
    | { type: 'Text'; } & TextProps
    | { type: 'Button'; } & ButtonProps
    | { type: 'TextField'; } & TextFieldProps
    | { type: 'List'; } & ListProps
    | { type: 'DataTable'; } & DataTableProps
    | { type: 'Tabs'; } & TabsProps
    | { type: 'Badge'; } & BadgeProps
    | { type: 'Accordion'; } & AccordionProps
    | { type: 'SplitPane'; } & SplitPaneProps
    | { type: 'EvidenceCard'; } & EvidenceCardProps
    | { type: 'Chip'; } & ChipProps
    | { type: 'Toast'; } & ToastProps
    | { type: 'Drawer'; } & DrawerProps
    | { type: 'DiffPanel'; } & DiffPanelProps;

export interface A2UISurface {
    surfaceId: string;
    title: string;
    root: ComponentNode;
}

export interface A2UIPayload {
    schemaVersion: string;
    dataModel: Record<string, unknown>;
    surfaces: A2UISurface[];
    uiState?: Record<string, unknown>;
}

export class ComponentWhitelist {
    private allowedTypes: string[];

    constructor(allowedTypes?: string[]) {
        this.allowedTypes = allowedTypes || [
            'Container',
            'Card',
            'Text',
            'Button',
            'TextField',
            'List',
            'DataTable',
            'Tabs',
            'Badge',
            'Accordion',
            'SplitPane',
            'EvidenceCard',
            'Chip',
            'Toast',
            'Drawer',
            'DiffPanel',
        ];
    }

    isAllowed(componentType: string): boolean {
        return this.allowedTypes.includes(componentType);
    }
}
