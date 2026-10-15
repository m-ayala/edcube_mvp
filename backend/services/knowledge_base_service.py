"""
Knowledge Base Service
Read access to the taxonomy knowledge base, stored under the single
`EdCube/knowledge_base` document as categorized subcollections (see
backend/firebase/paths.py and tasks/firestore-reorg-spec.md):

    category             old top-level collection (pre-reorg name)
    -------------------  -----------------------------------------
    age                  kb_age_bands
    pedagogy             kb_objectives
    worksheets           kb_worksheet_formats
    activities           kb_activity_formats
    content              kb_content_formats
    content_types        kb_content_types          (Course Builder, new category)
    thinking_levels      kb_thinking_levels        (Course Builder, new category)
    group_sizes          kb_group_sizes            (Course Builder, new category)
    teacher_attention    kb_teacher_attention_levels (Course Builder, new category)

The mapping lives in kb_seed_data.KB_CATEGORY. The old `kb_*` names are still
accepted by the internal helpers (and used as the keys of kb_seed_data.COLLECTIONS)
but nothing reads or writes top-level `kb_*` collections any more.

The raw accessors (get_age_bands() ... get_content_formats()) keep their names,
signatures and return shapes; only the path changed. The "resolved" lookups
further down are for the Course Builder: they merge in defaults from
kb_seed_data.py for any field or document not yet seeded, and never raise (if
Firestore is unreachable they serve the seed data), so they work before the
seeder has been run.

This data changes rarely, so each category is fetched once and cached in
memory for the lifetime of the process.
"""

from typing import Dict, List, Optional
import firebase_admin
from firebase_admin import firestore
from firebase.paths import kb_col
from services.kb_seed_data import KB_CATEGORY

_cache: Dict[str, List[Dict]] = {}


def _get_db():
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    return firestore.client()


def _get_collection_cached(name: str) -> List[Dict]:
    """Docs of one KB category, cached. `name` may be a category ('pedagogy') or
    an old kb_* collection name ('kb_objectives'); both read the same category."""
    category = KB_CATEGORY.get(name, name)
    if category not in _cache:
        db = _get_db()
        docs = kb_col(db, category).stream()
        _cache[category] = [{'id': d.id, **d.to_dict()} for d in docs]
    return _cache[category]


def get_age_bands() -> List[Dict]:
    return _get_collection_cached('age')


def get_objectives() -> List[Dict]:
    return _get_collection_cached('pedagogy')


def get_worksheet_formats() -> List[Dict]:
    return _get_collection_cached('worksheets')


def get_activity_formats() -> List[Dict]:
    return _get_collection_cached('activities')


def get_content_formats() -> List[Dict]:
    return _get_collection_cached('content')


# ---------------------------------------------------------------------------
# Resolved lookups (additive). Safe before the seeder is run; never raise.
# ---------------------------------------------------------------------------

import copy
import logging

from services import kb_seed_data as _seed

_logger = logging.getLogger(__name__)


def _resolved(collection_name: str) -> List[Dict]:
    """
    Firestore docs for a collection, each with blank/missing fields filled from
    the seed data, plus seed docs whose id is absent from Firestore (e.g. a
    format added after the collection was first seeded). Docs with
    active == False are dropped (the way to retire a seeded doc). Returns deep
    copies, in seed order first, then any extra Firestore-only docs.
    """
    seed_items = _seed.COLLECTIONS.get(collection_name, [])
    try:
        live = list(_get_collection_cached(collection_name))
    except Exception as e:  # no credentials, network, etc.
        _logger.warning("KB read of %s failed, using seed data: %s", collection_name, e)
        live = []
    live_by_id = {d['id']: d for d in live}
    out = []
    for item in seed_items:
        doc = copy.deepcopy(item)
        if item['id'] in live_by_id:
            for k, v in live_by_id[item['id']].items():
                if not _seed.is_blank(v) or k not in doc:
                    doc[k] = copy.deepcopy(v)
        out.append(doc)
    seed_ids = {i['id'] for i in seed_items}
    out.extend(copy.deepcopy(d) for d in live if d['id'] not in seed_ids)
    return [d for d in out if d.get('active', True) is not False]


