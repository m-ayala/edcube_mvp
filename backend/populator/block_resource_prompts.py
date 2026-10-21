"""
Prompts for "Links & Resources" generation (Browserbase), one lesson block at a time.

WHERE TO LOOK when generated resources are off:

  1. The block's own text. Resources are planned from what the block says, so the
     first place to look is the prompt that WROTE the block:
       - outliner/block_prompts.py  (get_block_generation_prompt: block content)
       - outliner/subsection_selection_prompts.py  (which blocks exist, their type,
         subtype and title)
  2. This file: how that block text becomes web searches (build_plan_prompt), and
     how results are judged (build_text_judge_prompt for articles and videos,
     build_image_judge_prompt for pictures).

The search, page-reading and filtering code (video length cap, age restriction,
source ranking, dedupe) lives in populator/block_resource_finder.py.

Everything here is driven by the block itself: its type, subtype, title, text,
subject and grade. The examples below come from several subjects on purpose and
are illustrations only; nothing in this file is tied to one subject.
"""

from typing import Dict, Optional

# ----------------------------------------------------------------------------
# Per block type: what each of the three groups should contain.
# ----------------------------------------------------------------------------

BLOCK_TYPE_GUIDANCE: Dict[str, Dict[str, str]] = {
    "content": {
        "kind": "CONTENT (instruction) block",
        "articles": (
            "Readable pages that explain exactly the concepts THIS block teaches: a student-level "
            "explainer, a teacher guide for teaching it, and a source for any real-life example the "
            "block names. Not a general overview or history of the whole topic."
        ),
        "images": (
            "Pictures of the specific things the block names or describes: its real-life examples, "
            "diagrams of its processes or parts, specimens, places, people, objects, artworks, maps."
        ),
        "videos": (
            "1-2 queries for a short explainer or demonstration of exactly these concepts "
            "(not a general history of the topic)."
        ),
    },
    "worksheet": {
        "kind": "WORKSHEET",
        "articles": (
            "Reference pages about the items the worksheet actually tests (each term, object, event, "
            "step, organism, place...), so the teacher can check answers and students can study them. "
            "Write one query per tested item (or a small group of related items) that names the item "
            "itself, e.g. 'Furby toy how it works', not the worksheet's whole question, which is too "
            "narrow to find. Not general background on the topic."
        ),
        "judge": (
            "For this worksheet, a page that explains one or more of the items the worksheet tests "
            "(what it is, how it works, what it looks like) serves a need: score it 7-8 even if it "
            "does not cover every item or the exact question. Background unrelated to the tested items is 3-4."
        ),
        "max_image_subjects": "6",
        "images_per_subject": "1",
        "images": (
            "Pictures of the actual items students must identify, match, label, order or compare. "
            "For a matching worksheet, picture the items on BOTH sides where they are visual; for "
            "labeling, a clear diagram of the thing being labeled; for sequencing, the stages or events. "
            "Use the worksheet's own items, never other examples from the wider topic."
        ),
        "videos": (
            "OPTIONAL. Only a query for a short video that shows the specific items or process the "
            "worksheet asks about. Return an empty list if a video would not help with this worksheet."
        ),
    },
    "activity": {
        "kind": "hands-on classroom ACTIVITY",
        "articles": (
            "A lesson plan or step-by-step procedure for this kind of activity, the background facts "
            "students need to do it, and a how-to or technique guide (include safety guidance if the "
            "activity involves tools, heat or chemicals). Not general background on the topic."
        ),
        "images": (
            "Pictures of what students make or do (models, exemplars, finished examples) and of the "
            "specific objects or materials the activity uses or asks students to look at. Every "
            "picture must be the same kind of thing the activity is about."
        ),
        "videos": (
            "1-2 queries for a short demonstration of the activity's technique or procedure, or of "
            "the finished product."
        ),
    },
}

# Illustrations only, from several subjects, so the planner never narrows to one field.
PLAN_EXAMPLES = """\
EXAMPLES (illustrations only; always plan from the block you were given):
- Worksheet, Matching, robotics: "Match each animatronic to its ear mechanism".
  Articles: how each named animatronic's ears move. Images: each named animatronic, each ear mechanism.
  Videos: optional, a short clip of one of those ear mechanisms moving.
- Worksheet, Labeling, biology: "Label the parts of a plant cell".
  Articles: what each organelle does. Images: a labeled plant cell diagram, a plant cell micrograph.
  Videos: optional, a short tour of a plant cell.
- Worksheet, Sequencing, history: "Put the events before the American Revolution in order".
  Articles: each event (Stamp Act, Boston Massacre, Boston Tea Party). Images: Paul Revere's Boston
  Massacre engraving, a 1765 Stamp Act stamp. Videos: none needed.
- Activity, chemistry: "Make a pH indicator from red cabbage".
  Articles: procedure with safety notes, why cabbage changes colour. Images: red cabbage indicator
  colour chart, test tubes of cabbage indicator. Videos: a demonstration of the experiment.
- Activity, geography: "Build a salt-dough relief map of your state".
  Articles: step-by-step salt-dough map instructions, the state's landforms. Images: a relief map of
  that state, finished student salt-dough maps. Videos: how to make a salt-dough map.
- Content, history: "Causes of World War I".
  Articles: student explainer of the alliance system and the assassination of Franz Ferdinand.
  Images: 1914 map of European alliances, "The Boiling Point" political cartoon. Videos: short explainer.
- Content, art: "Components of Art Nouveau".
  Articles: explainer of whiplash curves and nature motifs. Images: Hector Guimard's Paris Metro
  entrance, a Louis Comfort Tiffany window. Videos: short explainer of the style's features."""


