import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {Box, Button, Typography} from '@mui/material';
import {useEffect, useId, useRef, useState} from 'react';

/** 简介仅在实际溢出时提供展开入口，并保留原始段落。 */
export default function ExpandableOverview({text, indentFirstLine = false, collapsedLines = 3, expandLabel = '展开全文'}: {
    text: string; indentFirstLine?: boolean; collapsedLines?: number; expandLabel?: string;
}) {
    const [expanded, setExpanded] = useState(false);
    const [canExpand, setCanExpand] = useState(false);
    const textRef = useRef<HTMLParagraphElement>(null);
    const textId = useId();

    useEffect(() => {
        const element = textRef.current;
        if (!element) return;
        let active = true;
        const measure = () => {
            if (!active || !element.clientWidth) return;
            const lineHeight = parseFloat(getComputedStyle(element).lineHeight);
            // 预留 1 像素测量误差，避免恰好三行等临界情况下误显示展开按钮。
            setCanExpand(element.scrollHeight > lineHeight * collapsedLines + 1);
        };
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        // 字体替换也会改变换行，不能只在组件挂载时测量一次。
        void document.fonts.ready.then(measure);
        document.fonts.addEventListener('loadingdone', measure);
        return () => {
            active = false;
            observer.disconnect();
            document.fonts.removeEventListener('loadingdone', measure);
        };
    }, [text, collapsedLines]);

    return (
        <Box sx={{minWidth: 0}}>
            <Typography ref={textRef} id={textId} variant="body2" color="text.secondary" sx={{
                display: expanded ? 'block' : '-webkit-box',
                WebkitLineClamp: expanded ? 'unset' : collapsedLines,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                overflowWrap: 'anywhere',
                whiteSpace: 'pre-line',
                textIndent: indentFirstLine ? '2em' : undefined,
                lineHeight: 1.7,
            }}>{text}</Typography>
            {canExpand && <Button size="small" aria-expanded={expanded} aria-controls={textId}
                                  onClick={() => setExpanded(value => !value)}
                                  endIcon={expanded ? <ExpandLessIcon/> : <ExpandMoreIcon/>}
                                  sx={{p: 0, mt: 0.5, minWidth: 0, fontSize: '0.75rem'}}>
                {expanded ? '收起简介' : expandLabel}
            </Button>}
        </Box>
    );
}
