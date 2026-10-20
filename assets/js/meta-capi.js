/* Meta Pixel + API de Conversões (via GTM server-side).
   Espelho de aplia-web/src/lib/analytics.ts (trackMetaEvent): dispara o Pixel
   com eventID e empurra o MESMO evento (mesmo event_id) no dataLayer como
   `meta_capi`. O hash SHA-256 da PII, IP e user agent ficam no container
   server-side; o token da CAPI nunca passa por aqui.
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

	function hasConsent() {
		return typeof window.hasMarketingConsent === 'function' && window.hasMarketingConsent();
	}
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

			var consent = hasConsent();
			var ud = pick({
				em: consent ? clean(u.email) : undefined,
				ph: consent ? phone(u.phone) : undefined,
				fn: consent ? norm(u.firstName) : undefined,
				ln: consent ? norm(u.lastName) : undefined,
				ge: consent ? clean(u.gender) : undefined,
				db: consent ? birth(u.birthDate) : undefined,
				ct: consent ? norm(u.city) : undefined,
				st: consent ? norm(u.state) : undefined,
				zp: consent ? norm(u.zip) : undefined,
				country: consent ? country(u.country) : undefined,
				fbp: consent ? cookie('_fbp') : undefined,
				fbc: consent ? cookie('_fbc') : undefined,
				external_id: u.externalId,
				subscription_id: u.subscriptionId
			}, USER_DATA_ALLOWED);

			var hasMoney = customData.value !== undefined || customData.currency !== undefined;
			(window.dataLayer = window.dataLayer || []).push({
				event: 'meta_capi',
				meta: {
					event_name: name,
					event_id: eventId,
					event_time: Math.floor(Date.now() / 1000),
					event_source_url: location.href,
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
	var CUSTOM_TO_STANDARD = {
		ClickComecar: 'InitiateCheckout',
		EscolherPlanoEssencial: 'AddToCart',
		EscolherPlanoProfissional: 'AddToCart',
		TestePaciente: 'Lead',
		FalarConsultorEnterprise: 'Lead',
		FaleConosco: 'Contact',
		ClickConhecerAplia: 'ViewContent'
	};

	if (typeof rawFbq === 'function') {
		var lastFired = {};
		window.fbq = function () {
			var a = arguments;
			var ret = rawFbq.apply(this, a);
			try {
				if (a[0] === 'trackCustom' && CUSTOM_TO_STANDARD[a[1]]) {
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
		window.trackMetaEvent('ViewContent', { customData: { content_name: document.title } });
	});
})();
