/* Consentimento de marketing (LGPD): banner mínimo + cookie compartilhado.
   A escolha fica no cookie aplia_consent=granted|denied em .aplia.com.br
   (12 meses, SameSite=Lax, Secure), o mesmo do app (app.aplia.com.br): quem
   escolhe num lado não vê o banner no outro. Sem escolha = negado e banner
   visível. Espelho de aplia-web/src/lib/consent.ts. Carregar ANTES de
   meta-capi.js. */
(function () {
	var COOKIE = 'aplia_consent';
	var YEAR = 60 * 60 * 24 * 365;
	var FBC_MAX_AGE = 60 * 60 * 24 * 90;
	var AID_COOKIE = 'aplia_aid';

	var onAplia = /(^|\.)aplia\.com\.br$/.test(location.hostname);
	var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

	/* Domain=.aplia.com.br só em produção: em localhost o navegador rejeitaria
	   o cookie inteiro se o Domain não bater com o host. */
	function buildCookie(name, value, maxAge) {
		var p = [name + '=' + encodeURIComponent(value), 'path=/', 'max-age=' + maxAge, 'SameSite=Lax'];
		if (onAplia) p.push('domain=.aplia.com.br');
		if (location.protocol === 'https:' || isLocal) p.push('Secure');
		return p.join('; ');
	}
	function read(name) {
		try {
			var parts = document.cookie.split('; ');
			for (var i = 0; i < parts.length; i++) {
				if (parts[i].indexOf(name + '=') === 0) return decodeURIComponent(parts[i].slice(name.length + 1));
			}
		} catch (e) { }
		return undefined;
	}
	function write(name, value, maxAge) {
		try { document.cookie = buildCookie(name, value, maxAge); } catch (e) { }
	}
	function choice() {
		var v = read(COOKIE);
		return v === 'granted' || v === 'denied' ? v : null;
	}
	function announce() {
		try {
			(window.dataLayer = window.dataLayer || []).push({
				event: 'consent_update',
				marketing_consent: choice() === 'granted'
			});
		} catch (e) { }
	}

	/* ID anônimo persistente (UUID, cookie próprio, 90 dias, .aplia.com.br): vira o
	   external_id dos eventos de quem ainda não é lead nem usuário. Gravado sem
	   esperar o banner (decisão do negócio, divulgada no banner e na política). */
	function newUuid() {
		if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
		var b = new Uint8Array(16);
		if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(b);
		else for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
		b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
		var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
		return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
	}
	window.anonymousId = function () {
		var id = read(AID_COOKIE);
		if (!id) id = newUuid();
		write(AID_COOKIE, id, FBC_MAX_AGE); // renova os 90 dias a cada visita
		return id;
	};
	window.anonymousId();

	window.marketingConsentState = choice; // 'granted' | 'denied' | null (sem escolha)
	window.hasMarketingConsent = function () { return choice() === 'granted'; };
	window.setMarketingConsent = function (granted) {
		write(COOKIE, granted ? 'granted' : 'denied', YEAR);
		announce();
	};
	window.readCookie = read;

	/* Chegou por anúncio (?fbclid=): grava _fbc = fb.1.<timestamp_ms>.<fbclid> em
	   .aplia.com.br por 90 dias, pra LP e app dividirem o clique. Vale nos retornos
	   também: um fbclid novo (outro clique) substitui o antigo; o mesmo fbclid
	   mantém o timestamp original. Sem fbclid na URL, nunca apaga o _fbc. */
	try {
		var fbclid = new URLSearchParams(location.search).get('fbclid');
		var atual = (read('_fbc') || '').split('.').slice(3).join('.');
		if (fbclid && fbclid !== atual) write('_fbc', 'fb.1.' + Date.now() + '.' + fbclid, FBC_MAX_AGE);
	} catch (e) { }

	if (choice()) announce();

	function showBanner() {
		if (choice() !== null || document.getElementById('aplia-consent')) return;
		var css = document.createElement('style');
		css.textContent =
			'#aplia-consent{position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;max-width:760px;margin:0 auto;' +
			'background:#1a2641;color:#fff;border-radius:12px;padding:16px;box-shadow:0 8px 30px rgba(0,0,0,.3);' +
			'font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;flex-wrap:wrap;gap:12px;align-items:center}' +
			'#aplia-consent p{margin:0;flex:1 1 320px}#aplia-consent a{color:#fff;text-decoration:underline}' +
			'#aplia-consent .ac-btns{display:flex;gap:8px}' +
			'#aplia-consent button{cursor:pointer;border-radius:8px;padding:8px 16px;font:inherit;font-weight:600;border:1px solid #fff}' +
			'#aplia-consent .ac-no{background:transparent;color:#fff}#aplia-consent .ac-yes{background:#fff;color:#1a2641}';
		document.head.appendChild(css);

		var box = document.createElement('div');
		box.id = 'aplia-consent';
		box.setAttribute('role', 'dialog');
		box.setAttribute('aria-live', 'polite');
		box.setAttribute('aria-label', 'Aviso de cookies');
		box.innerHTML =
			'<p>Usamos cookies para medir o resultado dos nossos anúncios. Mesmo antes da sua escolha, ' +
			'identificadores do navegador (fbp, fbc e um ID anônimo) são usados para essa medição. ' +
			'E-mail e telefone só são enviados à Meta se você aceitar. ' +
			'Veja a <a href="/lgpd#cookies">política de privacidade</a>.</p>' +
			'<div class="ac-btns"><button type="button" class="ac-no">Recusar</button>' +
			'<button type="button" class="ac-yes">Aceitar</button></div>';
		function pick(granted) { window.setMarketingConsent(granted); box.remove(); css.remove(); }
		box.querySelector('.ac-no').addEventListener('click', function () { pick(false); });
		box.querySelector('.ac-yes').addEventListener('click', function () { pick(true); });
		document.body.appendChild(box);
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showBanner);
	else showBanner();
})();
