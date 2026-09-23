"""Write the API's OpenAPI schema to packages/contracts/openapi.json (or argv[1]).

uv run python -m climate.api.dump_openapi && pnpm -F @ucdt/contracts gen
"""

import json
import sys
from pathlib import Path

from climate.api.main import app

DEFAULT_OUT = Path(__file__).resolve().parents[4] / "packages" / "contracts" / "openapi.json"

if __name__ == "__main__":
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUT
    out.write_text(
        json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n"
    )
    print(f"wrote {out}")
