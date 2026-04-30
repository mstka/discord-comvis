from datetime import datetime
from typing import Optional
from sqlalchemy import (
    String, Text, Integer, Float, Boolean, DateTime,
    LargeBinary, ForeignKey, JSON, Index, func
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    channel_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    guild_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    author_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    content: Mapped[Optional[str]] = mapped_column(Text)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    reference_id: Mapped[Optional[str]] = mapped_column(String, index=True)
    thread_id: Mapped[Optional[str]] = mapped_column(String, index=True)
    is_thread_start: Mapped[bool] = mapped_column(Boolean, default=False)
    raw_json: Mapped[Optional[str]] = mapped_column(JSON)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    mentions: Mapped[list["Mention"]] = relationship(back_populates="message", cascade="all, delete-orphan")
    reactions: Mapped[list["Reaction"]] = relationship(back_populates="message", cascade="all, delete-orphan")
    vector: Mapped[Optional["MessageVector"]] = relationship(back_populates="message", uselist=False, cascade="all, delete-orphan")


class Mention(Base):
    __tablename__ = "mentions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    message_id: Mapped[str] = mapped_column(String, ForeignKey("messages.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False)

    message: Mapped["Message"] = relationship(back_populates="mentions")


class Reaction(Base):
    __tablename__ = "reactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    message_id: Mapped[str] = mapped_column(String, ForeignKey("messages.id"), nullable=False, index=True)
    emoji: Mapped[str] = mapped_column(String, nullable=False)
    count: Mapped[int] = mapped_column(Integer, nullable=False)
    user_ids: Mapped[Optional[list]] = mapped_column(JSON)

    message: Mapped["Message"] = relationship(back_populates="reactions")


class Member(Base):
    __tablename__ = "members"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    username: Mapped[str] = mapped_column(String, nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String)
    avatar_url: Mapped[Optional[str]] = mapped_column(String)
    roles: Mapped[Optional[list]] = mapped_column(JSON)

    score: Mapped[Optional["NodeScore"]] = relationship(back_populates="member", uselist=False, cascade="all, delete-orphan")


class MessageVector(Base):
    __tablename__ = "message_vectors"

    message_id: Mapped[str] = mapped_column(String, ForeignKey("messages.id"), primary_key=True)
    vector: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    model: Mapped[str] = mapped_column(String, default="text-embedding-004")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    message: Mapped["Message"] = relationship(back_populates="vector")


class OpenSocket(Base):
    __tablename__ = "open_sockets"
    __table_args__ = (
        Index("ix_open_sockets_status_created", "status", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    message_id: Mapped[str] = mapped_column(String, ForeignKey("messages.id"), nullable=False)
    channel_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    author_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String, default="open")  # open / closed / timeout
    closed_by: Mapped[Optional[str]] = mapped_column(String)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    confidence: Mapped[Optional[float]] = mapped_column(Float)


class Edge(Base):
    __tablename__ = "edges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_id: Mapped[str] = mapped_column(String, nullable=False, index=True)  # 回答者UID
    target_id: Mapped[str] = mapped_column(String, nullable=False, index=True)  # 質問者UID
    message_id: Mapped[str] = mapped_column(String, ForeignKey("messages.id"), nullable=False)
    parent_id: Mapped[str] = mapped_column(String, nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    edge_type: Mapped[str] = mapped_column(String, nullable=False)  # main / sub / distributed / thanks
    channel_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    route: Mapped[str] = mapped_column(String, nullable=False)  # fast / slow / gemini / confirmed
    topic_vector: Mapped[Optional[bytes]] = mapped_column(LargeBinary)


class NodeScore(Base):
    __tablename__ = "node_scores"

    member_id: Mapped[str] = mapped_column(String, ForeignKey("members.id"), primary_key=True)
    contribution_score: Mapped[float] = mapped_column(Float, default=0.0)
    centrality: Mapped[float] = mapped_column(Float, default=0.0)
    avg_sentiment: Mapped[float] = mapped_column(Float, default=0.0)
    reaction_density: Mapped[float] = mapped_column(Float, default=0.0)
    expertise_score: Mapped[float] = mapped_column(Float, default=0.0)
    resolved_count: Mapped[int] = mapped_column(Integer, default=0)
    asked_count: Mapped[int] = mapped_column(Integer, default=0)
    unresolved_count: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

    member: Mapped["Member"] = relationship(back_populates="score")


class AnalysisRun(Base):
    __tablename__ = "analysis_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String, default="running")  # running / done / error
    messages_total: Mapped[Optional[int]] = mapped_column(Integer)
    messages_done: Mapped[int] = mapped_column(Integer, default=0)
    fast_count: Mapped[int] = mapped_column(Integer, default=0)
    slow_count: Mapped[int] = mapped_column(Integer, default=0)
    gemini_count: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
