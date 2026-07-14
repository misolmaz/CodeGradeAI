import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    JSON,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from .database import Base


def _utcnow():
    return datetime.now(timezone.utc)


# JSONB on PostgreSQL; plain JSON fallback for SQLite dev
JsonColumn = JSON().with_variant(JSONB(), "postgresql")


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    users = relationship("User", back_populates="organization")
    assignments = relationship("Assignment", back_populates="organization")
    study_sessions = relationship("StudySession", back_populates="organization")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("student_number", "organization_id", name="_student_org_uc"),
        UniqueConstraint("email", "organization_id", name="_email_org_uc"),
    )

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    student_number = Column(String, index=True)
    full_name = Column(String)
    email = Column(String, index=True, nullable=True)
    password_hash = Column(String)
    role = Column(String)
    class_code = Column(String, nullable=True)
    is_first_login = Column(Boolean, default=True)
    avatar_url = Column(String, nullable=True)

    organization = relationship("Organization", back_populates="users")
    submissions = relationship("Submission", back_populates="owner")
    badges = relationship("UserBadge", back_populates="user")
    study_sessions = relationship("StudySession", back_populates="student")


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    title = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    description = Column(Text)
    due_date = Column(String)
    language = Column(String)
    student_level = Column(String)
    status = Column(String, default="active")
    target_type = Column(String, default="all")
    target_class = Column(String, nullable=True)
    target_students = Column(JSON, nullable=True)

    organization = relationship("Organization", back_populates="assignments")
    submissions = relationship("Submission", back_populates="assignment")
    study_sessions = relationship("StudySession", back_populates="assignment")


class StudySession(Base):
    """Sokratik çalışma oturumu — YAYIN_016 araştırma birimi."""

    __tablename__ = "study_sessions"

    session_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    session_status = Column(String(32), nullable=False, default="SESSION_CREATED")
    current_scaffolding_level = Column(String(32), nullable=True)
    attempt_count = Column(Integer, nullable=False, default=0)
    max_scaffolding_level_reached = Column(String(32), nullable=True)
    research_pseudonym = Column(String(64), nullable=True)
    student_level = Column(String(16), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    last_activity_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    final_grade = Column(SmallInteger, nullable=True)
    full_report_unlocked_at = Column(DateTime(timezone=True), nullable=True)
    consent_recorded = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    student = relationship("User", back_populates="study_sessions")
    assignment = relationship("Assignment", back_populates="study_sessions")
    organization = relationship("Organization", back_populates="study_sessions")
    submissions = relationship("Submission", back_populates="study_session")
    interaction_events = relationship("InteractionEvent", back_populates="session")
    evaluations = relationship("Evaluation", back_populates="session")


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(UUID(as_uuid=True), unique=True, nullable=False, default=uuid.uuid4, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("study_sessions.session_id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=True)
    attempt_no = Column(Integer, nullable=True)
    code_content = Column(Text)
    code_hash = Column(String(64), nullable=True)
    code_language = Column(String(32), nullable=True)
    submission_source = Column(String(16), nullable=True, default="initial")
    is_final = Column(Boolean, nullable=True, default=False)
    grading_result = Column(JSON, nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="submissions")
    assignment = relationship("Assignment", back_populates="submissions")
    study_session = relationship("StudySession", back_populates="submissions")
    evaluation = relationship("Evaluation", back_populates="submission", uselist=False)


class Evaluation(Base):
    """AI değerlendirme kaydı — tam GradingResult JSON sözleşmesi."""

    __tablename__ = "evaluations"

    evaluation_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id = Column(
        UUID(as_uuid=True),
        ForeignKey("submissions.submission_id"),
        nullable=False,
        unique=True,
        index=True,
    )
    session_id = Column(UUID(as_uuid=True), ForeignKey("study_sessions.session_id"), nullable=False, index=True)
    grading_result_json = Column(JsonColumn, nullable=False)
    grade = Column(SmallInteger, nullable=False)
    scaffolding_level = Column(String(32), nullable=False)
    feedback_strategy = Column(String(32), nullable=False)
    prompt_version = Column(String(32), nullable=False)
    rubric_version = Column(String(32), nullable=False)
    model_name = Column(String(64), nullable=True)
    direct_solution_given = Column(Boolean, nullable=False, default=False)
    error_types_json = Column(JsonColumn, nullable=True)
    rubric_scores_json = Column(JsonColumn, nullable=True)
    socratic_feedback_json = Column(JsonColumn, nullable=True)
    raw_ai_response_json = Column(JsonColumn, nullable=True)
    parse_status = Column(String(16), nullable=False, default="success")
    latency_ms = Column(Integer, nullable=True)
    evaluated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)

    submission = relationship("Submission", back_populates="evaluation")
    session = relationship("StudySession", back_populates="evaluations")


class InteractionEvent(Base):
    """Append-only etkileşim günlüğü — YAYIN_016 öğrenme analitiği."""

    __tablename__ = "interaction_events"
    __table_args__ = (
        Index("ix_interaction_events_session_sequence", "session_id", "event_sequence"),
        Index("ix_interaction_events_type_occurred", "event_type", "occurred_at"),
        Index("ix_interaction_events_session_occurred", "session_id", "occurred_at"),
    )

    event_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("study_sessions.session_id"), nullable=False, index=True)
    event_type = Column(String(64), nullable=False)
    event_sequence = Column(Integer, nullable=False)
    submission_id = Column(UUID(as_uuid=True), ForeignKey("submissions.submission_id"), nullable=True)
    evaluation_id = Column(UUID(as_uuid=True), ForeignKey("evaluations.evaluation_id"), nullable=True)
    from_status = Column(String(32), nullable=True)
    to_status = Column(String(32), nullable=True)
    from_scaffolding_level = Column(String(32), nullable=True)
    to_scaffolding_level = Column(String(32), nullable=True)
    actor_type = Column(String(16), nullable=False, default="system")
    actor_id = Column(Integer, nullable=True)
    metadata_json = Column(JsonColumn, nullable=False, default=dict)
    occurred_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)

    session = relationship("StudySession", back_populates="interaction_events")


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    title = Column(String)
    content = Column(Text)
    type = Column(String, default="info")
    date = Column(String)


class UserBadge(Base):
    __tablename__ = "user_badges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    badge_name = Column(String, index=True)
    earned_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="badges")
