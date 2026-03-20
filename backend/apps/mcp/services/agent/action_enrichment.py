"""
Standalone action data extraction and follow-up question generation.

Extracted from AskTool so both the legacy ask.py path and
WebResponseAdapter can share the same logic.
"""
import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)


async def extract_action_data(
    query: str,
    actions: list[dict[str, Any]],
    help_center_config,
) -> list[dict[str, Any]]:
    """
    Extract data from user query and populate action data fields.

    Uses LLM to extract structured data based on each action's data_schema.
    Only processes actions that have a data_schema defined.

    Args:
        query: The user's original query
        actions: List of action dictionaries from search
        help_center_config: HelpCenterConfig instance

    Returns:
        Actions with extracted data merged into their data fields
    """
    from common.utils.llm_config import LLMConfigService
    from common.utils.json_parser import parse_json_from_llm

    actions_with_schema = [
        (i, a) for i, a in enumerate(actions)
        if a.get('data_schema') and a.get('data_schema', {}).get('properties')
    ]

    if not actions_with_schema:
        return actions

    logger.info(
        "[ActionEnrichment] Extracting data for %d actions with schemas",
        len(actions_with_schema),
    )

    extraction_prompt = f"""Extract data from this user message for the specified actions.

User message: "{query}"

For each action below, extract the requested data from the user's message.
Return a JSON object where keys are action names and values are the extracted data.

Actions:
"""
    for idx, action in actions_with_schema:
        name = action.get('name')
        schema = action.get('data_schema', {})
        props = schema.get('properties', {})
        required = schema.get('required', [])

        extraction_prompt += f"\n### {name}\n"
        for prop_name, prop_def in props.items():
            prop_type = prop_def.get('type', 'string')
            prop_desc = prop_def.get('description', '')
            is_required = prop_name in required
            req_label = " (required)" if is_required else " (optional)"

            if 'enum' in prop_def:
                enum_values = ', '.join(f'"{v}"' for v in prop_def['enum'])
                extraction_prompt += (
                    f"- {prop_name} ({prop_type}, one of: {enum_values})"
                    f"{req_label}: {prop_desc}\n"
                )
            else:
                extraction_prompt += (
                    f"- {prop_name} ({prop_type}){req_label}: {prop_desc}\n"
                )

    extraction_prompt += """
Return ONLY valid JSON in this format:
{
  "action_name": {
    "field1": extracted_value,
    "field2": extracted_value
  }
}

If no data can be extracted for an action, omit it from the response.
For arrays, return an array of values. For emails, extract all email addresses mentioned.
"""

    try:
        llm_client, model_name, _, _ = LLMConfigService.create_llm_client_for_task(
            site=help_center_config,
            task_type='help_center_public_ai',
            temperature=0.1,
            max_tokens=500,
        )

        try:
            extraction_result = await asyncio.wait_for(
                llm_client.complete_async(
                    prompt=extraction_prompt,
                    system_prompt=(
                        "You are a precise data extraction assistant. "
                        "Extract only the data that is clearly present in the user's message. "
                        "Return valid JSON only."
                    ),
                    max_tokens=500,
                    temperature=0.1,
                ),
                timeout=15.0,
            )
        except asyncio.TimeoutError:
            logger.warning("[ActionEnrichment] Data extraction LLM call timed out after 15s")
            return actions

        extracted_data = parse_json_from_llm(extraction_result, expected_type="object")

        if not isinstance(extracted_data, dict):
            logger.warning(
                "[ActionEnrichment] Extraction returned non-dict: %s",
                type(extracted_data),
            )
            return actions

        logger.info("[ActionEnrichment] Extracted data: %s", extracted_data)

        for idx, action in enumerate(actions):
            action_name = action.get('name')
            schema = action.get('data_schema', {})
            required_fields = schema.get('required', [])
            properties = schema.get('properties', {})

            if action_name in extracted_data:
                action_data = extracted_data[action_name]
                if isinstance(action_data, dict):
                    current_data = action.get('data', {}) or {}
                    merged_data = {**current_data, **action_data}
                    actions[idx]['data'] = merged_data
                    logger.info(
                        "[ActionEnrichment] Merged data for '%s': %s",
                        action_name, merged_data,
                    )

            if required_fields:
                action_data = actions[idx].get('data', {}) or {}
                missing = []
                missing_descriptions = []

                for field_name in required_fields:
                    value = action_data.get(field_name)
                    if value is None or value == '' or (isinstance(value, list) and len(value) == 0):
                        missing.append(field_name)
                        prop_def = properties.get(field_name, {})
                        field_desc = prop_def.get('description', field_name.replace('_', ' '))
                        missing_descriptions.append(field_desc)

                if missing:
                    actions[idx]['data_incomplete'] = True
                    actions[idx]['missing_fields'] = missing
                    actions[idx]['missing_field_descriptions'] = missing_descriptions
                    logger.info(
                        "[ActionEnrichment] Action '%s' missing required fields: %s",
                        action_name, missing,
                    )

        return actions

    except Exception as e:
        logger.warning("[ActionEnrichment] Data extraction failed: %s", e, exc_info=True)
        return actions


def generate_followup_question(
    action_name: str,
    missing_descriptions: list[str],
) -> str:
    """
    Generate a natural follow-up question for missing required fields.

    Args:
        action_name: Human-readable action name (e.g., "invite team member")
        missing_descriptions: List of human-readable field descriptions

    Returns:
        Natural language follow-up question
    """
    if not missing_descriptions:
        return "I need a bit more information to proceed. Could you provide more details?"

    if len(missing_descriptions) == 1:
        return (
            f"I can help with that! To proceed, could you please provide: "
            f"{missing_descriptions[0]}?"
        )
    elif len(missing_descriptions) == 2:
        return (
            f"I can help with that! To proceed, I need: "
            f"{missing_descriptions[0]} and {missing_descriptions[1]}."
        )
    else:
        items = ", ".join(missing_descriptions[:-1])
        last = missing_descriptions[-1]
        return (
            f"I can help with that! To proceed, I need a few things: "
            f"{items}, and {last}."
        )
