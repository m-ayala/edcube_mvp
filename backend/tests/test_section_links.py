"""Section-level Discover (generate-section-links): one search for every topic in a section."""
import pytest

from routes.curriculum import GenerateSectionLinksRequest, section_links_text
from tests.conftest import D, H

URL = "/api/curriculum/generate-section-links"
BODY = {
    "sectionTitle": "Meet the accelerometer",
    "sectionDescription": "What an accelerometer measures and how it works.",
    "topics": [
        {"title": "What an accelerometer measures", "blockTitles": ["Acceleration and gravity"]},
        {"title": "X, Y and Z axes", "blockTitles": []},
        {"title": "Roll, pitch and yaw", "blockTitles": ["Tilt the board"]},
    ],
    "gradeLevel": "Ages 12-14",
}


@pytest.fixture
def section_links(w, openai_stub, browserbase_stub, monkeypatch):
    import populator.block_resource_finder as BRF
    calls = []

    def fake_find(**kw):
        calls.append(kw)
        return {"links": [{"url": "https://x.org/axes", "label": "Axes", "type": "article", "box": 2},
                          {"url": "https://x.org/any", "label": "Any", "type": "article"},
                          {"url": "https://x.org/bad", "label": "Bad", "type": "article", "box": 9}]}

    monkeypatch.setattr(BRF, "find_block_resources", fake_find)
    w.acct("u1", "trial", D(2026, 10, 19, 12), D(2026, 11, 18, 12))
    w.who("u1", "u1@gmail.com", org="personal")
    w.calls = calls
    return w


def test_one_search_covers_every_topic_in_the_section(section_links):
    w = section_links
    r = w.c.post(URL, headers=H, json=BODY)
    assert r.status_code == 200
    assert r.json()["links"][0]["url"] == "https://x.org/axes"
    assert len(w.calls) == 1                      # one search for the whole section, not one per box
    kw = w.calls[0]
    assert kw["block_title"] == "Meet the accelerometer"
    for t in ("What an accelerometer measures", "X, Y and Z axes", "Roll, pitch and yaw", "Tilt the board"):
        assert t in kw["block_content"]
    assert w.used("personal", "u1", "trial", "generates") == 1


def test_section_text_lists_topics_in_order_and_skips_blank_ones():
    req = GenerateSectionLinksRequest(sectionTitle="S", topics=[
        {"title": "First"}, {"title": "  "}, {"title": "Second", "blockTitles": ["a", "b"]},
    ])
    text = section_links_text(req)
    assert "1. First" in text and "2. Second (boxes: a; b)" in text
    assert text.index("First") < text.index("Second")


def test_too_many_topics_is_rejected(section_links):
    w = section_links
    body = {**BODY, "topics": [{"title": f"t{i}"} for i in range(31)]}
    assert w.c.post(URL, headers=H, json=body).status_code == 422


def test_each_link_says_which_box_it_was_found_for(section_links):
    w = section_links
    body = {**BODY, "topics": [{"title": "Measures"}, {"title": "  "}, {"title": "Axes"}]}
    links = w.c.post(URL, headers=H, json=body).json()["links"]
    assert w.calls[0]["boxes"] == ["Measures", "Axes"]          # blank titles are not boxes
    assert links[0]["topicIndex"] == 2 and "box" not in links[0]  # box 2 = "Axes" = topics[2]
    assert "topicIndex" not in links[1] and "topicIndex" not in links[2]


def test_cover_boxes_gives_every_box_its_best_link_first():
    from populator.block_resource_finder import _cover_boxes, MIN_TEXT_SCORE as M
    judged = [
        {"url": "a1", "box": 1, "score": M + 3},
        {"url": "a2", "box": 1, "score": M + 2},
        {"url": "a3", "box": 1, "score": M + 1},
        {"url": "b1", "box": 2, "score": M - 1},   # below the cutoff, but box 2 has nothing better
        {"url": "c1", "box": 3, "score": M - 5},   # too weak even for coverage
    ]
    picked = [j["url"] for j in _cover_boxes(judged, 3, 3, M - 2)]
    assert picked == ["a1", "b1", "a2"]
