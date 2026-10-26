-- Extend the existing payment intent to cash contributions created outside a schedule.
-- No backfill, no emission and no change to existing parcel identities.
ALTER TABLE bia_contribution_charges ALTER COLUMN parcel_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bia_contribution_flow_charge_unique
ON bia_contribution_charges(environment, flow_id) WHERE parcel_id IS NULL;
