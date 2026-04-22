import os
import shutil
from pathlib import Path

from huggingface_hub import HfApi


ROOT = Path(__file__).resolve().parents[2]
BACKEND_ENV_PATH = ROOT / "backend" / ".env"
TEMPLATE_DIR = ROOT / "deployment" / "huggingface-space"
UPLOAD_DIR = ROOT / ".hf-space-upload"
SPACE_NAME = "pixelcraft"
DATA_BACKUP_DIR = ROOT / ".data-backup"


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def copy_tree(src: Path, dst: Path) -> None:
    shutil.copytree(
        src,
        dst,
        ignore=shutil.ignore_patterns(
            "node_modules",
            ".env",
            ".git",
            "*.log",
            "__pycache__",
        ),
    )


def backup_space_data(api: HfApi, repo_id: str) -> None:
    """Download current memory store files from the live Space to preserve data."""
    print("Backing up existing Space data...")
    DATA_BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    try:
        api.hf_hub_download(
            repo_id=repo_id,
            filename="data/memory-store.json",
            repo_type="space",
            local_dir=DATA_BACKUP_DIR,
        )
        print("  * Backed up memory-store.json")
    except Exception:
        print("  * No existing memory-store.json found")

    try:
        api.hf_hub_download(
            repo_id=repo_id,
            filename="data/assistant-memory-store.json",
            repo_type="space",
            local_dir=DATA_BACKUP_DIR,
        )
        print("  * Backed up assistant-memory-store.json")
    except Exception:
        print("  * No existing assistant-memory-store.json found")


def prepare_upload_dir() -> None:
    if UPLOAD_DIR.exists():
        shutil.rmtree(UPLOAD_DIR)

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    copy_tree(ROOT / "backend", UPLOAD_DIR / "backend")
    copy_tree(ROOT / "frontend", UPLOAD_DIR / "frontend")
    # Keep pre-built frontend/build - Docker will use it directly
    build_dir = UPLOAD_DIR / "frontend" / "build"
    if not build_dir.exists():
        print("  * Warning: frontend/build not found - building locally...")
        # Build locally if missing
        import subprocess
        subprocess.run(["npm", "run", "build"], cwd=ROOT / "frontend", check=True)
        copy_tree(ROOT / "frontend" / "build", UPLOAD_DIR / "frontend" / "build")
        print("  * Built and included frontend/build")
    else:
        print("  * Included pre-built frontend/build")
    shutil.copy2(TEMPLATE_DIR / "Dockerfile", UPLOAD_DIR / "Dockerfile")
    shutil.copy2(TEMPLATE_DIR / "README.md", UPLOAD_DIR / "README.md")

    # Write a clean .gitignore for the Space repository
    gitignore_content = """# Dependencies
node_modules/

# Environment variables
.env
backend/.env
frontend/.env

# Logs
*.log
backend-live-out.log
backend-live-err.log
frontend-live-out.log
frontend-live-err.log
backend-*.txt

# Local data stores (persisted via /data in production)
backend/src/store/memory-store.json
backend/src/store/assistant-memory-store.json
backend/generated-media/

# IDE
.vscode/

# Build artifacts (built in Docker)
frontend/build/
"""
    (UPLOAD_DIR / ".gitignore").write_text(gitignore_content, encoding="utf-8")
    print("  * Written .gitignore")

    # Create data persistence directory structure
    data_dir = UPLOAD_DIR / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    # Restore backed-up store files if they exist, otherwise copy current ones
    backend_store = ROOT / "backend" / "src" / "store"

    if (DATA_BACKUP_DIR / "memory-store.json").exists():
        shutil.copy2(DATA_BACKUP_DIR / "memory-store.json", data_dir / "memory-store.json")
        print("  * Restored memory-store.json from backup")
    elif (backend_store / "memory-store.json").exists():
        shutil.copy2(backend_store / "memory-store.json", data_dir / "memory-store.json")

    if (DATA_BACKUP_DIR / "assistant-memory-store.json").exists():
        shutil.copy2(DATA_BACKUP_DIR / "assistant-memory-store.json", data_dir / "assistant-memory-store.json")
        print("  * Restored assistant-memory-store.json from backup")
    elif (backend_store / "assistant-memory-store.json").exists():
        shutil.copy2(backend_store / "assistant-memory-store.json", data_dir / "assistant-memory-store.json")


