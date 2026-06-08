from pathlib import Path

from pydantic_settings import BaseSettings

_ML_SERVICE_ROOT = Path(__file__).resolve().parents[1]
_ENV_FILE = _ML_SERVICE_ROOT / ".env"


class Settings(BaseSettings):
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "postgres"
    db_user: str = "postgres"
    db_password: str = "root"

    llm_provider: str = "mock"  # mock | anthropic | gemini
    anthropic_api_key: str = ""
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    llm_log_exchanges: bool = True
    cryptopanic_auth_token: str = ""

    prediction_assets: str = "BTC/USD,ETH/USD,SOL/USD,LINK/USD"
    min_rag_events: int = 500
    ohlc_training_lookback_days: int = 365

    class Config:
        env_file = str(_ENV_FILE)
        extra = "ignore"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def assets(self) -> list[str]:
        return [a.strip() for a in self.prediction_assets.split(",") if a.strip()]


settings = Settings()