def guidance_for(block_type: str) -> Dict[str, str]:
    bt = (block_type or "").lower()
    if "activit" in bt:
        return BLOCK_TYPE_GUIDANCE["activity"]
    if "worksheet" in bt:
        return BLOCK_TYPE_GUIDANCE["worksheet"]
    return BLOCK_TYPE_GUIDANCE["content"]


# ----------------------------------------------------------------------------
# 1. Planning: block text -> what to search for
# ----------------------------------------------------------------------------

def build_plan_prompt(block_text: str, block_type: str, grade: str, max_image_subjects: int) -> str:
    g = guidance_for(block_type)
    max_image_subjects = int(g.get("max_image_subjects", max_image_subjects))
    grade_part = f" for grade {grade}" if grade else ""
    return f"""A teacher has this {g['kind']}{grade_part}:
{block_text}

Plan the web resources to attach to THIS block, in three groups. Read the block's title, subtype and
full text first: they decide what to search for. A group may be empty if nothing fits.
For elementary or middle-school grades, phrase article and video queries so they find student-level
pages (e.g. add "for kids" or "for students"), not university or industry material.

ARTICLES: {g['articles']}
IMAGES: {g['images']}
  Maximum {max_image_subjects} subjects, the most useful first. Each query must name the specific thing
  precisely (a named object, organism, place, event, person, diagram or work), never just the broad topic.
  Prefer things museums, Wikimedia, science or government sites would hold.
VIDEOS: {g['videos']}

{PLAN_EXAMPLES}

Return JSON:
{{"essence": "<one sentence: what this block teaches or has students do>",
  "needs": "<what a teacher needs to deliver this block, 1-2 sentences>",
  "articles": [{{"role": "<short role, e.g. student_explainer, item_reference, lesson_plan, safety_guide>", "query": "..."}}],
  "images": [{{"subject": "<what the picture must show>", "why": "<the line or item in the block it illustrates>", "query": "..."}}],
  "videos": ["query"]}}
Give up to 3 article entries with different roles."""


PLAN_SYSTEM = "You plan classroom resources precisely from lesson text, for any school subject."


# ----------------------------------------------------------------------------
# 2. Judging articles and videos
# ----------------------------------------------------------------------------

def build_text_judge_prompt(block_text: str, essence: str, needs: str, grade: str,
                            group: str, title: str, url: str, text: str,
                            video_info: Optional[str] = None, block_type: str = "") -> str:
    grade_part = f" (grade {grade})" if grade else ""
    type_note = guidance_for(block_type).get("judge", "")
    if group == "videos":
        want = "a short video that explains or demonstrates exactly what this block covers"
        extra = f"""
Video details: {video_info or 'title and channel only'}
Also decide:
 - "appropriate": true only if suitable for students{grade_part} in class: no graphic violence, gore,
   sexual content, profanity, frightening or mature themes, and aimed at a general or student audience.
 - "language_ok": true if the video is in the same language as the block (judge from title/description).
Score from the title, channel and description: 7-8 when it clearly promises a tutorial/explainer of THIS
block's specific topic or items, 5-6 when only topic-adjacent, 3-4 for a general overview."""
        ret = '{"score": int, "appropriate": bool, "language_ok": bool, "reason": "<=18 words, plain, why it fits this block>"}'
    else:
        want = "a readable page that serves one of the teacher's needs for exactly this block"
        extra = ""
        ret = '{"score": int, "reason": "<=18 words, plain, why it fits this block>"}'
    return f"""Teacher's block{grade_part}: {essence}
Full block:
{block_text[:3500]}

Teacher needs: {needs}
Candidate ({group[:-1]}): {title} ({url})
Page text: {text[:4500]}

We want {want}. Score 0-10 with this scale:
 9-10  directly serves a need for THIS block and is usable as-is at this grade
 7-8   clearly serves a need but needs light adaptation (grade level, length, adjacent focus)
 5-6   partially useful: same topic but a different angle, or only part of a need
 3-4   general topic background only, not matched to what this block teaches or does
 0-2   irrelevant, store/marketplace page, paywalled, or unreadable
A broad overview of the whole topic is 3-4 even if it is well written.{(chr(10) + type_note) if type_note else ''}{extra}
Return JSON: {ret}"""


TEXT_JUDGE_SYSTEM = "You are a practical K-12 teacher choosing resources for tomorrow's class. Be strict."


# ----------------------------------------------------------------------------
# 3. Checking images (the vision model looks at each picture)
# ----------------------------------------------------------------------------

def build_image_judge_prompt(subject: str, grade: str) -> str:
    grade_part = f" (grade {grade})" if grade else ""
    return f"""This picture is a candidate for a lesson{grade_part}. It must show: {subject}.
Look at the image itself. Score 0-10: 10 = clearly IS that exact subject, good quality, classroom-appropriate;
6 = related but not the named subject; 0-3 = wrong subject, mostly text, product ad, watermarked store photo,
tiny/blurry, or not suitable for students.
Return JSON: {{"score": int, "caption": "<what the image actually shows, <=15 words>"}}"""


IMAGE_JUDGE_SYSTEM = "You verify images for teachers. Judge only what is visible."
