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

	window.hasMarketingConsent = function () { return choice() === 'granted'; };
	window.setMarketingConsent = function (granted) {
		write(COOKIE, granted ? 'granted' : 'denied', YEAR);
		announce();
	};
	window.readCookie = read;

	/* Chegou por anúncio (?fbclid=) e o Pixel ainda não gravou _fbc: grava
	   fb.1.<timestamp_ms>.<fbclid> em .aplia.com.br pra LP e app dividirem o clique. */
	try {
		var fbclid = new URLSearchParams(location.search).get('fbclid');
		if (fbclid && !read('_fbc')) write('_fbc', 'fb.1.' + Date.now() + '.' + fbclid, FBC_MAX_AGE);
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
			'<p>Usamos cookies para medir a performance dos nossos anúncios e melhorar sua experiência. ' +
			'Ao aceitar, compartilhamos dados de contato com a Meta para esse fim. ' +
			'Veja a <a href="/lgpd">política de privacidade</a>.</p>' +
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
