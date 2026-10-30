/* Atribuição do anúncio (UTMs e ids de clique). NÃO é carregado como arquivo:
   scripts/inline-head.py copia este conteúdo para dentro do <head> de cada
   página, ANTES do GTM e do Pixel, entre os marcadores aplia:head. Editou aqui?
   Rode `python3 scripts/inline-head.py` (o deploy também roda).

   1. Parâmetros que vieram depois do # (ex.: /#abrir-avaliacao?utm_source=meta,
      como nos anúncios antigos) vão para a query com history.replaceState,
      antes de o GA4 e o Pixel lerem a URL. Sem isso a sessão caía como
      l.facebook.com / referral ou (direct) e o fbclid se perdia.
   2. Guarda utm_*, fbclid, gclid, campaign_id, adset_id, ad_id e placement no
      cookie aplia_attr (.aplia.com.br, 90 dias; o app lê o mesmo cookie) e no
      sessionStorage. Visita direta nunca sobrescreve: só uma URL com
      parâmetros de campanha troca o que está guardado.
   3. Links para app.aplia.com.br levam esses parâmetros na query, para o
      cadastro e o trial ficarem atrelados ao anúncio.
   4. Consent Mode v2 (gtag 'consent' 'default') antes do GTM, a partir do
      cookie aplia_consent (consent.js manda o 'update' quando a pessoa escolhe).
      Mesma regra do Meta (ver consent.js): armazenamento de medição sempre;
      dados do usuário e personalização de anúncios só com "Aceitar".
   window.apliaAttribution() devolve o objeto guardado ({} se não houver). */
(function () {
	try {
		window.dataLayer = window.dataLayer || [];
		/* gtag só reconhece o objeto arguments, não um array */
		var g = function () { window.dataLayer.push(arguments); };
		var aceito = /(?:^|; )aplia_consent=granted(?:;|$)/.test(document.cookie) ? 'granted' : 'denied';
		g('consent', 'default', {
			ad_storage: 'granted',
			analytics_storage: 'granted',
			ad_user_data: aceito,
			ad_personalization: aceito
		});
	} catch (e) { }
})();
(function () {
	var KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id',
		'fbclid', 'gclid', 'gbraid', 'wbraid', 'campaign_id', 'adset_id', 'ad_id', 'placement'];
	var COOKIE = 'aplia_attr';
	var MAX_AGE = 90 * 24 * 3600;
	var isKey = function (k) { return KEYS.indexOf(k) !== -1; };

	try {
		/* 1. hash -> query */
		var hash = location.hash.slice(1);
		var cut = hash.search(/[?&]/);
		var anchor = hash, hashQuery = '';
		if (cut !== -1) { anchor = hash.slice(0, cut); hashQuery = hash.slice(cut + 1); }
		else if (/^[\w-]+=/.test(hash)) { anchor = ''; hashQuery = hash; }
		if (hashQuery) {
			var fromHash = new URLSearchParams(hashQuery);
			var moved = false;
			var query = new URLSearchParams(location.search);
			fromHash.forEach(function (v, k) {
				if (isKey(k) && !query.has(k)) { query.set(k, v); moved = true; }
			});
			if (moved) {
				var qs = query.toString();
				history.replaceState(history.state, '', location.pathname + (qs ? '?' + qs : '') + (anchor ? '#' + anchor : ''));
			}
		}
	} catch (e) { }

	function readCookie() {
		try {
			var m = document.cookie.match(/(?:^|; )aplia_attr=([^;]*)/);
			return m ? JSON.parse(decodeURIComponent(m[1])) : null;
		} catch (e) { return null; }
	}

	var stored = null;
	try { stored = JSON.parse(sessionStorage.getItem(COOKIE) || 'null'); } catch (e) { }
	if (!stored) stored = readCookie();

	try {
		/* 2. guarda o toque de campanha */
		var params = new URLSearchParams(location.search);
		var touch = {}, has = false;
		KEYS.forEach(function (k) {
			var v = params.get(k);
			if (v) { touch[k] = v.slice(0, 150); has = true; }
		});
		if (has) {
			touch.landing_page = location.pathname;
			try {
				var ref = document.referrer && new URL(document.referrer).hostname;
				if (ref && ref !== location.hostname) touch.referrer = ref;
			} catch (e) { }
			touch.ts = Date.now();
			stored = touch;
			var parts = [COOKIE + '=' + encodeURIComponent(JSON.stringify(touch)), 'path=/', 'max-age=' + MAX_AGE, 'SameSite=Lax'];
			if (/(^|\.)aplia\.com\.br$/.test(location.hostname)) parts.push('domain=.aplia.com.br');
			if (location.protocol === 'https:') parts.push('Secure');
			document.cookie = parts.join('; ');
		}
		if (stored) sessionStorage.setItem(COOKIE, JSON.stringify(stored));
	} catch (e) { }

	window.apliaAttribution = function () {
		var out = {};
		if (stored) for (var k in stored) out[k] = stored[k];
		return out;
	};

	/* 3. links para o app levam os parâmetros (só os que o link ainda não tem) */
	function decorate(a) {
		try {
			if (!stored || !a.href || a.hostname !== 'app.aplia.com.br') return;
			var url = new URL(a.href);
			KEYS.forEach(function (k) {
				if (stored[k] && !url.searchParams.has(k)) url.searchParams.set(k, stored[k]);
			});
			a.href = url.toString();
		} catch (e) { }
	}
	function decorateAll() {
		var links = document.querySelectorAll('a[href*="app.aplia.com.br"]');
		for (var i = 0; i < links.length; i++) decorate(links[i]);
	}
	document.addEventListener('click', function (e) {
		var a = e.target && e.target.closest && e.target.closest('a[href*="app.aplia.com.br"]');
		if (a) decorate(a);
	}, true);
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', decorateAll);
	else decorateAll();
})();
