-- Run after the existing schema and FINAL_STAFF_WORKFLOW_MIGRATION.sql.
-- Preserve existing valid action values while adding PROCESS_FORWARD.
BEGIN;
DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_constraintdef(oid) INTO definition FROM pg_constraint
 WHERE conrelid='los_underwriting_action'::regclass
   AND conname='los_underwriting_action_action_check';
 IF definition IS NOT NULL AND position('PROCESS_FORWARD' in definition)=0 THEN
   ALTER TABLE los_underwriting_action DROP CONSTRAINT los_underwriting_action_action_check;
   EXECUTE 'ALTER TABLE los_underwriting_action ADD CONSTRAINT los_underwriting_action_action_check CHECK (' ||
     substring(definition from 8 for length(definition)-8) || ' OR action = ''PROCESS_FORWARD'')';
 END IF;
END $$;
COMMIT;