def _num(v, default=None):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def find_age_bands(age_min, age_max=None) -> List[Dict]:
    """
    Age bands that fit an age range, best fit first. Bands overlap on purpose, so
    several can be returned. Uses positive overlap; if none overlaps, bands that
    touch or contain the range; if still none, the single nearest band.
    Returns [] only if the age is not a number or there are no bands.
    """
    lo = _num(age_min)
    hi = _num(age_max, lo)
    if lo is None or hi is None:
        return []
    if hi < lo:
        lo, hi = hi, lo
    bands = [b for b in _resolved('kb_age_bands') if _num(b.get('age_min')) is not None and _num(b.get('age_max')) is not None]
    scored = []
    for b in bands:
        overlap = min(hi, float(b['age_max'])) - max(lo, float(b['age_min']))
        scored.append((overlap, b))
    positive = [(o, b) for o, b in scored if o > 0]
    if positive:
        positive.sort(key=lambda t: -t[0])
        return [b for _, b in positive]
    touching = [b for o, b in scored if o == 0]
    if touching:
        return touching
    if not scored:
        return []
    nearest = min(scored, key=lambda t: -t[0])  # least negative overlap = nearest
    return [nearest[1]]


def get_primary_age_band(age_min, age_max=None) -> Optional[Dict]:
    """The single best-fit age band for an age range, or None."""
    bands = find_age_bands(age_min, age_max)
    return bands[0] if bands else None


def get_objective_categories() -> List[Dict]:
    """Objective categories as [{id, label, description}] for prompts and the UI."""
    return [
        {'id': o['id'], 'label': o.get('label', o['id']), 'description': o.get('description', '')}
        for o in _resolved('kb_objectives')
    ]


def get_content_types() -> List[Dict]:
    """Content types ([{id, label, description, legacy, ...}]) from kb_content_types."""
    return _resolved('kb_content_types')


def get_thinking_levels() -> List[Dict]:
    """Worksheet thinking levels as [{id, label, description}], in display order."""
    return _vocab('kb_thinking_levels')


def get_teacher_attention_levels() -> List[Dict]:
    """Teacher attention levels as [{id, label, description}], low to high."""
    return _vocab('kb_teacher_attention_levels')


def get_group_sizes() -> List[Dict]:
    """
    Activity group sizes as [{id, label, description, is_default?}], smallest to
    largest. Which sizes an activity format allows is that format's `group_sizes`
    (a list of these ids).
    """
    return _vocab('kb_group_sizes')


def get_group_size_ids() -> List[str]:
    """Just the group-size ids, e.g. ['individual', 'pairs', 'small_groups', 'whole_class']."""
    return [g['id'] for g in get_group_sizes()]


def get_default_group_size() -> str:
    """
    The group size to use when an activity has no valid size and its format lists
    none: the group-size item flagged is_default (kb_group_sizes), else the seed
    default, else the first group size. Always returns an id; never raises.
    """
    items = get_group_sizes()
    for g in items:
        if g.get('is_default') is True:
            return g['id']
    ids = [g['id'] for g in items]
    if _seed.DEFAULT_GROUP_SIZE in ids or not ids:
        return _seed.DEFAULT_GROUP_SIZE
    return ids[0]


def _vocab(collection_name: str) -> List[Dict]:
    """[{id, label, description, ...}] for a small vocabulary; label falls back to the id."""
    out = []
    for d in _resolved(collection_name):
        d['label'] = d.get('label') or d['id']
        d.setdefault('description', '')
        out.append(d)
    return out


def _band_ids_for(age_min, age_max) -> Optional[set]:
    if age_min is None:
        return None
    ids = {b['id'] for b in find_age_bands(age_min, age_max)}
    return ids or None


def _age_ok(fmt: Dict, band_ids: Optional[set]) -> bool:
    suitable = fmt.get('suitable_age_bands')
    if band_ids is None or not suitable:  # no filter, or unknown -> keep
        return True
    return bool(band_ids & set(suitable))


def _class_size_ok(fmt: Dict, class_size) -> bool:
    n = _num(class_size)
    if n is None:
        return True
    lo, hi = _num(fmt.get('min_class_size')), _num(fmt.get('max_class_size'))
    return (lo is None or n >= lo) and (hi is None or n <= hi)


def get_worksheet_formats_for(age_min=None, age_max=None, class_size=None) -> List[Dict]:
    """Worksheet formats usable for an age range (any band that overlaps it)."""
    band_ids = _band_ids_for(age_min, age_max)
    return [f for f in _resolved('kb_worksheet_formats') if _age_ok(f, band_ids)]


def get_activity_formats_for(age_min=None, age_max=None, class_size=None) -> List[Dict]:
    """Activity formats usable for an age range and class size. Filters left out when None."""
    band_ids = _band_ids_for(age_min, age_max)
    return [f for f in _resolved('kb_activity_formats')
            if _age_ok(f, band_ids) and _class_size_ok(f, class_size)]


