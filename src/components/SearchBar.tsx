import SearchIcon from '@mui/icons-material/Search';
import { IconButton, InputBase, Paper } from '@mui/material';
import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SearchBar: React.FC<{ onExpandChange?: (expanded: boolean) => void }> = ({ onExpandChange }) => {
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState(false);
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const handleExpand = () => {
        setExpanded(true);
        onExpandChange?.(true);
        setTimeout(() => {
            inputRef.current?.focus();
        }, 100);
    };

    const handleCollapse = () => {
        if (!query) {
            setExpanded(false);
            onExpandChange?.(false);
        }
    };

    const handleSearch = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            navigate(`/search?q=${encodeURIComponent(query.trim())}`);
            setExpanded(false);
            onExpandChange?.(false);
            setQuery('');
        }
    }, [navigate, query, onExpandChange]);

    return (
        <Paper
            component="form"
            onSubmit={handleSearch}
            elevation={expanded ? 4 : 0}
            sx={{
                p: '2px 4px',
                display: 'flex',
                alignItems: 'center',
                width: expanded ? { xs: '100%', sm: 300, md: 400 } : 48,
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s',
                backgroundColor: expanded ? 'background.paper' : 'transparent',
                borderRadius: 8,
                overflow: 'hidden',
                position: 'relative',
                zIndex: 10,
            }}
        >
            <IconButton
                type={expanded ? "submit" : "button"}
                sx={{ p: '10px', color: expanded ? 'primary.main' : 'text.primary' }}
                aria-label="search"
                onClick={expanded ? handleSearch : handleExpand}
            >
                <SearchIcon />
            </IconButton>
            <InputBase
                inputRef={inputRef}
                sx={{
                    ml: 1,
                    flex: 1,
                    opacity: expanded ? 1 : 0,
                    transition: 'opacity 0.2s',
                    pointerEvents: expanded ? 'auto' : 'none',
                    color: 'text.primary'
                }}
                placeholder="搜索影视作品…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onBlur={handleCollapse}
            />
        </Paper>
    );
};

export default SearchBar;
