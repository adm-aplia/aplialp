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
		/* Consent Mode v2: o 'default' sai do head.js, antes do GTM */
		try {
			(function () { (window.dataLayer = window.dataLayer || []).push(arguments); })('consent', 'update', {
				ad_user_data: granted ? 'granted' : 'denied',
				ad_personalization: granted ? 'granted' : 'denied'
			});
		} catch (e) { }
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

	/* Banner compacto preso embaixo. A altura dele vai para --consent-h no <html>
	   e para o padding do <body>: o botão fixo do celular (/avaliacao) sobe junto
	   e o fim da página não fica escondido atrás do aviso. */
	function showBanner() {
		if (choice() !== null || document.getElementById('aplia-consent')) return;
		var css = document.createElement('style');
		css.textContent =
			'#aplia-consent{position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483000;max-width:720px;margin:0 auto;' +
			'background:#1a2641;color:#fff;border-radius:12px;padding:10px 12px;box-shadow:0 6px 24px rgba(0,0,0,.25);' +
			'font:13px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;gap:10px;align-items:center}' +
			'#aplia-consent p{margin:0;flex:1 1 auto;min-width:0;color:#fff;font:inherit;opacity:1}#aplia-consent a{color:#fff;text-decoration:underline}' +
			'#aplia-consent .ac-btns{display:flex;gap:6px;flex:none}' +
			'#aplia-consent button{cursor:pointer;border-radius:8px;padding:8px 12px;min-height:40px;font:inherit;font-weight:600;border:1px solid #fff}' +
			'#aplia-consent .ac-no{background:transparent;color:#fff}#aplia-consent .ac-yes{background:#fff;color:#1a2641}' +
			'@media (max-width:480px){#aplia-consent{font-size:12px;padding:8px 10px;gap:8px}#aplia-consent .ac-btns{flex-direction:column}' +
			'#aplia-consent button{padding:6px 10px;min-height:34px}}';
		document.head.appendChild(css);

		var box = document.createElement('div');
		box.id = 'aplia-consent';
		box.setAttribute('role', 'region');
		box.setAttribute('aria-label', 'Aviso de cookies');
		box.innerHTML =
			'<p>Usamos cookies e identificadores do navegador (fbp, fbc e um ID anônimo) para medir nossos anúncios, ' +
			'mesmo antes da sua escolha. E-mail e telefone só vão à Meta se você aceitar. ' +
			'<a href="/lgpd#cookies">Saiba mais</a></p>' +
			'<div class="ac-btns"><button type="button" class="ac-yes">Aceitar</button>' +
			'<button type="button" class="ac-no">Recusar</button></div>';
		var root = document.documentElement;
		var bodyPad = document.body.style.paddingBottom;
		function reserve() {
			var h = box.offsetHeight + 16;
			root.style.setProperty('--consent-h', h + 'px');
			document.body.style.paddingBottom = h + 'px';
		}
		function pick(granted) {
			window.setMarketingConsent(granted);
			box.remove(); css.remove();
			root.style.removeProperty('--consent-h');
			document.body.style.paddingBottom = bodyPad;
			window.removeEventListener('resize', reserve);
		}
		box.querySelector('.ac-no').addEventListener('click', function () { pick(false); });
		box.querySelector('.ac-yes').addEventListener('click', function () { pick(true); });
		document.body.appendChild(box);
		reserve();
		window.addEventListener('resize', reserve);
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showBanner);
	else showBanner();
})();
