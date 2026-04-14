import { makeStyles, tokens } from '@fluentui/react-components';

export const useStyles = makeStyles({
    container: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' },
    controls: {
        display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', flexShrink: 0,
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, backgroundColor: tokens.colorNeutralBackground2,
        flexWrap: 'wrap' as const,
    },
    field: { display: 'flex', alignItems: 'center', gap: '4px' },
    fieldLabel: { fontSize: '11px', color: tokens.colorNeutralForeground3, whiteSpace: 'nowrap' as const },
    chartArea: { flex: 1, overflow: 'auto', padding: '8px', minHeight: 0 },
    empty: { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: tokens.colorNeutralForeground3, fontSize: '13px' },
});
