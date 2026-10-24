import SearchIcon from '@mui/icons-material/Search';
import {IconButton, InputBase, Paper} from '@mui/material';
import React, {useCallback, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';

/** 工具栏搜索入口：本地维护输入，提交后将关键词编码到搜索页地址。 */
const SearchBar: React.FC<{ onExpandChange?: (expanded: boolean) => void }> = ({onExpandChange}) => {
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState(false);
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const handleExpand = () => {
        setExpanded(true);
        // 通知公共布局在移动端让出空间，并稍后聚焦已展开的输入框。
        onExpandChange?.(true);
        setTimeout(() => {
            inputRef.current?.focus();
        }, 100);
    };

    // 失焦只收起空输入，有内容时保留输入状态，避免中途输入被隐藏。
    const handleCollapse = () => {
        if (!query) {
            setExpanded(false);
            onExpandChange?.(false);
        }
    };

    const handleSearch = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            // 编码关键词中的空格、中文和特殊符号；搜索页负责实际接口请求。
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
                p: expanded ? '2px 4px' : 0,
                display: 'flex',
                alignItems: 'center',
                width: expanded ? {xs: '100%', sm: 300, md: 400} : 40,
                flexShrink: expanded ? 1 : 0,
                minWidth: 0,
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
                sx={{
                    p: expanded ? '10px' : '8px', flexShrink: 0,
                    color: expanded ? 'primary.main' : 'text.secondary'
                }}
                aria-label="search"
                onClick={expanded ? handleSearch : handleExpand}
            >
                <SearchIcon/>
            </IconButton>
            <InputBase
                inputRef={inputRef}
                sx={{
                    display: expanded ? 'flex' : 'none',
                    ml: 1,
                    flex: 1,
                    minWidth: 0,
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
