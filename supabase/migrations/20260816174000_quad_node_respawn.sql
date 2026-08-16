-- Quadruple all node respawn times (trees, ore, bushes, etc).
-- Authoritative value used by harvest_node(): world_nodes.respawn_s.
UPDATE world_nodes SET respawn_s = respawn_s * 4;
