import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    Button,
    ScrollArea,
    Badge,
    Separator
} from '~/shadcn';
import { Search, Plus, Terminal, Hash, Loader2, Info, Folder, FileCode, ChevronRight, AlertCircle } from 'lucide-react';

export type SearchStatus = 'searching' | 'success' | 'empty' | 'error';

interface Match {
    line: number;
    column?: number;
    type?: string;
    name?: string;
    source: string;
    method: 'AST' | 'Regex';
    file: string;
    pluginId: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    targetText: string;
    matches: Match[];
    onAdd: (match: Match) => void;
    status: SearchStatus;
}

export const ExtractAssistantDialog: React.FC<Props> = ({ isOpen, onClose, targetText, matches, onAdd, status }) => {
    const { t } = useTranslation();

    // Group matches by pluginId
    const groupedMatches = React.useMemo(() => {
        const groups: Record<string, Match[]> = {};
        matches.forEach(m => {
            if (!groups[m.pluginId]) groups[m.pluginId] = [];
            groups[m.pluginId].push(m);
        });
        return groups;
    }, [matches]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl bg-background/80 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header Section */}
                <DialogHeader className="p-6 pb-4 bg-primary/5 border-b border-primary/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Search className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <DialogTitle className="text-xl font-bold tracking-tight">
                                {t('Editor.ExtractAssistant.Title', 'Extraction Assistant')}
                            </DialogTitle>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                                <span>{t('Editor.ExtractAssistant.TargetText', 'Targeting:')}</span>
                                <code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 max-w-[300px] truncate">
                                    {targetText}
                                </code>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                {/* Main Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col min-h-[400px]">
                    {status === 'searching' && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-pulse">
                            <div className="relative">
                                <Loader2 className="w-12 h-12 text-primary animate-spin opacity-20" />
                                <Search className="w-6 h-6 text-primary absolute inset-0 m-auto animate-bounce" />
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-sm font-semibold text-primary">{t('Editor.ExtractAssistant.Searching', 'Scanning Plugins...')}</span>
                                <span className="text-xs text-muted-foreground">{t('Editor.ExtractAssistant.SearchTip', 'Checking AST and Regex matches in source code')}</span>
                            </div>
                        </div>
                    )}

                    {status === 'empty' && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-12 text-center animate-in fade-in slide-in-from-bottom-4">
                            <div className="p-4 bg-muted/50 rounded-full">
                                <Info className="w-12 h-12 text-muted-foreground/50" />
                            </div>
                            <div className="flex flex-col gap-2 max-w-xs">
                                <h3 className="text-lg font-semibold">{t('Editor.ExtractAssistant.NoMatchesTitle', 'No Matches Found')}</h3>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {t('Editor.ExtractAssistant.NoMatchesDesc', "We couldn't find an exact match in the main source files. Try selecting a smaller or more specific string.")}
                                </p>
                            </div>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-12 text-center">
                            <AlertCircle className="w-12 h-12 text-destructive opacity-50" />
                            <h3 className="text-lg font-semibold text-destructive">{t('Common.Status.Error')}</h3>
                        </div>
                    )}

                    {status === 'success' && (
                        <ScrollArea className="flex-1 p-6">
                            <div className="flex flex-col gap-6 ">
                                {Object.entries(groupedMatches).map(([pluginId, pluginMatches]) => (
                                    <div key={pluginId} className="flex flex-col gap-3 group animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        {/* Plugin Header */}
                                        <div className="flex items-center gap-2 mb-1">
                                            <Folder className="w-4 h-4 text-primary/70" />
                                            <span className="text-sm font-bold tracking-wide uppercase text-muted-foreground/80">{pluginId}</span>
                                            <Badge variant="outline" className="ml-auto bg-primary/5 border-primary/10 text-[10px] font-bold">
                                                {pluginMatches.length} {t('Common.Labels.Items', 'Matches')}
                                            </Badge>
                                        </div>

                                        {/* Matches list */}
                                        <div className="grid gap-3">
                                            {pluginMatches.map((match, idx) => (
                                                <div 
                                                    key={`${pluginId}-${idx}`}
                                                    className="relative flex flex-col gap-3 p-4 rounded-xl border border-border/50 bg-card/30 hover:bg-card/60 hover:border-primary/30 transition-all hover:shadow-md group/card"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <FileCode className="w-3.5 h-3.5 text-muted-foreground" />
                                                            <span className="text-xs font-mono text-muted-foreground">{match.file}</span>
                                                            <Separator orientation="vertical" className="h-3 mx-1" />
                                                            <Hash className="w-3 h-3 text-muted-foreground" />
                                                            <span className="text-xs font-mono font-bold text-primary">{match.line}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant={match.method === 'AST' ? 'default' : 'secondary'} className="text-[9px] h-4 px-1.5 font-bold uppercase tracking-wider">
                                                                {match.method}
                                                            </Badge>
                                                            <Button 
                                                                size="icon" 
                                                                variant="secondary" 
                                                                className="h-7 w-7 rounded-full bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground transition-all active:scale-90"
                                                                onClick={() => onAdd(match)}
                                                            >
                                                                <Plus className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col gap-2">
                                                        {match.type && (
                                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/50 w-fit border border-border/50">
                                                                <Terminal className="w-3 h-3 text-primary/70" />
                                                                <span className="text-[10px] font-mono text-muted-foreground">
                                                                    {match.type}{match.name ? `:${match.name}` : ''}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className="relative group/code">
                                                            <pre className="text-xs font-mono bg-muted/20 p-3 rounded-lg border border-border/30 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                                                                {match.source}
                                                            </pre>
                                                            <div className="absolute inset-y-0 left-0 w-1 bg-primary/20 rounded-l-lg group-hover/card:bg-primary transition-colors" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                <DialogFooter className="p-4 bg-muted/30 border-t border-border/50">
                    <Button variant="ghost" className="text-xs font-bold hover:bg-destructive/10 hover:text-destructive" onClick={onClose}>
                        {t('Common.Actions.Close', 'Close')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
