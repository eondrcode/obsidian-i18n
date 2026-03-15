import React, { useState, useRef, useEffect } from 'react';
import { Target, X, GripVertical, Sparkles } from 'lucide-react';
import { Button } from '~/shadcn';

interface Props {
    onPick: () => void;
    onClose: () => void;
}

export const ExtractWidget: React.FC<Props> = ({ onPick, onClose }) => {
    const [position, setPosition] = useState({ x: window.innerWidth - 150, y: 100 });
    const isDragging = useRef(false);
    const startPos = useRef({ x: 0, y: 0 });
    const widgetRef = useRef<HTMLDivElement>(null);

    const onMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        startPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };
        e.preventDefault();
        if (widgetRef.current) {
            widgetRef.current.style.transition = 'none';
            widgetRef.current.style.cursor = 'grabbing';
        }
    };

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            
            const newX = Math.max(0, Math.min(window.innerWidth - 100, e.clientX - startPos.current.x));
            const newY = Math.max(0, Math.min(window.innerHeight - 50, e.clientY - startPos.current.y));
            
            setPosition({ x: newX, y: newY });
        };

        const onMouseUp = () => {
            isDragging.current = false;
            if (widgetRef.current) {
                widgetRef.current.style.cursor = 'default';
                // widgetRef.current.style.transition = 'all 0.1s ease'; // Optional: snap back or smooth finish
            }
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, []);

    return (
        <div 
            ref={widgetRef}
            className="fixed z-[9999] flex items-center gap-1 p-1.5 rounded-2xl border border-primary/20 bg-background/60 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500 group"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                userSelect: 'none'
            }}
        >
            {/* Drag Handle */}
            <div 
                onMouseDown={onMouseDown}
                className="p-1 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-primary transition-colors active:scale-95"
            >
                <GripVertical size={16} />
            </div>

            {/* Main Action Bar */}
            <div className="flex items-center gap-1 bg-primary/5 rounded-xl p-0.5 border border-primary/10">
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={onPick}
                    className="h-8 w-8 p-0 rounded-lg hover:bg-primary hover:text-primary-foreground transition-all duration-300 active:scale-90 relative overflow-hidden group/btn"
                >
                    <Target size={18} className="relative z-10" />
                    <div className="absolute inset-0 bg-primary/20 scale-0 group-hover/btn:scale-100 transition-transform duration-300 rounded-lg" />
                </Button>
                
                <div className="w-px h-4 bg-primary/10 mx-0.5" />

                <div className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold tracking-widest uppercase text-primary/70">
                    <Sparkles size={10} className="animate-pulse" />
                    <span>i18n</span>
                </div>
            </div>

            {/* Close Button */}
            <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
                className="h-8 w-8 p-0 rounded-lg text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-all active:scale-90"
            >
                <X size={16} />
            </Button>
        </div>
    );
};
