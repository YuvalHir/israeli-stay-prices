-- Photon returned ids like osm-N-123 while Overpass returned osm-node-123 for the same place.
-- Normalize everything to osm-node / osm-way / osm-relation.
UPDATE reports SET place_id = 'osm-node-' || substr(place_id, 7) WHERE place_id LIKE 'osm-N-%';
UPDATE reports SET place_id = 'osm-way-' || substr(place_id, 7) WHERE place_id LIKE 'osm-W-%';
UPDATE reports SET place_id = 'osm-relation-' || substr(place_id, 7) WHERE place_id LIKE 'osm-R-%';
UPDATE OR IGNORE place_views SET place_id = 'osm-node-' || substr(place_id, 7) WHERE place_id LIKE 'osm-N-%';
UPDATE OR IGNORE place_views SET place_id = 'osm-way-' || substr(place_id, 7) WHERE place_id LIKE 'osm-W-%';
UPDATE OR IGNORE place_views SET place_id = 'osm-relation-' || substr(place_id, 7) WHERE place_id LIKE 'osm-R-%';
DELETE FROM place_views WHERE place_id LIKE 'osm-N-%' OR place_id LIKE 'osm-W-%' OR place_id LIKE 'osm-R-%';
