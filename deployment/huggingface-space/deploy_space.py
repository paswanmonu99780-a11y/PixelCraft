import os
import shutil
from pathlib import Path

from huggingface_hub import HfApi


ROOT = Path(__file__).resolve().parents[2]
BACKEND_ENV_PATH = ROOT / "backend" / ".env"
TEMPLATE_DIR = ROOT / "deployment" / "huggingface-space"
UPLOAD_DIR = ROOT / ".hf-space-upload"
SPACE_NAME = "pixelcraft"


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
            "build",
            ".env",
            ".git",
            "*.log",
            "__pycache__",
        ),
    )


def prepare_upload_dir() -> None:
    if UPLOAD_DIR.exists():
        shutil.rmtree(UPLOAD_DIR)

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    copy_tree(ROOT / "backend", UPLOAD_DIR / "backend")
    copy_tree(ROOT / "frontend", UPLOAD_DIR / "frontend")
    shutil.copy2(TEMPLATE_DIR / "Dockerfile", UPLOAD_DIR / "Dockerfile")
    shutil.copy2(TEMPLATE_DIR / "README.md", UPLOAD_DIR / "README.md")


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
