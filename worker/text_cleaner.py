"""
Text cleaner for TTS
Removes Markdown formatting and special characters before text-to-speech conversion
"""

import re

# Compiled patterns — evaluated once at import time, not per call
_H_RE = re.compile(r'^#{1,6}\s+', re.MULTILINE)
_BOLD_ITALIC_RE = re.compile(r'\*\*\*(.+?)\*\*\*')
_BOLD_RE = re.compile(r'\*\*(.+?)\*\*')
_ITALIC_STAR_RE = re.compile(r'\*(.+?)\*')
_BOLD_UNDER_RE = re.compile(r'__(.+?)__')
_ITALIC_UNDER_RE = re.compile(r'_(.+?)_')
_LINK_RE = re.compile(r'\[([^\]]+)\]\([^\)]+\)')
_CODE_INLINE_RE = re.compile(r'`([^`]+)`')
_CODE_BLOCK_RE = re.compile(r'```[\s\S]*?```', re.DOTALL)
_HR_RE = re.compile(r'^[\-\*_]{3,}\s*$', re.MULTILINE)
_BLOCKQUOTE_RE = re.compile(r'^>\s+', re.MULTILINE)
_LIST_BULLET_RE = re.compile(r'^[\-\*\+]\s+', re.MULTILINE)
_LIST_NUM_RE = re.compile(r'^\d+\.\s+', re.MULTILINE)
_HTML_TAGS_RE = re.compile(r'<[^>]+>')
_ELLIPSIS_RE = re.compile(r'\.{2,}')
_EXCLAIM_RE = re.compile(r'!{2,}')
_QUESTION_RE = re.compile(r'\?{2,}')
_SPACES_RE = re.compile(r' {2,}')
_NEWLINES_RE = re.compile(r'\n{3,}')


def clean_for_tts(text: str) -> str:
    """
    Clean text for TTS by removing Markdown formatting and special characters

    Args:
        text: Raw text with Markdown formatting

    Returns:
        Clean text ready for TTS
    """
    text = _H_RE.sub('', text)                      # ## Title → ''
    text = _BOLD_ITALIC_RE.sub(r'\1', text)         # ***x*** → x
    text = _BOLD_RE.sub(r'\1', text)                # **x** → x
    text = _ITALIC_STAR_RE.sub(r'\1', text)         # *x* → x
    text = _BOLD_UNDER_RE.sub(r'\1', text)          # __x__ → x
    text = _ITALIC_UNDER_RE.sub(r'\1', text)        # _x_ → x
    text = _LINK_RE.sub(r'\1', text)                # [text](url) → text
    text = _CODE_INLINE_RE.sub(r'\1', text)         # `code` → code
    text = _CODE_BLOCK_RE.sub('', text)             # ```block``` → ''
    text = text.replace('```', '').replace('``', '')
    text = _HR_RE.sub('', text)                     # --- → ''
    text = _BLOCKQUOTE_RE.sub('', text)             # > text → text
    text = _LIST_BULLET_RE.sub('', text)            # - item → item
    text = _LIST_NUM_RE.sub('', text)               # 1. item → item
    text = _HTML_TAGS_RE.sub('', text)              # <tag> → ''
    text = _ELLIPSIS_RE.sub('.', text)              # ... → .
    text = _EXCLAIM_RE.sub('!', text)               # !!! → !
    text = _QUESTION_RE.sub('?', text)              # ??? → ?
    text = _SPACES_RE.sub(' ', text)                # multiple spaces → single
    text = _NEWLINES_RE.sub('\n\n', text)           # 3+ newlines → 2
    return text.strip()
