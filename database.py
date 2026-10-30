from sqlalchemy import String, Integer, Column, Text, JSON, text, TIMESTAMP
from connection import Base


class Documents(Base):
    __tablename__ = "documents"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    original_text = Column(Text,    nullable=False)
    summary       = Column(Text,    nullable=False)
    key_points    = Column(JSON,    nullable=False)          # list[str]
    entities      = Column(JSON,    nullable=True)           # dict with names/dates/amounts
    document_type = Column(String(100), nullable=True)
    sentiment     = Column(String(20),  nullable=True)
    embedding_json= Column(JSON,    nullable=True)           # list[float]
    created_at    = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))

    @property
    def content(self) -> str:
        return self.original_text


class users(Base):
    __tablename__ = "users"

    id            = Column(Integer,     primary_key=True, autoincrement=True)
    username      = Column(String(50),  unique=True, nullable=False)
    mobile_number = Column(String(20),  nullable=True)
    password_hash = Column(String(255), nullable=False)
    role          = Column(String(20),  default="user", nullable=False)
    created_at    = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))