def get_pairing_table(age_min=None, age_max=None, class_size=None) -> List[Dict]:
    """
    content type -> worksheet formats that test it -> activity formats that apply it.
    Returns [{content_type_id, label, worksheet_format_ids, activity_format_ids}].
    With age/class_size given, format ids are limited to those that pass the same
    filters as get_worksheet_formats_for / get_activity_formats_for; ids that do not
    exist in the knowledge base are always dropped.
    """
    ws_ids = {f['id'] for f in get_worksheet_formats_for(age_min, age_max, class_size)}
    act_ids = {f['id'] for f in get_activity_formats_for(age_min, age_max, class_size)}
    table = []
    for ct in get_content_types():
        table.append({
            'content_type_id': ct['id'],
            'label': ct.get('label', ct['id']),
            'worksheet_format_ids': [i for i in (ct.get('worksheet_format_ids') or []) if i in ws_ids],
            'activity_format_ids': [i for i in (ct.get('activity_format_ids') or []) if i in act_ids],
        })
    return table


def get_legacy_label_map() -> Dict[str, Dict[str, str]]:
    """
    Map the subtype strings used by outliner/block_prompts.py (and stored on
    existing courses) to knowledge base ids:
    {'content': {'Categories/Types': 'categories_types', ...},
     'worksheet': {...}, 'activity': {...}}
    """
    m = {'content': {}, 'worksheet': {}, 'activity': {}}
    for ct in get_content_types():
        if ct.get('legacy', True) and ct.get('label'):
            m['content'][ct['label']] = ct['id']
    for kind, coll in (('worksheet', 'kb_worksheet_formats'), ('activity', 'kb_activity_formats')):
        for f in _resolved(coll):
            for lbl in f.get('legacy_labels') or []:
                m[kind][lbl] = f['id']
    return m


def get_legacy_subtypes(kind: str) -> List[str]:
    """
    The old-flow subtype labels for kind 'worksheet' or 'activity', in the order the
    old-flow prompts list them: every active format's `legacy_labels`, sorted by the
    parallel `legacy_order` list (same position = same label). Labels without a usable
    order (e.g. added or renamed by hand with no order) go after the ordered ones, in
    knowledge base order. Duplicate labels appear once. Returns [] for an unknown kind
    or on any problem; never raises.
    """
    try:
        coll = {'worksheet': 'kb_worksheet_formats', 'activity': 'kb_activity_formats'}.get(kind)
        if coll is None:
            return []
        entries = []  # (has_order, order, kb_position, label)
        pos = 0
        for f in _resolved(coll):
            labels = f.get('legacy_labels') or []
            orders = f.get('legacy_order') or []
            if not isinstance(labels, list):
                continue
            if not isinstance(orders, list):
                orders = []
            for i, lbl in enumerate(labels):
                if not isinstance(lbl, str) or not lbl:
                    continue
                o = orders[i] if i < len(orders) else None
                ok = isinstance(o, (int, float)) and not isinstance(o, bool)
                entries.append((0 if ok else 1, o if ok else 0, pos, lbl))
                pos += 1
        entries.sort(key=lambda e: (e[0], e[1], e[2]))
        out: List[str] = []
        for e in entries:
            if e[3] not in out:
                out.append(e[3])
        return out
    except Exception as e:
        _logger.warning("get_legacy_subtypes(%r) failed: %s", kind, e)
        return []


def get_taxonomy(age_min=None, age_max=None, class_size=None) -> Dict:
    """Everything the Course Builder UI needs, in one dict (served by the API route)."""
    band = get_primary_age_band(age_min, age_max) if age_min is not None else None
    return {
        'objective_categories': get_objective_categories(),
        'content_types': get_content_types(),
        'worksheet_formats': get_worksheet_formats_for(age_min, age_max, class_size),
        'activity_formats': get_activity_formats_for(age_min, age_max, class_size),
        'pairing_table': get_pairing_table(age_min, age_max, class_size),
        'age_band': band,
        'vocabularies': {
            # unchanged: bare id lists (existing consumers)
            'thinking_levels': [i['id'] for i in get_thinking_levels()],
            'group_sizes': get_group_size_ids(),
            'teacher_attention_levels': [i['id'] for i in get_teacher_attention_levels()],
        },
        # additive: the same vocabularies with teacher-facing labels
        'vocabularies_detail': {
            'thinking_levels': get_thinking_levels(),
            'group_sizes': get_group_sizes(),
            'teacher_attention_levels': get_teacher_attention_levels(),
            'default_group_size': get_default_group_size(),
        },
    }
