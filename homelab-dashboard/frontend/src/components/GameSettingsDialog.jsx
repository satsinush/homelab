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
    TextField,
    Typography
} from '@mui/material';

/**
 * Reusable settings dialog for word games.
 * 
 * @param {boolean} open - Whether dialog is open
 * @param {function} onClose - Called when dialog is closed
 * @param {function} onSave - Called with updated config when saved
 * @param {string} title - Dialog title
 * @param {object} config - Current config values
 * @param {Array} fields - Array of field definitions:
 *   - { name, label, type: 'select'|'checkbox'|'number', options?: [{value, label}], min?, max? }
 */
const GameSettingsDialog = ({ open, onClose, onSave, title, config, fields }) => {
    const [localConfig, setLocalConfig] = useState(config);

    useEffect(() => {
        setLocalConfig(config);
    }, [config, open]);

    const handleChange = (name, value) => {
        setLocalConfig(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        onSave(localConfig);
        onClose();
    };

    const renderField = (field) => {
        const value = localConfig[field.name];

        switch (field.type) {
            case 'select':
                return (
                    <FormControl fullWidth size="small" key={field.name}>
                        <InputLabel>{field.label}</InputLabel>
                        <Select
                            value={value}
                            label={field.label}
                            onChange={(e) => handleChange(field.name, e.target.value)}
                        >
                            {field.options.map(opt => (
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
