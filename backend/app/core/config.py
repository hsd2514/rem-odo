from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/reimbursement"
    jwt_secret_key: str = "change-me-in-env"
    jwt_algorithm: str = "HS256"
    access_token_exp_minutes: int = 30
    refresh_token_exp_minutes: int = 60 * 24 * 7
    password_reset_exp_minutes: int = 15
    cors_origins: str = "http://localhost:5173"
    frontend_url: str = "http://localhost:5173"

    # SMTP (Google)
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_name: str = "Reimburse"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
