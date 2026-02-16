"""
Generate openclaw.json dynamically from LLMConfigService.

The model references in the OpenClaw gateway config are resolved from
PROVIDER_TIERS so they stay in sync when we update model versions.

Usage:
    cd backend
    python -m apps.agent_score.generate_openclaw_config
"""

import json
import sys
from pathlib import Path


def generate_openclaw_config() -> dict:
    """Build the OpenClaw config dict with models resolved from LLMConfigService."""
    from common.utils.llm_config import LLMConfigService

    budget_model = LLMConfigService.get_openrouter_model("google/budget")

    return {
        "gateway": {
            "mode": "local",
            "port": 18789,
            "bind": "loopback",
            "auth": {
                "mode": "token",
                "token": "pillar-agent-score-token",
            },
            "controlUi": {
                "dangerouslyDisableDeviceAuth": True,
                "allowInsecureAuth": True,
            },
            "http": {
                "endpoints": {
                    "responses": {"enabled": True},
                },
            },
        },
        "env": {
            "OPENROUTER_API_KEY": "${OPENROUTER_API_KEY}",
        },
        "models": {
            "providers": {
                "openrouter": {
                    "baseUrl": "https://openrouter.ai/api/v1",
                    "apiKey": "${OPENROUTER_API_KEY}",
                    "models": [
                        {"id": budget_model, "name": budget_model},
                    ],
                },
            },
        },
        "agents": {
            "defaults": {
                "model": {
                    "primary": f"openrouter/{budget_model}",
                },
            },
        },
        "browser": {
            "enabled": True,
            "headless": True,
            "defaultProfile": "openclaw",
            "noSandbox": True,
        },
        "skills": {
            "load": {
                "extraDirs": ["/root/.openclaw/skills"],
            },
        },
    }


def write_openclaw_config(output_path: Path | None = None) -> Path:
    """Generate and write openclaw.json. Returns the path written to."""
    if output_path is None:
        repo_root = Path(__file__).resolve().parents[3]
        output_path = repo_root / "openclaw" / "openclaw.json"

    config = generate_openclaw_config()
    output_path.write_text(
        json.dumps(config, indent=2) + "\n",
        encoding="utf-8",
    )
    return output_path


if __name__ == "__main__":
    # Allow running standalone: python -m apps.agent_score.generate_openclaw_config
    path = write_openclaw_config()
    from common.utils.llm_config import LLMConfigService
    model = LLMConfigService.get_openrouter_model("google/budget")
    print(f"Wrote {path} (model: {model})")
