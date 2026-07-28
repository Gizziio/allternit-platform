-- Rotation grace for runtime device credentials.
--
-- Two components on a BYO box (gizzi-code's Pairing service and the
-- agent-daemon) hold the same device token and rotate it independently.
-- Whichever rotated first used to strand the other's stored token: the
-- rotate endpoint replaced credential_hash immediately, so the second
-- component died with 401s. After a rotation the previous hash now stays
-- valid for a short grace window (15 minutes, enforced in
-- runtime_pairing::runtime_device_for_token) so the stranded component
-- keeps working until its own rotation self-heals it.
--
-- previous_* is never refreshed by authenticating with it — the component
-- must rotate to get a valid token; the grace only keeps it alive meanwhile.
-- It is treated as absent once previous_credential_expires_at passes and is
-- replaced on the next rotation.

ALTER TABLE runtime_devices ADD COLUMN previous_credential_hash TEXT;
ALTER TABLE runtime_devices ADD COLUMN previous_credential_expires_at TIMESTAMP;
