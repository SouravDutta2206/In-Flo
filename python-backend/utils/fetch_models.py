import re
import ollama
import asyncio
import aiohttp
from google import genai


CAPABILITY_INPUT_MAP = {
    "completion":  "text",
    "vision":      "image",
    "audio":       "audio",
    "video":       "video",
    "embedding":   "text",
    "tools":       "text",
}

# ── Openrouter models ────────────────────────────────────────────────────────

async def get_openrouter_models():
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get("https://openrouter.ai/api/v1/models") as res:
                data = (await res.json())["data"]
    except Exception as e:
        return [{"error": f"Could not connect to OpenRouter: {e}"}]

    return [
        {
            "name": m["name"].split(':')[-1].strip(),
            "model_id":    m["id"],
            "provider" : "openrouter",
            "capabilities": {
                "input":  m.get("architecture", {}).get("input_modalities", []),
                "output": m.get("architecture", {}).get("output_modalities", []),
            }
        }
        for m in data
    ]

# ── Ollama models ────────────────────────────────────────────────────────

def map_input_capabilities(raw_caps) -> list[str]:
    """
    Convert ollama capability list to our schema's input types.
    Preserves insertion order and deduplicates.
    Falls back to ['text'] when nothing useful is found.
    """
    if not raw_caps:
        return ["text"]

    labels = [CAPABILITY_INPUT_MAP[str(c).lower()]
              for c in raw_caps if str(c).lower() in CAPABILITY_INPUT_MAP]
    return list(dict.fromkeys(labels)) or ["text"]



def _ollama_local_models_sync() -> list[dict]:
    """Blocking helper — runs in a thread via asyncio.to_thread."""
    try:
        list_response = ollama.list()        # GET /api/tags
    except Exception as e:
        return [{"error": f"Could not connect to Ollama: {e}"}]

    models = (
        list_response.models
        if hasattr(list_response, "models")
        else list_response.get("models", [])
    )

    if not models:
        return []

    output = []

    for model in models:
        model_id = getattr(model, "model", None) or getattr(model, "name", "")

        raw_caps = None
        try:
            info = ollama.show(model_id)    
            raw_caps = getattr(info, "capabilities", None)
        except Exception:
            pass

        entry = {
            "name":           model_id,
            "model_id":       model_id,
            "provider":       "ollama",
            "capabilities": {
                "input":  map_input_capabilities(raw_caps),
                "output": ["text"],
            },
        }
        output.append(entry)

    return output

async def get_ollama_local_models() -> list[dict]:
    return await asyncio.to_thread(_ollama_local_models_sync)

# ── Groq models ────────────────────────────────────────────────────────

def infer_modalities(model_id):
    if "whisper" in model_id:
        return {"input": ["audio"], "output": ["text"]}
    if "tts" in model_id or "orpheus" in model_id:
        return {"input": ["text"], "output": ["audio"]}
    if "vision" in model_id or "llava" in model_id or "scout" in model_id:
        return {"input": ["text", "image"], "output": ["text"]}
    return {"input": ["text"], "output": ["text"]}

async def get_groq_models(GROQ_API_KEY: str) -> list[dict]:
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"}
            ) as res:
                data = (await res.json())["data"]
    except Exception as e:
        return [{"error": f"Could not connect to Groq: {e}"}]
    
    output = []
    for m in data:
        model_id = m["id"]
        
        output.append({
            "name":           model_id.replace("-", " ").title().split('/')[-1].strip(),
            "model_id":       model_id,
            "provider":       "groq",
            "capabilities":   infer_modalities(model_id)
        })
    
    return output

# ── Gemini models ────────────────────────────────────────────────────────

## ── Config ─────────────────────────────────────────────────────────────────────

DOCS_BASE      = "https://ai.google.dev/gemini-api/docs/models"

BLOCKED_TERMS = [
    "audio", "tts", "embed", "robot", "computer", "research", "live", "translate",
    "aqa", "latest", "custom", "image", "banana",
    "imagen", "veo", "lyria",
]

## ── Filtering ──────────────────────────────────────────────────────────────────

def should_discard(model):
    code    = model["model_id"].lower()
    display = model["name"].lower()
    if re.search(r"-\d{3}$", code):
        return True
    return any(kw in code or kw in display for kw in BLOCKED_TERMS)

def deduplicate_by_display_name(models):
    seen, result = set(), []
    for model in models:
        key = model["name"].lower()
        if key not in seen:
            seen.add(key)
            result.append(model)
    return result

