"""Cost log (UsageLog) row counts and contents (TASK-034). OpenAI and Browserbase are stubbed."""
import asyncio
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi import Depends
from fastapi.responses import StreamingResponse

import main
import services.cost_tracker as CT
import services.usage_service as US
import utils.llm_handler as LH
from tests.conftest import D, H, STORE

PRICED = {"cost_rates": {"is_placeholder": False, "currency": "USD",
                         "llm_per_1m_tokens": {"default": {"input": 1, "output": 1}, "gpt-4o": {"input": 2.5, "output": 10}},
                         "browserbase": {"per_search": 0.01, "per_fetch": 0.002, "per_session": 0,
                                         "per_session_minute": 0.1, "per_render_page": 0.001}}}
URL = "/api/curriculum/generate-block-links"
BODY = {"blockType": "content", "blockTitle": "Fractions", "topicTitle": "Fractions", "courseId": "course-77"}


@pytest.fixture
def links(w, openai_stub, browserbase_stub, monkeypatch):
    """generate-block-links with the finder doing 2 searches, 3 fetches (one nested pool) and 1 LLM call."""
    import populator.block_resource_finder as BRF
    BC = browserbase_stub
    mode = {"v": "ok"}

    def fake_find(**kw):
        BC.search("q1"); BC.search("q2")                       # in the executor worker thread
        with ThreadPoolExecutor(3) as ex:                      # and from a pool NESTED inside it
            list(ex.map(BC.fetch_html, ["https://a.org", "https://b.org", "https://c.org"]))
        LH.call_openai("prompt", "system")
        if mode["v"] == "boom":
            raise RuntimeError("browserbase down")
        return {"links": [{"url": "https://x.org/a", "label": "A", "type": "article"}]}

    monkeypatch.setattr(BRF, "find_block_resources", fake_find)
    w.acct("u1", "trial", D(2026, 10, 19, 12), D(2026, 11, 18, 12))
    w.who("u1", "u1@gmail.com", org="personal")
    w.find_mode = mode
    return w


def test_one_ai_action_writes_exactly_one_row_with_exact_counts(links):
    w = links
    STORE["EdCube/platform_config"] = PRICED
    import services.platform_config as PC
    PC.clear_cache()
    r = w.c.post(URL, headers=H, json=BODY)
    rows = w.log_rows()
    assert r.status_code == 200 and len(rows) == 1
    row = rows[0]
    bb = row["browserbase"]
    assert bb["search"] == 2 and bb["fetch"] == 3 and bb["sessions"] == 0 and row["used_browserbase"] is True
    assert row["llm"] == {"calls": 1, "by_model": {"gpt-4o-2024-08-06": {"prompt": 100, "completion": 50, "total": 150}}, "total_tokens": 150}
    assert (row["uid"], row["plan"], row["workspace"], row["pool"], row["action"], row["credit_kind"], row["charged"],
            row["course_id"], row["email_domain"]) == ("u1", "trial", "personal", False, "generate_block_links",
                                                       "generates", True, "course-77", "gmail.com")
    assert row["success"] is True and row["error_code"] is None
    est = row["est_cost_usd"]                                  # priced from platform_config, prefix-matched gpt-4o
    assert abs(est["llm"] - 0.00075) < 1e-9 and abs(est["browserbase"] - 0.026) < 1e-9 and row["est_cost_is_placeholder"] is False
    assert w.used("personal", "u1", "trial", "generates") == 1


def test_default_rates_are_zero_placeholders_but_tokens_are_still_logged(links):
    w = links
    w.c.post(URL, headers=H, json=BODY)
    row = w.log_rows()[0]
    assert row["est_cost_usd"]["total"] == 0 and row["est_cost_is_placeholder"] is True and row["llm"]["total_tokens"] == 150


def test_a_swallowed_failure_is_one_row_success_false_charged_false(links):
    w = links
    w.find_mode["v"] = "boom"
    r = w.c.post(URL, headers=H, json=BODY)
    rows = w.log_rows()
    assert r.status_code == 200 and len(rows) == 1
    assert rows[0]["success"] is False and rows[0]["charged"] is False
    assert rows[0]["browserbase"]["search"] == 2 and rows[0]["llm"]["calls"] == 1      # partial work is still costed
    assert w.used("personal", "u1", "trial", "generates") == 0


