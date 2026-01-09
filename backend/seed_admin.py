
import sys
import os
import time
import logging
from sqlalchemy import text

# Configure logging to stdout
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# Add current directory to path so we can import 'app' module and sibling scripts
sys.path.append(os.getcwd())

from app.database import SessionLocal
from app.models import User
from app.auth import get_password_hash

# Try importing the schema fix script
try:
    import fix_postgres_schema
except ImportError:
    logger.warning("fix_postgres_schema.py not found. Schema repair will be skipped.")
    fix_postgres_schema = None

def wait_for_db(max_retries=15, delay=2):
    """Wait for database to become amenable to connection."""
    retries = 0
    while retries < max_retries:
        try:
            db = SessionLocal()
            # Try a simple query to verify connection
            db.execute(text("SELECT 1"))
            db.close()
            logger.info("[SEED] Database connection verified.")
            return True
        except Exception as e:
            logger.warning(f"[SEED] Database not ready yet. Retrying in {delay}s... (Error: {str(e)})")
            time.sleep(delay)
            retries += 1
    return False

def seed_admin():
    logger.info("[SEED] Admin creation process started...")
    
    if not wait_for_db():
        logger.error("[SEED] CRITICAL: Could not connect to database after maximum retries.")
        return

    # --- Run Schema Fix (PostgreSQL Constraints) ---
    if fix_postgres_schema:
        try:
            logger.info("[SEED] Executing PostgreSQL schema repair (fix_postgres_schema.py)...")
            fix_postgres_schema.fix_schema()
            logger.info("[SEED] Schema repair completed.")
        except Exception as e:
            logger.error(f"[SEED] Schema repair encountered an error (continuing with admin seed): {e}")
    else:
        logger.warning("[SEED] Skipping schema repair (module missing).")
    # -----------------------------------------------

    db = SessionLocal()
    try:
        target_email = "admin@edustack.cloud"
        target_username = "ADMIN001" 
        target_password = "admin123"
        hashed_pwd = get_password_hash(target_password)

        logger.info(f"[SEED] Checking for admin user: {target_email} / {target_username}")
        
        user = db.query(User).filter(User.email == target_email).first()
        if not user:
             user = db.query(User).filter(User.student_number == target_username).first()

        if user:
            logger.info(f"[SEED] Existing admin found (ID: {user.id}). Updating credentials to ensure access...")
            updates_made = False
            
            if user.email != target_email:
                user.email = target_email
                updates_made = True
            
            # Always reset password
            user.password_hash = hashed_pwd
            updates_made = True
            
            if user.role != "superadmin":
                user.role = "superadmin"
                updates_made = True

            db.commit()
            if updates_made:
                logger.info("[SEED] SUCCESS: Admin credentials and role updated.")
            else:
                logger.info("[SEED] SUCCESS: Admin user verified (no changes needed).")
        else:
            logger.info("[SEED] Admin user not found. Creating new Super Admin...")
            new_admin = User(
                student_number=target_username,
                full_name="System Administrator",
                email=target_email,
                password_hash=hashed_pwd,
                role="superadmin",
                is_first_login=False,
                organization_id=None 
            )
            db.add(new_admin)
            db.commit()
            logger.info(f"[SEED] SUCCESS: New Super Admin created with username: {target_username}")

    except Exception as e:
        logger.error(f"[SEED] FAILED: An unexpected error occurred during seeding: {e}")
        db.rollback()
    finally:
        db.close()
        logger.info("[SEED] Seed process finished.")

if __name__ == "__main__":
    seed_admin()
