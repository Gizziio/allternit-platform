-- Database-level provisioning guards close the race between an API quota
-- check and its instance insert. Application checks provide friendly errors;
-- this trigger is the final boundary against concurrent over-provisioning.

CREATE TRIGGER enforce_hosted_runtime_insert_quota
BEFORE INSERT ON hosted_runtime_instances
BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1
        FROM user_runtime_quotas
        WHERE user_id = NEW.user_id
          AND can_create_hosted_runtime = 1
          AND max_hosted_runtimes > 0
    ) THEN RAISE(ABORT, 'hosted_runtime_entitlement_required') END;

    SELECT CASE WHEN NEW.memory_mb <= 0 OR NEW.memory_mb > COALESCE((
        SELECT max_hosted_runtime_memory_mb
        FROM user_runtime_quotas
        WHERE user_id = NEW.user_id
    ), 0) THEN RAISE(ABORT, 'hosted_runtime_memory_limit') END;

    SELECT CASE WHEN (
        SELECT COUNT(*)
        FROM hosted_runtime_instances
        WHERE user_id = NEW.user_id
          AND status NOT IN ('destroying', 'destroyed')
    ) >= COALESCE((
        SELECT max_hosted_runtimes
        FROM user_runtime_quotas
        WHERE user_id = NEW.user_id
    ), 0) THEN RAISE(ABORT, 'hosted_runtime_instance_limit') END;
END;
