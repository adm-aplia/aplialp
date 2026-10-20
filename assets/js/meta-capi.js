/* Meta Pixel + API de Conversões (via GTM server-side).
   Espelho de aplia-web/src/lib/analytics.ts (trackMetaEvent): dispara o Pixel
   com eventID e empurra o MESMO evento (mesmo event_id) no dataLayer como
   `meta_capi`. O hash SHA-256 da PII, IP e user agent ficam no container
   server-side; o token da CAPI nunca passa por aqui.
   Consentimento (LGPD): evento anônimo (id, hora, URL, valor/moeda) sai sempre.
   Dados pessoais só com aplia_consent=granted; sem escolha vai só fbp/fbc;
   com denied nada identificável. Lido a cada evento, então vale na hora, sem
   recarregar. Nada que indique saúde vai ao Meta (URL e nomes neutros).
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

	function consentState() {
		return typeof window.marketingConsentState === 'function' ? window.marketingConsentState() : null;
	}

	/* Só caminhos neutros vão como event_source_url / content_name. Posts do blog
	   viram /blog (o slug pode citar paciente/tema de saúde); qualquer outro
	   caminho vira a raiz. Sem querystring nem hash (utm, fbclid, etc.). */
	var SAFE_PAGES = {
		'/': 'home', '/precos': 'precos', '/funcionalidades': 'funcionalidades',
		'/integracoes': 'integracoes', '/lgpd': 'lgpd', '/blog': 'blog',
		'/secretaria-virtual-ia': 'secretaria_virtual', '/agendamento-whatsapp': 'agendamento_whatsapp'
	};
	function safePath() {
		var path = (location.pathname || '/').replace(/\/index\.html$/, '/').replace(/\.html$/, '');
		if (path.length > 1) path = path.replace(/\/+$/, '');
		if (path.indexOf('/blog/') === 0) path = '/blog';
		return SAFE_PAGES[path] ? path : '/';
	}
	function safeUrl() { return location.origin + safePath(); }
	function cookie(name) {
		return typeof window.readCookie === 'function' ? window.readCookie(name) : undefined;
	}
	function newId() {
		return (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
			: Date.now() + '-' + Math.random().toString(16).slice(2);
	}

	var rawFbq = window.fbq;

	/* userData: {email, phone, firstName, lastName, gender, birthDate, city,
	   state, zip, country, externalId, subscriptionId} (sem hash). Nunca lança. */
	window.trackMetaEvent = function (name, opts) {
		try {
			if (BLOCKED[name]) return '';
			opts = opts || {};
			var customData = pick(opts.customData, CUSTOM_DATA_ALLOWED);
			var u = opts.userData || {};
			var eventId = opts.eventId || newId();

			if (typeof rawFbq === 'function') rawFbq('track', name, customData, { eventID: eventId });

			/* granted: tudo; sem escolha: só fbp/fbc; denied: nada identificável */
			var state = consentState();
			var ud = {};
			if (state === 'granted') {
				ud = pick({
					em: clean(u.email), ph: phone(u.phone), fn: norm(u.firstName), ln: norm(u.lastName),
					ge: clean(u.gender), db: birth(u.birthDate), ct: norm(u.city), st: norm(u.state),
					zp: norm(u.zip), country: country(u.country),
					external_id: u.externalId, subscription_id: u.subscriptionId,
					fbp: cookie('_fbp'), fbc: cookie('_fbc')
				}, USER_DATA_ALLOWED);
			} else if (state === null) {
				ud = pick({ fbp: cookie('_fbp'), fbc: cookie('_fbc') }, USER_DATA_ALLOWED);
			}

			var hasMoney = customData.value !== undefined || customData.currency !== undefined;
			(window.dataLayer = window.dataLayer || []).push({
				event: 'meta_capi',
				meta: {
					event_name: name,
					event_id: eventId,
					event_time: Math.floor(Date.now() / 1000),
					event_source_url: safeUrl(),
					action_source: 'website',
					custom_data: hasMoney ? { value: customData.value, currency: customData.currency } : undefined,
					user_data: ud
				}
			});
			return eventId;
		} catch (e) {
			return '';
		}
	};

	/* Os cliques já chamam fbq('trackCustom', '<Nome>') nos onclick. Em vez de
	   reescrever cada botão, cada nome custom é traduzido pro evento padrão
	   equivalente e enviado também pela CAPI. */
	/* Botões que só abrem o modal (AbrirAvaliacao, AbrirAvaliacaoEnterprise) não
	   estão aqui de propósito: não geram Lead nem Contact. O Lead real é o envio
	   do formulário, depois da resposta OK do webhook (index.html). */
	var CUSTOM_TO_STANDARD = {
		ClickComecar: 'InitiateCheckout',
		EscolherPlanoEssencial: 'AddToCart',
		EscolherPlanoProfissional: 'AddToCart',
		TesteDemo: 'Contact',
		FaleConosco: 'Contact',
		ClickConhecerAplia: 'ViewContent'
	};

	/* Só vale clique de verdade do usuário (isTrusted) nos últimos 1,5s: nada de
	   evento disparado por script ou ao carregar a página. */
	var lastTrustedClick = 0;
	document.addEventListener('click', function (e) { if (e.isTrusted) lastTrustedClick = Date.now(); }, true);

	if (typeof rawFbq === 'function') {
		var lastFired = {};
		window.fbq = function () {
			var a = arguments;
			var ret = rawFbq.apply(this, a);
			try {
				if (a[0] === 'trackCustom' && CUSTOM_TO_STANDARD[a[1]] && Date.now() - lastTrustedClick < 1500) {
					/* duplo clique no mesmo botão = uma ação só */
					var now = Date.now();
					if (!lastFired[a[1]] || now - lastFired[a[1]] > 1000) {
						lastFired[a[1]] = now;
						window.trackMetaEvent(CUSTOM_TO_STANDARD[a[1]], { customData: a[2] || {} });
					}
				}
			} catch (e) { }
			return ret;
		};
		/* o objeto interno do Pixel (queue, loaded...) precisa continuar acessível */
		for (var k in rawFbq) { if (Object.prototype.hasOwnProperty.call(rawFbq, k)) window.fbq[k] = rawFbq[k]; }
	}

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
