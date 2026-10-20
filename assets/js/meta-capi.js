/* Meta Pixel + API de Conversões (via GTM server-side).
   Espelho de aplia-web/src/lib/analytics.ts (trackMetaEvent): dispara o Pixel
   com eventID e empurra o MESMO evento (mesmo event_id) no dataLayer como
   `meta_capi`. O hash SHA-256 da PII, _fbp/_fbc, IP e user agent ficam no
   container server-side; o token da CAPI nunca passa por aqui.
   Ver aplia-web/docs/META-CAPI-GTM.md. */
(function () {
	var CONSENT_KEY = 'aplia_marketing_consent';
	var clean = function (v) { return v ? String(v).trim().toLowerCase() : undefined; };
	var norm = function (v) { return v ? String(v).trim().toLowerCase().replace(/\s+/g, '') || undefined : undefined; };
	// só dígitos com DDI; número BR sem DDI (10-11 dígitos) ganha 55
	var phone = function (v) {
		var d = v ? String(v).replace(/\D/g, '') : '';
		if (!d) return undefined;
		return (d.length === 10 || d.length === 11) ? '55' + d : d;
	};
	// AAAAMMDD (aceita AAAA-MM-DD, DD/MM/AAAA ou já normalizado)
	var birth = function (v) {
		var t = v ? String(v).trim() : '';
		var br = t.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
		if (br) return br[3] + br[2] + br[1];
		var d = t.replace(/\D/g, '');
		return d.length === 8 ? d : undefined;
	};
	var country = function (v) { return v && String(v).trim().length === 2 ? String(v).trim().toLowerCase() : undefined; };

	function hasConsent() {
		try { return localStorage.getItem(CONSENT_KEY) === 'granted'; } catch (e) { return false; }
	}

	window.setMarketingConsent = function (granted) {
		try { localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied'); } catch (e) { }
		(window.dataLayer = window.dataLayer || []).push({ event: 'consent_update', marketing_consent: !!granted });
	};

	function newId() {
		return (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
			: Date.now() + '-' + Math.random().toString(16).slice(2);
	}

	/* userData: {email, phone, firstName, lastName, gender, birthDate, city,
	   state, zip, country, externalId, subscriptionId} (sem hash). */
	window.trackMetaEvent = function (name, opts) {
		opts = opts || {};
		var customData = opts.customData || {};
		var u = opts.userData || {};
		var eventId = opts.eventId || newId();

		if (typeof window.fbq === 'function') {
			window.__metaRawFbq('track', name, customData, { eventID: eventId });
		}

		var pii = hasConsent() ? {
			em: clean(u.email), ph: phone(u.phone), fn: norm(u.firstName), ln: norm(u.lastName),
			ge: clean(u.gender), db: birth(u.birthDate), ct: norm(u.city), st: norm(u.state),
			zp: norm(u.zip), country: country(u.country)
		} : {};
		// não identificáveis: valem mesmo sem consentimento
		pii.external_id = u.externalId;
		pii.subscription_id = u.subscriptionId;

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
				user_data: pii
			}
		});
		return eventId;
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

	window.__metaRawFbq = window.fbq;
	if (typeof window.fbq === 'function') {
		var raw = window.fbq;
		window.fbq = function () {
			var a = arguments;
			var ret = raw.apply(this, a);
			if (a[0] === 'trackCustom' && CUSTOM_TO_STANDARD[a[1]]) {
				window.trackMetaEvent(CUSTOM_TO_STANDARD[a[1]], { customData: a[2] || {} });
			}
			return ret;
		};
		/* o objeto interno do Pixel (queue, loaded...) precisa continuar acessível */
		for (var k in raw) { if (Object.prototype.hasOwnProperty.call(raw, k)) window.fbq[k] = raw[k]; }
		window.__metaRawFbq = raw;
	}

	/* ViewContent em páginas de conteúdo (preços, funcionalidades, blog...). */
	document.addEventListener('DOMContentLoaded', function () {
		// uma vez por página e por sessão da aba (reload não repete)
		var key = 'meta_once:view:' + location.pathname;
		try {
			if (sessionStorage.getItem(key)) return;
			sessionStorage.setItem(key, '1');
		} catch (e) { }
		window.trackMetaEvent('ViewContent', { customData: { content_name: document.title } });
	});
})();
