"""
Shared helpers for building sibling/dedup context passed into prompts.
Used by both Phase 1.5 (subsection ideation) and Phase 2 (block generation)
so both stages build the "already covered" list the same way.
"""

from typing import Dict, List


def build_subsection_labels(sections: List[Dict]) -> List[Dict]:
    """
    Flatten sections -> subsections into a list of {'section': title, 'subsection': title}
    pairs, for passing into a prompt's "do not repeat this content" instruction.
    """
    labels = []
    for section in sections:
        section_title = section.get('title', '')
        for sub in section.get('subsections', []):
            labels.append({'section': section_title, 'subsection': sub.get('title', '')})
    return labels