def filter_models(models):
    return deduplicate_by_display_name([m for m in models if not should_discard(m)])

def sort_models(models):
    """
    Sort models: Gemini first (higher versions first), then Gemma (higher versions first).
    Versions like 3.1 > 3 > 2.5 > 2 for Gemini.
    Versions like 4 > 3n > 3 for Gemma (with variants).
    """
    gemini_models = []
    gemma_models = []
    
    for model in models:
        code_name = model["model_id"].lower()
        if "gemini" in code_name:
            gemini_models.append(model)
        elif "gemma" in code_name:
            gemma_models.append(model)
    
    def extract_gemini_version(model):
        """Extract version tuple from gemini model name for sorting (descending)."""
        code_name = model["model_id"].lower()
        match = re.search(r"gemini-(\d+(?:\.\d+)?)", code_name)
        if match:
            version_str = match.group(1)
            parts = [int(p) for p in version_str.split(".")]
            # Pad to 2 elements for consistent comparison (e.g., [3] -> [3, 0])
            while len(parts) < 2:
                parts.append(0)
            # Return negative values for descending sort, works for any digit count
            return tuple(-p for p in parts)
        return (0, 0)
    
    def extract_gemma_version(model):
        """Extract version tuple from gemma model name for sorting (descending)."""
        code_name = model["model_id"].lower()
        match = re.search(r"gemma-(\d+)([a-z]?)", code_name)
        if match:
            version_num = int(match.group(1))
            variant = match.group(2)
            # Higher numbers first, and 'n' variants come after base versions
            variant_order = 0 if not variant else (-1 if variant == "n" else -2)
            return (-version_num, variant_order)
        return (0, 0)
    
    gemini_models.sort(key=extract_gemini_version)
    gemma_models.sort(key=extract_gemma_version)
    
    return gemini_models + gemma_models

## ── Modality parsing ───────────────────────────────────────────────────────────

def parse_modality_text(text):
    t = text.lower()
    out = []
    if "text"  in t: out.append("text")
    if "image" in t: out.append("image")
    if "audio" in t: out.append("audio")
    if "video" in t: out.append("video")
    return out or ["text"]

def parse_gemma_modalities(card_text, slug):
    """
    Strategy 1 — table with 'Supported Modalities' row (Gemma 4+ style).
    Strategy 2 — prose 'Inputs and outputs' section (Gemma 3 style).
    Fallback    — text in / text out.
    """
    # Extract size token from slug: e.g. "gemma-4-e2b-it" → "e2b", "gemma-3-27b" → "27b"
    size_match = re.search(r"(?:gemma-\d+(?:\.\d+)?-)(e?\d+(?:\.\d+)?[bm])", slug.lower())
    size_token = size_match.group(1) if size_match else None

    # Strategy 1: walk every markdown table block looking for a modalities row
    for table_match in re.finditer(r"(\|[^\n]+\|\n\|[-| :]+\|\n(?:\|[^\n]+\|\n?)*)", card_text):
        table = table_match.group(0)
        if "modalities" not in table.lower():
            continue

        rows = [r.strip() for r in table.strip().splitlines() if r.strip()]
        if len(rows) < 3:
            continue

        header_cols = [c.strip() for c in rows[0].split("|") if c.strip()]

        for row in rows[2:]:
            if "modalities" not in row.lower():
                continue

            data_cols = [c.strip() for c in row.split("|") if c.strip()]
            values    = data_cols[1:]   # first col is the row label

            if not values:
                continue

            # Single data column — use directly
            if len(values) == 1:
                return {"input": parse_modality_text(values[0]), "output": ["text"]}

            # Multiple columns — match size token to header
            if size_token:
                for i, header in enumerate(header_cols[1:]):
                    if size_token in header.lower() and i < len(values):
                        return {"input": parse_modality_text(values[i]), "output": ["text"]}

            # No size match — use first column as safe default
            # return {"input": parse_modality_text(values[0]), "output": ["text"]}
            break
        
    # Strategy 2: prose "Inputs and outputs" section
    section = re.search(
        r"#{2,3}\s*Inputs and outputs(.+?)(?=#{2,3}|\Z)",
        card_text, re.DOTALL | re.IGNORECASE
    )
    if section:
        body        = section.group(1)
        input_match = re.search(r"\*\*Input[^*]*\*\*[:\s]*(.+?)(?=\*\*Output|\Z)", body, re.DOTALL)
        # Output is hardcoded to ["text"] -- prose descriptions are not reliably
        # parseable (e.g. "analysis of image content" falsely triggers image).
        # Any Gemma model using this prose-style card only outputs text.
        return {
            "input":  parse_modality_text(input_match.group(1) if input_match else "text"),
            "output": ["text"],
        }

    return {"input": ["text"], "output": ["text"]}

