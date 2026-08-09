CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS libraries (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'READY',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS libraries_created_idx
    ON libraries (created_at DESC);

CREATE TABLE IF NOT EXISTS shootings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    library_id TEXT,
    status TEXT NOT NULL DEFAULT 'READY',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shootings_library_idx
    ON shootings (library_id, created_at DESC);

CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    shooting_id TEXT REFERENCES shootings(id) ON DELETE SET NULL,
    library_id TEXT,
    original_filename TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    url TEXT NOT NULL,
    content_type TEXT NOT NULL,
    byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
    sha256 CHAR(64) NOT NULL UNIQUE,
    width INTEGER CHECK (width IS NULL OR width > 0),
    height INTEGER CHECK (height IS NULL OR height > 0),
    caption TEXT NOT NULL DEFAULT '',
    tags TEXT[] NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'STORED',
    embedding_model TEXT,
    embedding_revision TEXT,
    search_document TSVECTOR NOT NULL DEFAULT ''::tsvector,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_photo_search_document()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.search_document := to_tsvector(
        'simple',
        coalesce(NEW.original_filename, '') || ' ' ||
        coalesce(NEW.caption, '') || ' ' ||
        coalesce(array_to_string(NEW.tags, ' '), '')
    );
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS photos_search_document_trigger ON photos;
CREATE TRIGGER photos_search_document_trigger
BEFORE INSERT OR UPDATE OF original_filename, caption, tags
ON photos
FOR EACH ROW
EXECUTE FUNCTION update_photo_search_document();

CREATE INDEX IF NOT EXISTS photos_search_document_idx
    ON photos USING GIN (search_document);
CREATE INDEX IF NOT EXISTS photos_filename_trgm_idx
    ON photos USING GIN (original_filename gin_trgm_ops);
CREATE INDEX IF NOT EXISTS photos_scope_idx
    ON photos (library_id, shooting_id, created_at DESC);
CREATE INDEX IF NOT EXISTS photos_status_idx
    ON photos (status, created_at);

CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    job_type TEXT NOT NULL,
    dedupe_key TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    progress DOUBLE PRECISION NOT NULL DEFAULT 0
        CHECK (progress >= 0 AND progress <= 1),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    message TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS jobs_active_dedupe_idx
    ON jobs (job_type, dedupe_key)
    WHERE dedupe_key IS NOT NULL AND status IN ('PENDING', 'RUNNING');
CREATE INDEX IF NOT EXISTS jobs_pending_idx
    ON jobs (status, created_at);

CREATE TABLE IF NOT EXISTS clusters (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    shooting_id TEXT REFERENCES shootings(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cluster_photos (
    cluster_id TEXT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    confidence DOUBLE PRECISION,
    assignment_source TEXT NOT NULL DEFAULT 'algorithm',
    PRIMARY KEY (cluster_id, photo_id)
);
