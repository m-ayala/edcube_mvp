"""Tidy the layout of generated block text so it reads cleanly.

The model sometimes runs a content block's sections together in one paragraph:
    "**Explain It**: Soldering is ... circuits. **In Real Life**: You can find ..."
This puts every section header on its own line, with a blank line between sections:
    "**Explain It**\\nSoldering is ... circuits.\\n\\n**In Real Life**\\nYou can find ..."
Bold words inside a sentence ("is **very** hot") are left alone: a header is a short bold phrase at
the start of the text, the start of a line, or right after the end of a sentence. The frontend has
the same rules (frontend/src/utils/contentFormat.js) for text saved before this existed.
"""
import re

# A short bold phrase (no sentence punctuation inside), optional colon, then spaces.
_HEADER = r"\*\*([A-Za-z][^*\n.!?]{0,40}?)\*\*:?[ \t]*"

# Header after the end of a sentence, mid-line: "...circuits. **In Real Life**: You ..."
_MID = re.compile(r"(?<=[.!?)\"'])[ \t]+" + _HEADER)
# Header at the start of the text or of a line, with text after it on the same line.
_LINE_START = re.compile(r"(^|\n)[ \t]*" + _HEADER + r"(?=\S)")


def tidy_block_content(text):
    """Return `text` with section headers on their own lines. Non-strings are returned unchanged."""
    if not isinstance(text, str) or "**" not in text:
        return text
    out = text.replace("\r\n", "\n")
    out = _MID.sub(lambda m: f"\n\n**{m.group(1).strip()}**\n", out)
    out = _LINE_START.sub(lambda m: f"{m.group(1)}**{m.group(2).strip()}**\n", out)
    # A header that already sits on its own line but has no blank line before it.
    out = re.sub(r"([^\n])\n(\*\*[^*\n]{1,42}\*\*\n)", r"\1\n\n\2", out)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()
