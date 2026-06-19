"""
Verdict computation — Phase 3.

Takes raw AI output and admin policy, then builds the final ImageVerdict:

  1. Compare each category's confidence against its configured threshold
     → clear (below) or detected (at/above)
  2. For detected categories, read enforcement action from policy
     → Auto-Block beats Flag for Review; nothing detected → Approved
  3. Merge with image_id + policy_version_id into ImageVerdict
"""

from datetime import datetime

from app.models.moderation_models import (
    CategoryVerdict,
    ClassificationResult,
    EnforcementAction,
    ImageVerdict,
    OverallOutcome,
)
from app.models.policy import CategoryPolicy, PolicyVersion
from app.services.ai_moderation import ModerationAIResponse, analyze_image
from app.services.policy_service import get_enabled_categories


def format_active_categories_for_prompt(categories: list[CategoryPolicy]) -> str:
    """Build the bullet list fed into the Gemini prompt."""
    lines = [
        f"- {item.category.value} (admin threshold: {item.threshold}%)"
        for item in categories
    ]
    return "\n".join(lines)


def apply_thresholds(
    ai_response: ModerationAIResponse,
    enabled_policies: list[CategoryPolicy],
) -> list[CategoryVerdict]:
    """
    Turn raw AI scores into CategoryVerdict rows using admin thresholds.

    Only enabled categories are included. Unknown AI categories are ignored.
    """
    policy_by_category = {item.category: item for item in enabled_policies}
    verdicts: list[CategoryVerdict] = []

    for ai_row in ai_response.category_breakdown:
        policy = policy_by_category.get(ai_row.category)
        if policy is None:
            # AI returned a category that is disabled or unknown — skip it.
            continue

        result = (
            ClassificationResult.DETECTED
            if ai_row.confidence >= policy.threshold
            else ClassificationResult.CLEAR
        )
        verdicts.append(
            CategoryVerdict(
                category=ai_row.category,
                result=result,
                confidence=ai_row.confidence,
                reasoning=ai_row.reasoning,
            )
        )

    return verdicts


def compute_overall_outcome(
    category_verdicts: list[CategoryVerdict],
    enabled_policies: list[CategoryPolicy],
) -> OverallOutcome:
    """
    Determine Approved / Flagged / Blocked from detected categories + enforcement.

    Rules (section 4.2 + 4.4):
      - Any detected category with Auto-Block  → Blocked (wins over Flagged)
      - Any detected category with Flag for Review → Flagged for Review
      - No detections → Approved
    """
    policy_by_category = {item.category: item for item in enabled_policies}
    has_flag = False

    for verdict in category_verdicts:
        if verdict.result != ClassificationResult.DETECTED:
            continue

        policy = policy_by_category.get(verdict.category)
        if policy is None:
            continue

        if policy.enforcement == EnforcementAction.AUTO_BLOCK:
            return OverallOutcome.BLOCKED
        has_flag = True

    if has_flag:
        return OverallOutcome.FLAGGED_FOR_REVIEW
    return OverallOutcome.APPROVED


def build_image_verdict(
    ai_response: ModerationAIResponse,
    policy: PolicyVersion,
    image_id: str,
) -> ImageVerdict:
    """
    Merge AI output + policy into a validated ImageVerdict.

    ImageVerdict's own validators run here as a final consistency check.
    """
    enabled = get_enabled_categories(policy)
    category_breakdown = apply_thresholds(ai_response, enabled)
    overall_outcome = compute_overall_outcome(category_breakdown, enabled)

    return ImageVerdict(
        image_id=image_id,
        overall_outcome=overall_outcome,
        original_overall_outcome=overall_outcome,
        category_breakdown=category_breakdown,
        policy_version_id=policy.id,
        evaluated_at=datetime.utcnow(),
    )


async def screen_image(
    image_path: str,
    image_id: str,
    policy: PolicyVersion,
) -> ImageVerdict:
    """
    Full Phase 3 pipeline for one image — used by submissions in Phase 4.

    1. Load enabled categories from the active policy version
    2. Call Gemini (ai_moderation)
    3. Apply thresholds + enforcement (this module)
    4. Return ImageVerdict
    """
    enabled = get_enabled_categories(policy)
    if not enabled:
        # All categories disabled — nothing to screen; image is approved.
        return ImageVerdict(
            image_id=image_id,
            overall_outcome=OverallOutcome.APPROVED,
            original_overall_outcome=OverallOutcome.APPROVED,
            category_breakdown=[],
            policy_version_id=policy.id,
            evaluated_at=datetime.utcnow(),
        )

    active_categories_text = format_active_categories_for_prompt(enabled)
    ai_response = await analyze_image(image_path, active_categories_text)
    return build_image_verdict(ai_response, policy, image_id)
