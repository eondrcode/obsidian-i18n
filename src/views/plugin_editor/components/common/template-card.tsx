import React, { memo } from 'react';
import { Card } from '@/src/shadcn';

interface TemplateCardProps {
    title: React.ReactNode;
    icon?: React.ElementType;
    extra?: React.ReactNode;
    children: React.ReactNode;
    className?: string; // Content wrapper className
    headerClassName?: string;
}

const TemplateCard: React.FC<TemplateCardProps> = memo(({
    title,
    icon: Icon,
    extra,
    children,
    className = "",
    headerClassName = ""
}) => {
    return (
        <Card className="p-0 gap-0 overflow-hidden rounded-xl bg-card shadow-sm transition-all duration-300 hover:shadow-md border">
            {/* Header */}
            <div className={`h-8 flex items-center justify-between px-3 py-2 border-b ${headerClassName}`}>
                <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
                    {Icon && <Icon className="w-4 h-4" />}
                    {title}
                </h3>
                {extra && (
                    <div className="flex items-center">
                        {extra}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className={`p-3 ${className}`}>
                {children}
            </div>
        </Card>
    );
});

TemplateCard.displayName = 'TemplateCard';

export { TemplateCard };
