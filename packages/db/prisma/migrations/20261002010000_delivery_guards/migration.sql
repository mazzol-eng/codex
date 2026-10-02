BEGIN;
ALTER TABLE connections ADD COLUMN "nextSendAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE contacts ADD COLUMN "nextSendAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE messages ADD COLUMN sender TEXT NOT NULL DEFAULT 'bot';
CREATE FUNCTION bothub_reject_published_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Published flow versions are immutable';
END;
$$;
CREATE TRIGGER immutable_flow_versions BEFORE UPDATE ON flow_versions FOR EACH ROW EXECUTE FUNCTION bothub_reject_published_update();
COMMIT;
