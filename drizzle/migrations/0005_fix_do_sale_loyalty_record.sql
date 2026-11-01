do $mig$ declare d text; begin
  d := pg_get_functiondef('public._do_sale(uuid,uuid,jsonb,uuid,text,boolean,text)'::regprocedure);
  d := replace(d, ' l record;', ' l public.loyalty%rowtype;');
  execute d;
end $mig$;