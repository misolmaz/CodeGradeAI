"""add_socratic_flow_tables

Revision ID: 234ff9a58f47
Revises: 
Create Date: 2026-07-14 22:32:08.686498

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '234ff9a58f47'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'study_sessions',
        sa.Column('session_id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('assignment_id', sa.Integer(), nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=False),
        sa.Column('session_status', sa.String(length=32), nullable=False),
        sa.Column('current_scaffolding_level', sa.String(length=32), nullable=True),
        sa.Column('attempt_count', sa.Integer(), nullable=False),
        sa.Column('max_scaffolding_level_reached', sa.String(length=32), nullable=True),
        sa.Column('research_pseudonym', sa.String(length=64), nullable=True),
        sa.Column('student_level', sa.String(length=16), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_activity_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('final_grade', sa.SmallInteger(), nullable=True),
        sa.Column('full_report_unlocked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('consent_recorded', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['assignment_id'], ['assignments.id']),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['student_id'], ['users.id']),
        sa.PrimaryKeyConstraint('session_id'),
    )
    op.create_index(op.f('ix_study_sessions_assignment_id'), 'study_sessions', ['assignment_id'], unique=False)
    op.create_index(op.f('ix_study_sessions_organization_id'), 'study_sessions', ['organization_id'], unique=False)
    op.create_index(op.f('ix_study_sessions_student_id'), 'study_sessions', ['student_id'], unique=False)

    # Extend submissions before evaluations FK
    op.add_column('submissions', sa.Column('submission_id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False))
    op.add_column('submissions', sa.Column('session_id', sa.UUID(), nullable=True))
    op.add_column('submissions', sa.Column('attempt_no', sa.Integer(), nullable=True))
    op.add_column('submissions', sa.Column('code_hash', sa.String(length=64), nullable=True))
    op.add_column('submissions', sa.Column('code_language', sa.String(length=32), nullable=True))
    op.add_column('submissions', sa.Column('submission_source', sa.String(length=16), nullable=True))
    op.add_column('submissions', sa.Column('is_final', sa.Boolean(), nullable=True))
    op.add_column('submissions', sa.Column('created_at', sa.DateTime(), nullable=True))
    op.create_index(op.f('ix_submissions_session_id'), 'submissions', ['session_id'], unique=False)
    op.create_index(op.f('ix_submissions_submission_id'), 'submissions', ['submission_id'], unique=True)
    op.create_foreign_key('fk_submissions_session_id', 'submissions', 'study_sessions', ['session_id'], ['session_id'])
    op.alter_column('submissions', 'submission_id', server_default=None)

    op.create_table(
        'evaluations',
        sa.Column('evaluation_id', sa.UUID(), nullable=False),
        sa.Column('submission_id', sa.UUID(), nullable=False),
        sa.Column('session_id', sa.UUID(), nullable=False),
        sa.Column('grading_result_json', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
        sa.Column('grade', sa.SmallInteger(), nullable=False),
        sa.Column('scaffolding_level', sa.String(length=32), nullable=False),
        sa.Column('feedback_strategy', sa.String(length=32), nullable=False),
        sa.Column('prompt_version', sa.String(length=32), nullable=False),
        sa.Column('rubric_version', sa.String(length=32), nullable=False),
        sa.Column('model_name', sa.String(length=64), nullable=True),
        sa.Column('direct_solution_given', sa.Boolean(), nullable=False),
        sa.Column('error_types_json', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
        sa.Column('rubric_scores_json', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
        sa.Column('socratic_feedback_json', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
        sa.Column('raw_ai_response_json', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
        sa.Column('parse_status', sa.String(length=16), nullable=False),
        sa.Column('latency_ms', sa.Integer(), nullable=True),
        sa.Column('evaluated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['study_sessions.session_id']),
        sa.ForeignKeyConstraint(['submission_id'], ['submissions.submission_id']),
        sa.PrimaryKeyConstraint('evaluation_id'),
    )
    op.create_index(op.f('ix_evaluations_session_id'), 'evaluations', ['session_id'], unique=False)
    op.create_index(op.f('ix_evaluations_submission_id'), 'evaluations', ['submission_id'], unique=True)

    op.create_table(
        'interaction_events',
        sa.Column('event_id', sa.UUID(), nullable=False),
        sa.Column('session_id', sa.UUID(), nullable=False),
        sa.Column('event_type', sa.String(length=64), nullable=False),
        sa.Column('event_sequence', sa.Integer(), nullable=False),
        sa.Column('submission_id', sa.UUID(), nullable=True),
        sa.Column('evaluation_id', sa.UUID(), nullable=True),
        sa.Column('from_status', sa.String(length=32), nullable=True),
        sa.Column('to_status', sa.String(length=32), nullable=True),
        sa.Column('from_scaffolding_level', sa.String(length=32), nullable=True),
        sa.Column('to_scaffolding_level', sa.String(length=32), nullable=True),
        sa.Column('actor_type', sa.String(length=16), nullable=False),
        sa.Column('actor_id', sa.Integer(), nullable=True),
        sa.Column('metadata_json', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
        sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['evaluation_id'], ['evaluations.evaluation_id']),
        sa.ForeignKeyConstraint(['session_id'], ['study_sessions.session_id']),
        sa.ForeignKeyConstraint(['submission_id'], ['submissions.submission_id']),
        sa.PrimaryKeyConstraint('event_id'),
    )
    op.create_index(op.f('ix_interaction_events_session_id'), 'interaction_events', ['session_id'], unique=False)
    op.create_index('ix_interaction_events_session_occurred', 'interaction_events', ['session_id', 'occurred_at'], unique=False)
    op.create_index('ix_interaction_events_session_sequence', 'interaction_events', ['session_id', 'event_sequence'], unique=False)
    op.create_index('ix_interaction_events_type_occurred', 'interaction_events', ['event_type', 'occurred_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_interaction_events_type_occurred', table_name='interaction_events')
    op.drop_index('ix_interaction_events_session_sequence', table_name='interaction_events')
    op.drop_index('ix_interaction_events_session_occurred', table_name='interaction_events')
    op.drop_index(op.f('ix_interaction_events_session_id'), table_name='interaction_events')
    op.drop_table('interaction_events')
    op.drop_index(op.f('ix_evaluations_submission_id'), table_name='evaluations')
    op.drop_index(op.f('ix_evaluations_session_id'), table_name='evaluations')
    op.drop_table('evaluations')
    op.drop_constraint('fk_submissions_session_id', 'submissions', type_='foreignkey')
    op.drop_index(op.f('ix_submissions_submission_id'), table_name='submissions')
    op.drop_index(op.f('ix_submissions_session_id'), table_name='submissions')
    op.drop_column('submissions', 'created_at')
    op.drop_column('submissions', 'is_final')
    op.drop_column('submissions', 'submission_source')
    op.drop_column('submissions', 'code_language')
    op.drop_column('submissions', 'code_hash')
    op.drop_column('submissions', 'attempt_no')
    op.drop_column('submissions', 'session_id')
    op.drop_column('submissions', 'submission_id')
    op.drop_index(op.f('ix_study_sessions_student_id'), table_name='study_sessions')
    op.drop_index(op.f('ix_study_sessions_organization_id'), table_name='study_sessions')
    op.drop_index(op.f('ix_study_sessions_assignment_id'), table_name='study_sessions')
    op.drop_table('study_sessions')
