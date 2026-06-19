"""
AI moderation chain — Phase 3.

Calls Gemini via LangChain and returns raw per-category confidence + reasoning.
The AI does NOT decide clear/detected or overall_outcome — that is computed in
verdict_service.py from admin policy (threshold + enforcement).

This matches your original LangChain design, with one important split:
  AI layer   → confidence + reasoning only
  App layer  → threshold comparison + enforcement → ImageVerdict
"""

import asyncio
import base64
from functools import lru_cache
from typing import List

from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field

from app.config import get_settings
from app.models.moderation_models import ModerationCategory


class CategoryAIResult(BaseModel):
    """
    Raw AI output for one category — no clear/detected label yet.

    verdict_service compares confidence against the admin threshold to
    produce the final ClassificationResult.
    """

    category: ModerationCategory
    confidence: float = Field(ge=0, le=100, description="How strongly the image matches this category")
    reasoning: str = Field(min_length=1, description="Short explanation for this category")


class ModerationAIResponse(BaseModel):
    """What we ask Gemini to return — per-category scores only, no overall verdict."""

    category_breakdown: List[CategoryAIResult]


parser = PydanticOutputParser(pydantic_object=ModerationAIResponse)

prompt = PromptTemplate(
    template="""You are an AI content moderation system screening an uploaded image.

Evaluate the image against ONLY the following active categories. Do not include
any category that is not listed below — disabled categories must be skipped entirely.

Active categories (for context; the platform applies thresholds in software):
{active_categories}

For each active category listed above, return:
- category: exact category name from the list
- confidence: 0–100 score for how strongly the image matches that category
- reasoning: one or two sentences explaining your score

Do NOT return clear/detected labels or an overall approval decision.
Return only the categories listed above.

{format_instructions}
""",
    input_variables=["active_categories"],
    partial_variables={"format_instructions": parser.get_format_instructions()},
)


@lru_cache
def _get_model() -> ChatGoogleGenerativeAI:
    """Reuse one model instance; API key comes from settings / .env."""
    settings = get_settings()
    if not settings.google_api_key:
        raise RuntimeError("GOOGLE_API_KEY is not set — required for AI moderation")
    return ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.google_api_key,
    )


def _run_ai_chain(image_path: str, active_categories: str) -> ModerationAIResponse:
    """
    Synchronous LangChain call (run inside asyncio.to_thread from async code).

    Sends the image as base64 alongside the rendered prompt text.
    """
    with open(image_path, "rb") as image_file:
        image_b64 = base64.b64encode(image_file.read()).decode("utf-8")

    rendered_text = prompt.format(active_categories=active_categories)
    model = _get_model()
    image_chain = model | parser

    return image_chain.invoke(
        [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": rendered_text},
                    {
                        "type": "image_url",
                        "image_url": f"data:image/jpeg;base64,{image_b64}",
                    },
                ],
            }
        ]
    )


async def analyze_image(
    image_path: str,
    active_categories: str,
) -> ModerationAIResponse:
    """
    Run Gemini on an image file and return raw per-category AI results.

    Args:
        image_path: Path to the image on disk.
        active_categories: Human-readable list of enabled categories for the prompt.
    """
    return await asyncio.to_thread(_run_ai_chain, image_path, active_categories)
