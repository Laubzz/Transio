-- Seule la route serveur de l'agenda (rôle anon + jeton secret) appelle cette fonction.
revoke execute on function public.calendar_state(text) from authenticated;