def test_http_error_and_crash_rows_and_quota_refusal_writes_none(w, gen_mode):
    w.acct("u1", "trial", D(2026, 10, 19, 12), D(2026, 11, 18, 12))
    w.who("u1", "u1@gmail.com", org="personal")
    gen_mode["v"] = "502"
    r = w.c.post("/api/_t/gen_named", headers=H)
    row = w.log_rows()[0]
    assert r.status_code == 502 and len(w.log_rows()) == 1
    assert row["success"] is False and row["charged"] is False and row["error_code"] == "http_502" and row["action"] == "t_gen"
    w.clear_log()
    gen_mode["v"] = "crash"
    r = w.c.post("/api/_t/gen_named", headers=H)
    assert r.status_code == 500 and w.log_rows()[0]["error_code"] == "RuntimeError"
    w.clear_log()
    gen_mode["v"] = "ok"
    w.c.post("/api/_t/gen_named", headers=H)
    ok = w.log_rows()
    assert len(ok) == 1 and ok[0]["llm"]["calls"] == 0 and ok[0]["used_browserbase"] is False
    # a 402 means nothing ran: no row
    w.clear_log()
    STORE["Users/personal/usage/u1/periods/trial"] = {"used": {"generates": 50}, "reservations": {}}
    assert w.c.post("/api/_t/gen_named", headers=H).status_code == 402
    assert w.log_rows() == []


def test_edo_message_and_chips_rows(w, openai_stub):
    w.acct("u1", "trial", D(2026, 10, 19, 12), D(2026, 11, 18, 12))
    w.who("u1", "u1@gmail.com", org="personal")
    r = w.c.post("/api/curriculum/chat", headers=H, json={"message": "hello", "context": {"courseId": "course-9"}})
    rows = w.log_rows()
    assert r.status_code == 200 and len(rows) == 1
    assert rows[0]["action"] == "edo_message" and rows[0]["credit_kind"] == "edo_messages" and rows[0]["charged"] is True
    assert rows[0]["llm"]["by_model"] == {"gpt-4o-2024-08-06": {"prompt": 300, "completion": 21, "total": 321}}
    assert rows[0]["course_id"] == "course-9"
    # a failed Edo message: row says not charged, credit refunded
    w.clear_log()
    openai_stub["v"] = "err"
    assert w.c.post("/api/curriculum/chat", headers=H, json={"message": "hello"}).status_code == 500
    assert w.log_rows()[0]["success"] is False and w.log_rows()[0]["charged"] is False
    assert w.used("personal", "u1", "trial", "edo_messages") == 1
    # chips: no credit, but still logged
    w.clear_log()
    openai_stub["v"] = "ok"
    openai_stub["edo_content"] = '{"chips":["a"]}'
    r = w.c.post("/api/curriculum/chips", headers=H, json={"topic_title": "F", "course_title": "M", "block_type": "content"})
    row = w.log_rows()[0]
    assert r.status_code == 200 and len(w.log_rows()) == 1
    assert row["action"] == "edo_chips" and row["credit_kind"] is None and row["charged"] is False


def test_estimate_cost_is_pure_and_never_raises():
    e = CT.estimate_cost(
        {"search": 4, "fetch": 0, "render_pages": 10, "sessions": 1, "session_seconds": 90},
        {"by_model": {"gpt-4o-mini": {"prompt": 1_000_000, "completion": 500_000, "total": 1_500_000},
                      "weird": {"prompt": 1_000_000, "completion": 0, "total": 1_000_000}}},
        {"llm_per_1m_tokens": {"default": {"input": 1, "output": 2}, "gpt-4o": {"input": 5, "output": 5},
                               "gpt-4o-mini": {"input": 0.15, "output": 0.6}},
         "browserbase": {"per_search": 0.5, "per_render_page": 0.01, "per_session": 1, "per_session_minute": 2}})
    assert abs(e["llm"] - (0.15 + 0.3 + 1.0)) < 1e-9                      # exact model + default fallback
    assert abs(e["browserbase"] - (2.0 + 0.1 + 1 + 3.0)) < 1e-9
    assert CT.estimate_cost({}, {}, None)["total"] == 0 and CT.estimate_cost(None, None, {})["total"] == 0


