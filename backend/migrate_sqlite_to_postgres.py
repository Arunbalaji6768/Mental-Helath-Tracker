import os
from sqlalchemy import create_engine, MetaData, Table
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError


def get_sqlite_engine() -> Engine:
    # Assumes SQLite file in backend folder named journal.db (default in Config)
    sqlite_url = os.environ.get("SQLITE_URL", "sqlite:///journal.db")
    return create_engine(sqlite_url)


def get_postgres_engine() -> Engine:
    pg_url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not pg_url:
        raise RuntimeError("DATABASE_URL/POSTGRES_URL not set. Example: postgresql+psycopg2://user:pass@host:5432/db")
    return create_engine(pg_url)


def copy_table(source_engine: Engine, target_engine: Engine, table_name: str) -> int:
    src_meta = MetaData(bind=source_engine)
    tgt_meta = MetaData(bind=target_engine)

    src_table = Table(table_name, src_meta, autoload_with=source_engine)
    tgt_table = Table(table_name, tgt_meta, autoload_with=target_engine)

    rows_copied = 0
    with source_engine.connect() as src_conn, target_engine.connect() as tgt_conn:
        result = src_conn.execute(src_table.select())
        rows = [dict(r._mapping) for r in result]
        if rows:
            tgt_conn.execute(tgt_table.insert(), rows)
            rows_copied = len(rows)
    return rows_copied


def main():
    try:
        sqlite_engine = get_sqlite_engine()
        pg_engine = get_postgres_engine()

        # Ensure target schema exists (tables should be created by running app once)
        # Copy order respects FKs: users -> journal_entries -> user_sessions
        order = ["users", "journal_entries", "user_sessions"]

        total = 0
        for table in order:
            try:
                copied = copy_table(sqlite_engine, pg_engine, table)
                print(f"Copied {copied} rows from {table}")
                total += copied
            except Exception as e:
                print(f"Skipping table {table}: {e}")

        print(f"Migration finished. Total rows copied: {total}")

    except SQLAlchemyError as e:
        print(f"SQLAlchemy error: {e}")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()


