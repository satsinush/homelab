import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Checkbox,
    Stack,
    TextField
} from '@mui/material';

export interface FieldOption {
    value: string | number;
    label: string;
}

export interface FieldDefinition {
    name: string;
    label: string;
    type: 'select' | 'checkbox' | 'number';
    options?: FieldOption[];
    min?: number;
    max?: number;
    disabled?: (config: DialogConfig) => boolean;
}

type ConfigValue = string | number | boolean;
type DialogConfig = Record<string, ConfigValue>;

interface GameSettingsDialogProps {
    open: boolean;
    onClose: () => void;
    onSave: (config: DialogConfig) => void;
    title: string;
    config: DialogConfig;
    fields: FieldDefinition[];
    children?: React.ReactNode;
}

/**
 * Reusable settings dialog for word games.
 */
const GameSettingsDialog = ({ open, onClose, onSave, title, config, fields, children }: GameSettingsDialogProps) => {
    const [localConfig, setLocalConfig] = useState<DialogConfig>(config);

    useEffect(() => {
        setLocalConfig(config);
    }, [config, open]);

    const handleChange = (name: string, value: ConfigValue) => {
        setLocalConfig((prev) => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        onSave(localConfig);
        onClose();
    };

    const renderField = (field: FieldDefinition) => {
        const value = localConfig[field.name];
        const isDisabled = field.disabled ? field.disabled(localConfig) : false;

        switch (field.type) {
            case 'select':
                return (
                    <FormControl fullWidth size="small" key={field.name} disabled={isDisabled}>
                        <InputLabel>{field.label}</InputLabel>
                        <Select
                            value={value ?? ''}
                            label={field.label}
                            onChange={(e) => handleChange(field.name, e.target.value as ConfigValue)}
                        >
                            {field.options?.map(opt => (
                                <MenuItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                );

            case 'checkbox':
                return (
                    <FormControlLabel
                        key={field.name}
                        disabled={isDisabled}
                        control={
                            <Checkbox
                                checked={Boolean(value)}
                                onChange={(e) => handleChange(field.name, e.target.checked)}
                            />
                        }
                        label={field.label}
                    />
                );

            case 'number':
                return (
                    <TextField
                        key={field.name}
                        label={field.label}
                        type="number"
                        size="small"
                        fullWidth
                        disabled={isDisabled}
                        value={value ?? ''}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                                handleChange(field.name, '');
                            } else {
                                let num = parseInt(val, 10);
                                if (!isNaN(num)) {
                                    if (field.min !== undefined) num = Math.max(field.min, num);
                                    if (field.max !== undefined) num = Math.min(field.max, num);
                                    handleChange(field.name, num);
                                }
                            }
                        }}
                        slotProps={{ htmlInput: { min: field.min, max: field.max, autoComplete: 'off', autoCorrect: 'off', autoCapitalize: 'off', spellCheck: 'false' } }}
                    />
                );

            default:
                return null;
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    {fields.map(renderField)}
                    {children}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} variant="contained">Save</Button>
            </DialogActions>
        </Dialog>
    );
};

export default GameSettingsDialog;
export type { DialogConfig, ConfigValue };
