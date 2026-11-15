"""Block text layout: section headers on their own lines (utils/content_format.py)."""
from utils.content_format import tidy_block_content

RUN_ON = ("**Explain It**: Soldering is the process of joining two or more electronic components. "
          "Soldering is commonly used in electronics to build and repair circuits. **In Real Life**: "
          "You can find soldering in smartphones, computers, and TVs. **Why It Matters**: It is a "
          "**very** fundamental skill.")


def test_run_on_sections_are_split_onto_their_own_lines():
    assert tidy_block_content(RUN_ON) == (
        "**Explain It**\nSoldering is the process of joining two or more electronic components. "
        "Soldering is commonly used in electronics to build and repair circuits.\n\n"
        "**In Real Life**\nYou can find soldering in smartphones, computers, and TVs.\n\n"
        "**Why It Matters**\nIt is a **very** fundamental skill."
    )


def test_well_formatted_text_is_unchanged():
    good = "**Explain It**\nA sentence.\n\n**How It Works**\n1. One\n2. Two\n\n**In Real Life**\n- Phones"
    assert tidy_block_content(good) == good


def test_missing_blank_line_before_a_header_is_added():
    assert tidy_block_content("**Explain It**\nA.\n**In Real Life**\n- b") == "**Explain It**\nA.\n\n**In Real Life**\n- b"


def test_plain_text_and_non_strings_pass_through():
    assert tidy_block_content("No headers here.") == "No headers here."
    assert tidy_block_content(None) is None
