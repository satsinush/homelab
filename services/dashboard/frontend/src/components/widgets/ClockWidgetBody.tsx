import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';

export function AnalogClockFace({ date, size }: { date: Date; size: number }) {
    const hours = date.getHours() % 12;
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const hourAngle = (hours + minutes / 60) * 30;
    const minuteAngle = (minutes + seconds / 60) * 6;
    const secondAngle = seconds * 6;
    const cx = 50;
    const cy = 50;

    return (
        <Box
            component="svg"
            viewBox="0 0 100 100"
            sx={{
                width: size,
                height: size,
                maxWidth: '50vw',
                maxHeight: '50vw',
                display: 'block',
                flexShrink: 0,
            }}
            aria-hidden
        >
            <circle
                cx={cx}
                cy={cy}
                r={46}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.2}
                strokeWidth={2}
            />
            {Array.from({ length: 12 }, (_, i) => {
                const a = ((i * 30 - 90) * Math.PI) / 180;
                const outer = 42;
                const inner = i % 3 === 0 ? 34 : 37;
                return (
                    <line
                        key={i}
                        x1={cx + Math.cos(a) * inner}
                        y1={cy + Math.sin(a) * inner}
                        x2={cx + Math.cos(a) * outer}
                        y2={cy + Math.sin(a) * outer}
                        stroke="currentColor"
                        strokeOpacity={0.45}
                        strokeWidth={i % 3 === 0 ? 2 : 1}
                        strokeLinecap="round"
                    />
                );
            })}
            <line
                x1={cx}
                y1={cy}
                x2={cx + Math.sin((hourAngle * Math.PI) / 180) * 22}
                y2={cy - Math.cos((hourAngle * Math.PI) / 180) * 22}
                stroke="currentColor"
                strokeWidth={3.5}
                strokeLinecap="round"
            />
            <line
                x1={cx}
                y1={cy}
                x2={cx + Math.sin((minuteAngle * Math.PI) / 180) * 32}
                y2={cy - Math.cos((minuteAngle * Math.PI) / 180) * 32}
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
            />
            <line
                x1={cx}
                y1={cy}
                x2={cx + Math.sin((secondAngle * Math.PI) / 180) * 36}
                y2={cy - Math.cos((secondAngle * Math.PI) / 180) * 36}
                stroke="currentColor"
                strokeOpacity={0.7}
                strokeWidth={1.25}
                strokeLinecap="round"
            />
            <circle cx={cx} cy={cy} r={2.5} fill="currentColor" />
        </Box>
    );
}

export function ClockWidgetBody({ style = 'digital' }: { style?: 'digital' | 'analog' }) {
    const [now, setNow] = useState(() => new Date());
    const bodyRef = useRef<HTMLDivElement>(null);
    const [faceSize, setFaceSize] = useState(96);

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const el = bodyRef.current;
        if (!el || style !== 'analog') return;
        const ro = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            const { width, height } = entry.contentRect;
            setFaceSize(Math.max(56, Math.min(width, height) - 8));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [style]);

    if (style === 'analog') {
        return (
            <Box
                ref={bodyRef}
                sx={{
                    width: '100%',
                    minHeight: 120,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.75,
                    color: 'text.primary',
                }}
            >
                <AnalogClockFace date={now} size={faceSize} />
                <Typography variant="caption" color="text.secondary">
                    {now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%' }}>
            <Typography variant="h4" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </Typography>
        </Box>
    );
}
