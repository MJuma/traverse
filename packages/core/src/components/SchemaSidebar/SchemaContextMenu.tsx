import { Menu, MenuList, MenuItem, MenuPopover } from '@fluentui/react-components';
import { TextAddRegular, TableSearchRegular, NumberSymbolRegular, TextDescriptionRegular, CalendarRegular } from '@fluentui/react-icons';
import { useCallback, useMemo } from 'react';

const textAddIcon = <TextAddRegular />;
const tableSearchIcon = <TableSearchRegular />;
const numberSymbolIcon = <NumberSymbolRegular />;
const textDescriptionIcon = <TextDescriptionRegular />;
const calendarIcon = <CalendarRegular />;

export interface SchemaContextMenuProps {
    tableName: string;
    x: number;
    y: number;
    insertText: (text: string) => void;
    schemaContextRunQuery: (kql: string) => void;
    setSchemaContextMenu: (menu: null) => void;
    contextMenuClassName: string;
    contextMenuItemClassName: string;
}

export function SchemaContextMenu({ tableName, x, y, insertText, schemaContextRunQuery, setSchemaContextMenu }: SchemaContextMenuProps) {
    const handleInsertName = useCallback(() => { insertText(tableName); setSchemaContextMenu(null); }, [insertText, tableName, setSchemaContextMenu]);
    const handleTake100 = useCallback(() => { schemaContextRunQuery(`${tableName}\n| take 100`); setSchemaContextMenu(null); }, [schemaContextRunQuery, tableName, setSchemaContextMenu]);
    const handleCount = useCallback(() => { schemaContextRunQuery(`${tableName}\n| count`); setSchemaContextMenu(null); }, [schemaContextRunQuery, tableName, setSchemaContextMenu]);
    const handleShowSchema = useCallback(() => { schemaContextRunQuery(`${tableName}\n| getschema`); setSchemaContextMenu(null); }, [schemaContextRunQuery, tableName, setSchemaContextMenu]);
    const handleDateRange = useCallback(() => { schemaContextRunQuery(`${tableName}\n| take 1000\n| summarize min(Timestamp), max(Timestamp)`); setSchemaContextMenu(null); }, [schemaContextRunQuery, tableName, setSchemaContextMenu]);
    const handleOpenChange = useCallback((_: unknown, data: { open: boolean }) => {
        if (!data.open) {
            setSchemaContextMenu(null);
        }
    }, [setSchemaContextMenu]);

    const positioning = useMemo(() => ({ target: { getBoundingClientRect: () => ({ x, y, top: y, left: x, bottom: y, right: x, width: 0, height: 0, toJSON: () => ({}) }) } }), [x, y]);

    return (
        <Menu open positioning={positioning} onOpenChange={handleOpenChange}>
            <MenuPopover>
                <MenuList>
                    <MenuItem icon={textAddIcon} onClick={handleInsertName}>Insert name</MenuItem>
                    <MenuItem icon={tableSearchIcon} onClick={handleTake100}>Take 100</MenuItem>
                    <MenuItem icon={numberSymbolIcon} onClick={handleCount}>Count rows</MenuItem>
                    <MenuItem icon={textDescriptionIcon} onClick={handleShowSchema}>Show schema</MenuItem>
                    <MenuItem icon={calendarIcon} onClick={handleDateRange}>Date range</MenuItem>
                </MenuList>
            </MenuPopover>
        </Menu>
    );
}