def test_generate_course_stream_is_one_row_and_unusable_runs_are_not_charged(w, openai_stub, browserbase_stub, monkeypatch):
    import interpreter.requirements_interpreter as RI
    import routes.curriculum as C
    BC = browserbase_stub
    monkeypatch.setattr(RI, "interpret_requirements", lambda **kw: {"detected_subject": "Sci", "detected_topic": "Plants"})
    ph = {"outline": {"sections": [{"id": "s1", "title": "Day 1"}]}}

    def work():
        BC.search("q"); BC.fetch_html("https://a.org"); BC.fetch_html("https://b.org")
        LH.call_openai("p", "s")

    async def fake_p1(teacher_input, images=None):
        await asyncio.get_running_loop().run_in_executor(None, work)   # executor thread inside the stream
        return ph["outline"]

    async def fake_p15(teacher_input, outline_data):
        for sec in (outline_data or {}).get("sections", []):
            yield {"type": "subsections_ready", "section_id": sec["id"], "chains": [{"id": "c1", "subsections": []}], "progress": 60}
        yield {"type": "candidates_complete"}

    monkeypatch.setattr(C.orchestrator, "run_phase1", fake_p1)
    monkeypatch.setattr(C.orchestrator, "run_phase1_5", fake_p15)
    form = {"course_name": "Plants", "age_range_start": 8, "age_range_end": 10, "num_students": 10, "num_days": 2,
            "hours_per_day": 2, "num_worksheets": 1, "num_activities": 1, "organizationId": "personal", "flow": "legacy"}
    STORE["EdCube/platform_config"] = PRICED
    import services.platform_config as PC
    PC.clear_cache()
    w.acct("g1", "trial", D(2026, 10, 19, 12), D(2026, 11, 18, 12))
    w.who("g1", "g1@gmail.com", org="personal")
    r = w.c.post("/api/generate-curriculum", headers=H, data=form)
    rows = w.log_rows()
    assert r.status_code == 200 and len(rows) == 1
    row = rows[0]
    assert row["action"] == "generate_course" and row["credit_kind"] == "courses" and row["charged"] is True and row["success"] is True
    assert row["partial"]["stage"] == "candidates_complete" and row["partial"]["sections_with_chains"] == 1
    assert row["browserbase"]["search"] == 1 and row["browserbase"]["fetch"] == 2 and row["llm"]["calls"] == 1
    # unusable run: still one row, not charged, cost still counted
    ph["outline"] = {"sections": []}
    w.clear_log()
    w.c.post("/api/generate-curriculum", headers=H, data=form)
    rows = w.log_rows()
    assert len(rows) == 1 and rows[0]["charged"] is False and rows[0]["success"] is False
    assert rows[0]["partial"]["outline_sections"] == 0 and rows[0]["est_cost_usd"]["total"] > 0
    assert w.used("personal", "g1", "trial", "courses") == 1


def test_uncharged_streaming_route_logs_once_with_work_from_stream_threads(w, browserbase_stub):
    BC = browserbase_stub

    async def ustream(current_user: dict = Depends(US.track_ai("t34_stream"))):
        state = {"ok": False}

        async def gen():
            try:
                await asyncio.get_running_loop().run_in_executor(None, BC.search, "q")
                yield "data: 1\n\n"
                await asyncio.get_running_loop().run_in_executor(None, BC.fetch_html, "u")
                state["ok"] = True
            finally:
                US.finish_stream(current_user, state["ok"], None if state["ok"] else "stream_aborted")
        CT.defer(current_user)
        return StreamingResponse(gen(), media_type="text/event-stream")

    main.app.add_api_route("/api/_t34/ustream", ustream, methods=["POST"])
    w.acct("u1", "trial", D(2026, 10, 19, 12), D(2026, 11, 18, 12))
    w.who("u1", "u1@gmail.com", org="personal")
    r = w.c.post("/api/_t34/ustream", headers=H)
    rows = w.log_rows()
    assert r.status_code == 200 and len(rows) == 1
    assert rows[0]["action"] == "t34_stream" and rows[0]["credit_kind"] is None and rows[0]["charged"] is False
    assert rows[0]["browserbase"]["search"] == 1 and rows[0]["browserbase"]["fetch"] == 1 and rows[0]["success"] is True
