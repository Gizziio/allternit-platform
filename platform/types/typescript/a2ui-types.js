export class ComponentWhitelist {
    allowedTypes;
    constructor(allowedTypes) {
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
    isAllowed(componentType) {
        return this.allowedTypes.includes(componentType);
    }
}
