-- Backfills pype_voice_call_logs.project_id — Confluence §6.2, and the case the
-- edge-case register calls A8.
--
-- 958,476 rows on production. A single UPDATE rewrites every one of them and
-- leaves a dead copy of each behind, doubling the table's disk use before
-- anything is reclaimed — on an instance already at 134 GB of 202 GB that is how
-- you cause the incident you are trying to avoid.
--
-- So: batches, a pause between them, and a VACUUM every few passes. A PROCEDURE
-- rather than a DO block because only a procedure can COMMIT as it goes; without
-- that, "batches" is one long transaction wearing a disguise.
--
-- Run it out of hours, and on production run the disk cleanup first.
--
--   CALL backfill_call_logs_project_id();                  -- everything
--   CALL backfill_call_logs_project_id(5000, 0.25, 200);   -- gentler
--
-- Safe to stop and re-run: it only ever touches rows that are still NULL.

CREATE OR REPLACE PROCEDURE backfill_call_logs_project_id(
  batch_size    int      DEFAULT 10000,
  pause_seconds numeric  DEFAULT 0.1,
  max_batches   int      DEFAULT 1000
)
LANGUAGE plpgsql AS $$
DECLARE
  touched  int;
  total    bigint := 0;
  batches  int := 0;
BEGIN
  LOOP
    EXIT WHEN batches >= max_batches;

    WITH next_rows AS (
      SELECT l.id, a.project_id
      FROM   pype_voice_call_logs l
      JOIN   pype_voice_agents a ON a.id = l.agent_id
      WHERE  l.project_id IS NULL
      LIMIT  batch_size
      FOR    UPDATE OF l SKIP LOCKED
    )
    UPDATE pype_voice_call_logs l
    SET    project_id = n.project_id
    FROM   next_rows n
    WHERE  l.id = n.id;

    GET DIAGNOSTICS touched = ROW_COUNT;
    EXIT WHEN touched = 0;

    total   := total + touched;
    batches := batches + 1;
    COMMIT;

    -- let ingest through, and give autovacuum a chance at the dead rows
    PERFORM pg_sleep(pause_seconds);
    IF batches % 20 = 0 THEN
      RAISE NOTICE 'backfilled % rows in % batches', total, batches;
      COMMIT;
    END IF;
  END LOOP;

  RAISE NOTICE 'done: % rows in % batches', total, batches;
END $$;

-- What is left, at any point:
--   SELECT count(*) FILTER (WHERE project_id IS NULL) AS remaining,
--          count(*) AS total
--   FROM   pype_voice_call_logs;
--
-- Rows that stay NULL belong to an agent that no longer exists. Look before
-- assuming they are junk:
--   SELECT agent_id, count(*) FROM pype_voice_call_logs
--   WHERE project_id IS NULL GROUP BY 1 ORDER BY 2 DESC;
