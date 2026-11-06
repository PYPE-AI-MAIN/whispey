-- The campaign store now exists (scheduler PR #36), so a campaigns route may point at a customer destination.
-- The combination rules (campaigns need call data on the same destination, a healthy destination) are enforced in
-- routingPolicy.ts when a route is saved and on every request, so the database no longer restricts the kind.
CREATE OR REPLACE FUNCTION data_destination_routes_check() RETURNS trigger AS $$
BEGIN
  RETURN NEW;
END $$ LANGUAGE plpgsql;