def main() -> None:
    env_values = load_env_file(BACKEND_ENV_PATH)
    hf_token = env_values.get("HUGGING_FACE_API_KEY", "").strip()
    if not hf_token:
        raise SystemExit("HUGGING_FACE_API_KEY is missing in backend/.env")

    api = HfApi(token=hf_token)
    whoami = api.whoami()
    username = whoami["name"]
    repo_id = f"{username}/{SPACE_NAME}"
    space_origin = f"https://{username.replace('_', '-')}-{SPACE_NAME}.hf.space"

    # Backup existing data from the Space to preserve user tokens/memories
    backup_space_data(api, repo_id)

    prepare_upload_dir()

    api.create_repo(
        repo_id=repo_id,
        repo_type="space",
        space_sdk="docker",
        private=False,
        exist_ok=True,
    )

    variable_keys = {
        "PORT": "7860",
        "NODE_ENV": "production",
        "USE_MEMORY_DB": "true",
        "FRONTEND_BASE_PATH": "/",
        "FRONTEND_URL": space_origin,
        "ASSISTANT_CHAT_PROVIDER": env_values.get("ASSISTANT_CHAT_PROVIDER", "gemini"),
        "GEMINI_MODEL": env_values.get("GEMINI_MODEL", "gemini-2.5-flash"),
        "OPENAI_CHAT_MODEL": env_values.get("OPENAI_CHAT_MODEL", ""),
        "OPENAI_REALTIME_MODEL": env_values.get("OPENAI_REALTIME_MODEL", ""),
        "OPENAI_TTS_MODEL": env_values.get("OPENAI_TTS_MODEL", ""),
        "OPENAI_TRANSCRIBE_MODEL": env_values.get("OPENAI_TRANSCRIBE_MODEL", ""),
        "OPENAI_ASSISTANT_VOICE": env_values.get("OPENAI_ASSISTANT_VOICE", ""),
        "OPENAI_REALTIME_VOICE": env_values.get("OPENAI_REALTIME_VOICE", ""),
        "OPENAI_ASSISTANT_VOICE_STYLE": env_values.get("OPENAI_ASSISTANT_VOICE_STYLE", ""),
        "HUGGING_FACE_MODEL": env_values.get("HUGGING_FACE_MODEL", ""),
        "HUGGING_FACE_VIDEO_PROVIDER": env_values.get("HUGGING_FACE_VIDEO_PROVIDER", ""),
        "VIDEO_GENERATION_BACKEND": env_values.get("VIDEO_GENERATION_BACKEND", ""),
        "TEXT_TO_VIDEO_MODEL": env_values.get("TEXT_TO_VIDEO_MODEL", ""),
        "IMAGE_TO_VIDEO_MODEL": env_values.get("IMAGE_TO_VIDEO_MODEL", ""),
    }

    secret_keys = {
        "JWT_SECRET": env_values.get("JWT_SECRET", ""),
        "HUGGING_FACE_API_KEY": env_values.get("HUGGING_FACE_API_KEY", ""),
        "OPENAI_API_KEY": env_values.get("OPENAI_API_KEY", ""),
        "GEMINI_API_KEY": env_values.get("GEMINI_API_KEY", ""),
        "PIAPI_API_KEY": env_values.get("PIAPI_API_KEY", ""),
    }

    for key, value in variable_keys.items():
        if value:
            api.add_space_variable(repo_id=repo_id, key=key, value=value)

    for key, value in secret_keys.items():
        if value:
            api.add_space_secret(repo_id=repo_id, key=key, value=value)

    api.upload_folder(
        repo_id=repo_id,
        repo_type="space",
        folder_path=str(UPLOAD_DIR),
        commit_message="Deploy PixelCraft web app",
    )

    print(f"DEPLOYED_REPO={repo_id}")
    print(f"DEPLOYED_URL={space_origin}")


if __name__ == "__main__":
    main()
