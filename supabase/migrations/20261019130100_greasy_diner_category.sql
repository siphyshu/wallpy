-- Greasy Diner is a cartoon diner in a forest, not a city scene.
update public.pack_versions v set categories = '{art,nature}'
from public.packs p where p.id = v.pack_id and p.slug = 'greasy-diner';
