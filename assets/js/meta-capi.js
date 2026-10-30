/* Meta Pixel + API de Conversões (via GTM server-side).
   Espelho de aplia-web/src/lib/analytics.ts (trackMetaEvent): dispara o Pixel
   com eventID e empurra o MESMO evento (mesmo event_id) no dataLayer como
   `meta_capi`. O hash SHA-256 da PII, IP e user agent ficam no container
   server-side; o token da CAPI nunca passa por aqui.
   Identificadores de navegador SAIR SEMPRE (decisão do negócio, divulgada no
   banner e na política): fbp, fbc e external_id (ID anônimo persistente, ou o
   do lead/usuário quando existir), mesmo antes do aceite ou com recusa.
   Dados de contato (em, ph, fn, ln, ge, db, ct, st, zp) SÓ com
   aplia_consent=granted, lido a cada evento (vale na hora, sem recarregar).
   Nada que indique saúde vai ao Meta (URL e nomes neutros).
   Todo evento do Pixel (padrão, personalizado e PageView) sai TAMBÉM pelo
   servidor (meta_capi) com o MESMO event_id do fbq (eventID), pra Meta deduplicar.
   Cliques dos botões: window.apliaTrack / data-track (ver abaixo).
   Depende de consent.js (carregar antes). Ver aplia-web/docs/META-CAPI-GTM.md. */
