/* Meta Pixel + API de Conversões (via GTM server-side).
   Espelho de aplia-web/src/lib/analytics.ts (trackMetaEvent): dispara o Pixel
   com eventID e empurra o MESMO evento (mesmo event_id) no dataLayer como
   `meta_capi`. O hash SHA-256 da PII, _fbp/_fbc, IP e user agent ficam no
   container server-side; o token da CAPI nunca passa por aqui.
   Ver aplia-web/docs/META-CAPI-GTM.md. */
(function () {
	var CONSENT_KEY = 'aplia_marketing_consent';
	var norm = function (v) { return v ? String(v).trim().toLowerCase() : undefined; };
	var digits = function (v) { return v ? String(v).replace(/\D/g, '') || undefined : undefined; };

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

		var consent = hasConsent();
		var pii = consent ? {
			em: norm(u.email), ph: digits(u.phone), fn: norm(u.firstName), ln: norm(u.lastName),
			ge: norm(u.gender), db: digits(u.birthDate),
			ct: norm(u.city) && norm(u.city).replace(/\s+/g, ''), st: norm(u.state),
			zp: norm(u.zip) && norm(u.zip).replace(/\s+/g, ''), country: norm(u.country),
			external_id: u.externalId
		} : {};
		pii.subscription_id = u.subscriptionId;

		(window.dataLayer = window.dataLayer || []).push({
			event: 'meta_capi',
			meta: {
				event_name: name,
				event_id: eventId,
				event_time: Math.floor(Date.now() / 1000),
				event_source_url: location.href,
				action_source: 'website',
				opt_out: false,
				data_processing_options: [],
				data_processing_options_country: 0,
				data_processing_options_state: 0,
				custom_data: name === 'Purchase' ? { value: customData.value, currency: customData.currency } : undefined,
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
		TestePaciente: 'Contact',
		FaleConosco: 'Contact',
		FalarConsultorEnterprise: 'Contact',
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
		window.trackMetaEvent('ViewContent', { customData: { content_name: document.title } });
	});
})();