##  ── Async fetching ─────────────────────────────────────────────────────────────

async def fetch_gemini_modalities(session, slug):
    """Fetch modalities from the per-model Gemini docs page. Detects and flags deprecation warnings."""
    try:
        url = f"{DOCS_BASE}/{slug}.md.txt"
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as res:
            if res.status != 200:
                return {"input": ["text"], "output": ["text"], "deprecated": False}
            text  = await res.text()
            is_deprecated = "deprecated" in text.lower() and "[!warning]" in text.lower()
            
            match = re.search(
                r"Supported data types.*?\*\*Inputs?\*\*(.+?)\*\*Output\*\*(.+?)(?:\||\n)",
                text
            )
            if match:
                return {
                    "input":  parse_modality_text(match.group(1)),
                    "output": parse_modality_text(match.group(2)),
                    "deprecated": is_deprecated,
                }
            return {"input": ["text"], "output": ["text"], "deprecated": is_deprecated}
    except Exception:
        pass
    return {"input": ["text"], "output": ["text"], "deprecated": False}

async def fetch_gemma_card(session, generation_num):
    """Fetch a Gemma family model card by generation number."""
    url = f"https://ai.google.dev/gemma/docs/core/model_card_{generation_num}.md.txt"
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as res:
            return await res.text() if res.status == 200 else None
    except Exception:
        return None

async def fetch_modalities(session, model, gemma_card_cache, gemma_card_locks):
    slug = model["model_id"].replace("models/", "")

    # Gemma models: use shared family card, fetched only once per generation
    gemma_match = re.match(r"gemma-(\d+)", slug)
    if gemma_match:
        generation_num = gemma_match.group(1)

        # Create a lock for this generation if needed
        if generation_num not in gemma_card_locks:
            gemma_card_locks[generation_num] = asyncio.Lock()

        # Only one coroutine fetches; the rest wait and reuse the result
        async with gemma_card_locks[generation_num]:
            if generation_num not in gemma_card_cache:
                gemma_card_cache[generation_num] = await fetch_gemma_card(session, generation_num)

        card_text = gemma_card_cache.get(generation_num)
        if card_text:
            return parse_gemma_modalities(card_text, slug)

    # All other models: per-model Gemini docs page
    return await fetch_gemini_modalities(session, slug)

async def fetch_all_modalities(models):
    gemma_card_cache = {}
    gemma_card_locks = {}
    async with aiohttp.ClientSession() as session:
        tasks = [
            fetch_modalities(session, model, gemma_card_cache, gemma_card_locks)
            for model in models
        ]
        return await asyncio.gather(*tasks)

## ── Main ───────────────────────────────────────────────────────────────────────

async def get_gemini_models(GEMINI_API_KEY):
    client = genai.Client(api_key=GEMINI_API_KEY)
    raw = []
    try:
        pager = await client.aio.models.list()
        async for m in pager:
            raw.append(m)
    except Exception as e:
        return [{"error": f"Could not list Gemini models: {e}"}]

    candidates = [
        {"name": m.display_name or m.name, "model_id": m.name}
        for m in raw
    ]
    filtered = filter_models(candidates)

    modalities_list = await fetch_all_modalities(filtered)

    active_models = []
    for model, modalities in zip(filtered, modalities_list):
        if modalities.get("deprecated", False):
            continue
        active_models.append({
            "name": model["name"],
            "model_id":    model["model_id"],
            "provider" : "gemini",
            "capabilities":  {
                "input": modalities.get("input", ["text"]),
                "output": modalities.get("output", ["text"])
            },
        })

    return sort_models(active_models)

async def get_models_list(groq_api_key: str | None = None, gemini_api_key: str | None = None):
    """Aggregate models from all providers. Skips key-required providers when keys are absent."""

    tasks = [
        get_openrouter_models(),
        get_ollama_local_models(),
    ]

    if groq_api_key:
        tasks.append(get_groq_models(groq_api_key))

    if gemini_api_key:
        tasks.append(get_gemini_models(gemini_api_key))

    results = await asyncio.gather(*tasks)

    combined = []
    for result in results:
        # Skip any result lists that contain error dicts
        if result and isinstance(result[0], dict) and "error" in result[0]:
            continue
        combined.extend(result)

    return combined