(function () {
	/* Schedule e Search ficam DESLIGADOS (dado de saúde de terceiros). */
	var BLOCKED = { Schedule: 1, Search: 1 };

	/* Allowlist: o que não estiver aqui é descartado antes de sair do navegador.
	   Nada de nome de paciente, diagnóstico, termo de busca ou dado de saúde. */
	var CUSTOM_DATA_ALLOWED = ['value', 'currency', 'content_name', 'content_ids', 'content_type',
		'content_category', 'num_items', 'status'];
	var USER_DATA_ALLOWED = ['em', 'ph', 'fn', 'ln', 'ge', 'db', 'ct', 'st', 'zp', 'country',
		'external_id', 'subscription_id', 'fbp', 'fbc'];

	function pick(obj, allowed) {
		var out = {};
		if (!obj) return out;
		for (var i = 0; i < allowed.length; i++) {
			var v = obj[allowed[i]];
			if (v !== undefined && v !== null && v !== '') out[allowed[i]] = v;
		}
		return out;
	}

	var clean = function (v) { return v ? String(v).trim().toLowerCase() : undefined; };
	var norm = function (v) { return v ? String(v).trim().toLowerCase().replace(/\s+/g, '') || undefined : undefined; };
	/* só dígitos com DDI; número BR sem DDI (10-11 dígitos) ganha 55 */
	var phone = function (v) {
		var d = v ? String(v).replace(/\D/g, '') : '';
		if (!d) return undefined;
		return (d.length === 10 || d.length === 11) ? '55' + d : d;
	};
	/* AAAAMMDD (aceita AAAA-MM-DD, DD/MM/AAAA ou já normalizado) */
	var birth = function (v) {
		var t = v ? String(v).trim() : '';
		var br = t.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
		if (br) return br[3] + br[2] + br[1];
		var d = t.replace(/\D/g, '');
		return d.length === 8 ? d : undefined;
	};
	var country = function (v) { return v && String(v).trim().length === 2 ? String(v).trim().toLowerCase() : undefined; };

	/* Lê o cookie aplia_consent direto (granted | denied; qualquer outro valor
	   ou ausente = sem escolha), sem depender de consent.js ter carregado. Só se o
	   cookie não responder, tenta window.marketingConsentState. Lido a cada
	   evento, então aceitar/recusar no banner vale na hora, sem recarregar. */
	function readCookieDirect(name) {
		try {
			var parts = document.cookie.split('; ');
			for (var i = 0; i < parts.length; i++) {
				if (parts[i].indexOf(name + '=') === 0) return decodeURIComponent(parts[i].slice(name.length + 1));
			}
		} catch (e) { }
		return undefined;
	}
	function consentState() {
		var v = readCookieDirect('aplia_consent');
		if (v === 'granted' || v === 'denied') return v;
		try {
			if (typeof window.marketingConsentState === 'function') {
				var f = window.marketingConsentState();
				if (f === 'granted' || f === 'denied') return f;
			}
		} catch (e) { }
		return null;
	}

	/* Só caminhos neutros vão como event_source_url / content_name. Posts do blog
	   viram /blog (o slug pode citar paciente/tema de saúde); qualquer outro
	   caminho vira a raiz. Sem querystring nem hash (utm, fbclid, etc.). */
	var SAFE_PAGES = {
		'/': 'home', '/precos': 'precos', '/funcionalidades': 'funcionalidades',
		'/integracoes': 'integracoes', '/lgpd': 'lgpd', '/blog': 'blog',
		'/secretaria-virtual-ia': 'secretaria_virtual', '/agendamento-whatsapp': 'agendamento_whatsapp',
		'/avaliacao': 'avaliacao'
	};
	function safePath() {
		var path = (location.pathname || '/').replace(/\/index\.html$/, '/').replace(/\.html$/, '');
		if (path.length > 1) path = path.replace(/\/+$/, '');
		if (path.indexOf('/blog/') === 0) path = '/blog';
		return SAFE_PAGES[path] ? path : '/';
	}
	function safeUrl() { return location.origin + safePath(); }
	function cookie(name) {
		var v = readCookieDirect(name);
		if (v !== undefined) return v;
		return typeof window.readCookie === 'function' ? window.readCookie(name) : undefined;
	}
	function newId() {
		return (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
			: Date.now() + '-' + Math.random().toString(16).slice(2);
	}

	var rawFbq = window.fbq;

	/* Lead já conhecido neste navegador. O ID do lead (UUID, sem dado pessoal) é
	   guardado sempre e vira o external_id dos eventos seguintes. Os dados de
	   contato do lead (e-mail, telefone, nome) só são guardados e lidos com
	   aplia_consent=granted. 90 dias. */
	var LEAD_KEY = 'aplia_lead';
	var LEAD_ID_KEY = 'aplia_lead_id';
	var LEAD_TTL = 90 * 24 * 3600 * 1000;
	function readJson(key) {
		try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
	}
	function knownLead() {
		if (consentState() !== 'granted') return {};
		var l = readJson(LEAD_KEY);
		return l && l.ts && Date.now() - l.ts <= LEAD_TTL ? l : {};
	}
	function knownLeadId() {
		var l = readJson(LEAD_ID_KEY);
		return l && l.id && l.ts && Date.now() - l.ts <= LEAD_TTL ? l.id : undefined;
	}
	window.rememberLead = function (d) {
		try {
			if (!d) return;
			if (d.externalId) localStorage.setItem(LEAD_ID_KEY, JSON.stringify({ id: d.externalId, ts: Date.now() }));
			if (consentState() !== 'granted') return;
			localStorage.setItem(LEAD_KEY, JSON.stringify({
				email: d.email, phone: d.phone, firstName: d.firstName, lastName: d.lastName,
				externalId: d.externalId, ts: Date.now()
			}));
		} catch (e) { }
	};

	/* user_data. SEMPRE (granted, sem escolha ou denied): external_id, fbp, fbc.
	   Só com granted: em, ph, fn, ln, ge, db, ct, st, zp (+ country e subscription_id). */
	function buildUserData(u) {
		u = u || {};
		var ud = pick({
			external_id: u.externalId || knownLeadId() ||
				(typeof window.anonymousId === 'function' ? window.anonymousId() : undefined),
			fbp: cookie('_fbp'), fbc: cookie('_fbc')
		}, USER_DATA_ALLOWED);
		if (consentState() === 'granted') {
			var k = knownLead();
			var contact = pick({
				em: clean(u.email || k.email), ph: phone(u.phone || k.phone),
				fn: norm(u.firstName || k.firstName), ln: norm(u.lastName || k.lastName),
				ge: clean(u.gender), db: birth(u.birthDate), ct: norm(u.city), st: norm(u.state),
				zp: norm(u.zip), country: country(u.country || (k.email ? 'br' : undefined)),
				subscription_id: u.subscriptionId
			}, USER_DATA_ALLOWED);
			for (var key in contact) ud[key] = contact[key];
		}
		return ud;
	}

	/* O Pixel grava o _fbp só depois que o fbevents.js carrega. Nos primeiros
	   ~500 ms da página, o evento espera o _fbp aparecer (ou o prazo acabar, e
	   então sai sem ele). event_time e o resto ficam fixados no momento do evento. */
	var T0 = Date.now();
	var FBP_WAIT_MS = 500;
	var pending = [];
	var pollTimer = null;
	function emit(meta) {
		(window.dataLayer = window.dataLayer || []).push({ event: 'meta_capi', meta: meta });
	}
	function flushPending(force) {
		var fbp = cookie('_fbp');
		if (!fbp && !force) return false;
		var queue = pending;
		pending = [];
		for (var i = 0; i < queue.length; i++) {
			if (fbp && !queue[i].user_data.fbp) queue[i].user_data.fbp = fbp;
			emit(queue[i]);
		}
		return true;
	}
	function waitForFbp() {
		if (pollTimer) return;
		pollTimer = setInterval(function () {
			if (flushPending(Date.now() - T0 >= FBP_WAIT_MS)) { clearInterval(pollTimer); pollTimer = null; }
		}, 50);
	}

	/* Empurra o evento no dataLayer (GTM web -> servidor -> CAPI). */
	function pushCapi(name, eventId, customData, userData) {
		var hasMoney = customData.value !== undefined || customData.currency !== undefined;
		var meta = {
			event_name: name,
			event_id: eventId,
			event_time: Math.floor(Date.now() / 1000),
			event_source_url: safeUrl(),
			action_source: 'website',
			custom_data: hasMoney ? { value: customData.value, currency: customData.currency } : undefined,
			user_data: buildUserData(userData)
		};
		if (!meta.user_data.fbp && Date.now() - T0 < FBP_WAIT_MS) {
			pending.push(meta);
			waitForFbp();
		} else {
			emit(meta);
		}
	}

	/* userData: {email, phone, firstName, lastName, gender, birthDate, city,
	   state, zip, country, externalId, subscriptionId} (sem hash). Nunca lança. */
	window.trackMetaEvent = function (name, opts) {
		try {
			if (BLOCKED[name]) return '';
			opts = opts || {};
			var customData = pick(opts.customData, CUSTOM_DATA_ALLOWED);
			var eventId = opts.eventId || newId();
			/* rawFbq (não o wrapper abaixo): o wrapper também empurra no dataLayer */
			if (!opts.skipPixel && typeof rawFbq === 'function') rawFbq('track', name, customData, { eventID: eventId });
			pushCapi(name, eventId, customData, opts.userData);
			return eventId;
		} catch (e) {
			return '';
		}
	};

	if (typeof rawFbq === 'function') {
		window.fbq = function () {
			var a = arguments;
			try {
				/* Qualquer evento do Pixel (padrão ou personalizado) ganha eventID e
				   vai também pelo servidor, mesmo que o onclick só chame o fbq. */
				if ((a[0] === 'track' || a[0] === 'trackCustom') && typeof a[1] === 'string') {
					var eventId = (a[3] && a[3].eventID) || newId();
					var ret = rawFbq.apply(this, [a[0], a[1], a[2] || {}, { eventID: eventId }]);
					pushCapi(a[1], eventId, pick(a[2], CUSTOM_DATA_ALLOWED), undefined);
					return ret;
				}
			} catch (e) { }
			return rawFbq.apply(this, a);
		};
		/* o objeto interno do Pixel (queue, loaded...) precisa continuar acessível */
		for (var k in rawFbq) { if (Object.prototype.hasOwnProperty.call(rawFbq, k)) window.fbq[k] = rawFbq[k]; }
	}

	/* Eventos padronizados do site. Cada ação vai ao GA4 (gtag -> dataLayer,
	   entregue pela Google tag do GTM) e, quando tem par na Meta, ao Pixel e à
	   CAPI com o MESMO event_id (trackMetaEvent):
	     teste_paciente   -> Contact   (abre o WhatsApp de teste)
	     cta_trial_click  -> nada      ("Testar grátis" / "Começar 10 dias grátis")
	     form_start       -> nada      (abriu o formulário de avaliação)
	     form_step        -> nada      (etapa vista; parâmetro step 1 a 4)
	     generate_lead    -> Lead      (sai do avaliacao-form.js, com os dados do lead)
	   sign_up, begin_trial e purchase saem do app (app.aplia.com.br).
	   Nos botões: data-track="<evento>" e data-track-location="<onde>". */
	var META_PAIR = { teste_paciente: 'Contact' };
	var lastTracked = {};
	window.apliaTrack = function (name, params) {
		try {
			params = params || {};
			/* duplo clique / toque fantasma no celular não vira dois eventos */
			var now = Date.now();
			if (lastTracked[name] && now - lastTracked[name] < 800 && name !== 'form_step') return;
			lastTracked[name] = now;
			var g = window.gtag || function () { (window.dataLayer = window.dataLayer || []).push(arguments); };
			g('event', name, params);
			if (META_PAIR[name]) window.trackMetaEvent(META_PAIR[name], { customData: { content_name: name } });
		} catch (e) { }
	};
	document.addEventListener('click', function (e) {
		var el = e.target && e.target.closest && e.target.closest('[data-track]');
		if (!el) return;
		var loc = el.getAttribute('data-track-location') || '';
		/* event_label repete cta_location: relatórios antigos do GA4 usam event_label */
		window.apliaTrack(el.getAttribute('data-track'), loc ? { cta_location: loc, event_label: loc } : {});
	}, true);

	/* PageView: o fbq('track','PageView') está no <head> de cada página, antes
	   deste script, com um eventID guardado em window.__apliaPvId. O mesmo id vai
	   pelo servidor aqui; sem isso a Meta contaria o PageView em dobro. */
	document.addEventListener('DOMContentLoaded', function () {
		try { if (window.__apliaPvId) pushCapi('PageView', window.__apliaPvId, {}, undefined); } catch (e) { }
	});

	/* ViewContent em páginas de conteúdo (preços, funcionalidades, blog...). */
	document.addEventListener('DOMContentLoaded', function () {
		/* uma vez por página e por sessão da aba (reload/voltar não repete) */
		var key = 'meta_once:view:' + location.pathname;
		try {
			if (sessionStorage.getItem(key)) return;
			sessionStorage.setItem(key, '1');
		} catch (e) { }
		window.trackMetaEvent('ViewContent', { customData: { content_name: SAFE_PAGES[safePath()] || 'pagina' } });
	});
})();
