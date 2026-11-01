CREATE TABLE public.self_access_attempts (
 customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
 failures integer NOT NULL DEFAULT 0 CHECK (failures >= 0),
 blocked_until timestamptz
);
GRANT ALL ON public.self_access_attempts TO service_role;
ALTER TABLE public.self_access_attempts ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.self_security_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 vendor_id uuid NOT NULL REFERENCES public.profiles(id),
 customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
 customer_name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 blocked_until timestamptz NOT NULL,
 kind text NOT NULL DEFAULT 'invalid_card_attempts'
);
GRANT SELECT ON public.self_security_events TO authenticated;
GRANT ALL ON public.self_security_events TO service_role;
ALTER TABLE public.self_security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seller and establishment owner read security events" ON public.self_security_events FOR SELECT TO authenticated USING (public._can_manage(vendor_id));

CREATE OR REPLACE FUNCTION public.self_identify_secure(_slug text, _name text, _whatsapp text, _card_suffix text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ctx record; c record; a record; digits text := regexp_replace(coalesce(_whatsapp,''), '\D', '', 'g'); phone_key text; suffix text := upper(trim(coalesce(_card_suffix,''))); until_at timestamptz;
BEGIN
 SELECT * INTO ctx FROM _self_ctx(_slug, null);
 IF length(digits) < 10 OR length(digits) > 13 THEN RETURN jsonb_build_object('status','error','message','WhatsApp inválido'); END IF;
 IF NOT vendor_is_active(ctx.vendor) THEN RETURN jsonb_build_object('status','error','message','Este vendedor não está aceitando autoatendimento no momento'); END IF;
 phone_key := right(digits, 11);
 PERFORM pg_advisory_xact_lock(hashtextextended(ctx.vendor::text || ':' || phone_key, 0));
 SELECT * INTO c FROM customers WHERE vendor_id = ctx.vendor AND right(regexp_replace(coalesce(whatsapp,''), '\D', '', 'g'), 11) = phone_key ORDER BY created_at LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN
   IF length(trim(coalesce(_name,''))) < 2 THEN RETURN jsonb_build_object('status','error','message','Informe seu nome'); END IF;
   INSERT INTO customers(vendor_id,name,whatsapp,notes) VALUES(ctx.vendor,left(trim(_name),80),digits,'Cadastro por autoatendimento') RETURNING * INTO c;
   RETURN jsonb_build_object('status','ok','is_new',true,'token',c.token,'code',c.code,'whatsapp',c.whatsapp);
 END IF;
 INSERT INTO self_access_attempts(customer_id) VALUES(c.id) ON CONFLICT DO NOTHING;
 SELECT * INTO a FROM self_access_attempts WHERE customer_id=c.id FOR UPDATE;
 IF a.blocked_until > now() THEN
   RETURN jsonb_build_object('status','blocked','blocked_until',a.blocked_until,'message','Acesso bloqueado por 30 minutos após 5 tentativas erradas. Aguarde ou peça ajuda ao vendedor.');
 END IF;
 IF a.blocked_until IS NOT NULL THEN
   UPDATE self_access_attempts SET failures=0, blocked_until=NULL WHERE customer_id=c.id;
   a.failures := 0;
 END IF;
 IF suffix = '' THEN RETURN jsonb_build_object('status','code_required','message','Este WhatsApp já tem cartão. Informe os 4 últimos caracteres do código para entrar.'); END IF;
 IF length(suffix) <> 4 OR suffix <> upper(right(c.code,4)) THEN
   a.failures := a.failures + 1;
   IF a.failures >= 5 THEN
     until_at := now() + interval '30 minutes';
     UPDATE self_access_attempts SET failures=a.failures,blocked_until=until_at WHERE customer_id=c.id;
     INSERT INTO self_security_events(vendor_id,customer_id,customer_name,blocked_until) VALUES(ctx.vendor,c.id,c.name,until_at);
     RETURN jsonb_build_object('status','blocked','blocked_until',until_at,'message','Acesso bloqueado por 30 minutos após 5 tentativas erradas. Aguarde ou peça ajuda ao vendedor.');
   END IF;
   UPDATE self_access_attempts SET failures=a.failures WHERE customer_id=c.id;
   RETURN jsonb_build_object('status','invalid_code','remaining',5-a.failures,'message','Código incorreto. Confira os 4 últimos caracteres do seu cartão.');
 END IF;
 UPDATE self_access_attempts SET failures=0,blocked_until=NULL WHERE customer_id=c.id;
 RETURN jsonb_build_object('status','ok','is_new',false,'token',c.token,'code',c.code,'whatsapp',c.whatsapp);
END $$;
REVOKE ALL ON FUNCTION public.self_identify_secure(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.self_identify_secure(text,text,text,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.self_identify(_slug text, _name text, _whatsapp text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
 r := self_identify_secure(_slug,_name,_whatsapp,NULL);
 IF r->>'status' <> 'ok' THEN RAISE EXCEPTION '%', r->>'message'; END IF;
 RETURN r->>'token';
END $$;
COMMENT ON FUNCTION public.self_identify(text,text,text) IS 'DEPRECATED: use self_identify_secure; legacy entry never releases an existing customer token without card proof.';
CREATE OR REPLACE FUNCTION public.self_card(_slug text, _token text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ctx record; c record;
BEGIN
 SELECT * INTO ctx FROM _self_ctx(_slug,_token);
 SELECT * INTO c FROM customers WHERE id=ctx.customer;
 RETURN get_public_card(c.code) || jsonb_build_object('whatsapp',c.whatsapp,
 'credit_items',coalesce((SELECT jsonb_agg(jsonb_build_object('product_id',cr.product_id,'product',p.name,'kind',cr.kind,'qty',cr.qty)) FROM credits cr JOIN products p ON p.id=cr.product_id WHERE cr.customer_id=c.id AND cr.qty>0),'[]'));
END $$;