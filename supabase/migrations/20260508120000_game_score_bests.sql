-- Keep the mobile Dentblast leaderboard to one best score per attendee and wave.

create index if not exists game_scores_best_lookup_idx
  on public.game_scores (wave, attendee_id, score desc, created_at asc);

create or replace view public.game_score_bests as
select distinct on (gs.wave, gs.attendee_id)
  gs.id,
  gs.attendee_id,
  gs.score,
  gs.wave,
  gs.created_at
from public.game_scores gs
order by gs.wave, gs.attendee_id, gs.score desc, gs.created_at asc;

grant select on public.game_score_bests to anon, authenticated;
