/* Formulário "Avaliação da sua operação" em 4 etapas.
   Usado na home, em /avaliacao, em preços e em integrações. Monta o próprio
   modal (não precisa de marcação na página) e só abre no clique em
   .js-open-consultor-modal, [data-open-avaliacao] ou num link que termine em
   #abrir-avaliacao. Nunca abre sozinho ao carregar a página.

   Ordem: perguntas sobre a clínica primeiro (fáceis, geram interesse) e o
   contato por último. Assim que nome e WhatsApp estão válidos, o lead é
   guardado como "parcial" (10 s depois, ou na hora se a pessoa sair da página);
   ao concluir, o mesmo lead_id vira "completo".

   Eventos (window.apliaTrack, em meta-capi.js): form_start ao abrir, form_step
   com step 1-4 na primeira vez que cada etapa aparece, generate_lead + Lead
   (Pixel e CAPI com o mesmo event_id) ao concluir.
   Depende de head.js (window.apliaAttribution) e meta-capi.js; sem eles o
   formulário funciona, só sem atribuição/rastreamento. */
(function () {
	var ENDPOINT = 'https://vmqxzkukyfxxgxekkdem.supabase.co/functions/v1/lead-avaliacao';
	var DEMO_WHATSAPP = '551151973902';  // IA de teste (atende como uma clínica)
	var SALES_WHATSAPP = '551148635695'; // equipe da Aplia
	var PRAZO_RETORNO = 'em até 1 dia útil';
	var PARCIAL_APOS_MS = 10000;
	var TOTAL = 4;
	var ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id',
		'fbclid', 'gclid', 'campaign_id', 'adset_id', 'ad_id', 'placement', 'landing_page', 'referrer'];

	var ICON = {
		check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
		arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
		wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.39a9.86 9.86 0 004.74 1.21h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7A9.82 9.82 0 0012.04 2zm5.8 14.14c-.25.69-1.44 1.32-1.99 1.37-.53.05-1.02.24-3.45-.72-2.9-1.14-4.74-4.1-4.88-4.29-.14-.19-1.16-1.55-1.16-2.95 0-1.4.73-2.09.99-2.37.26-.29.57-.36.76-.36l.54.01c.17 0 .41-.07.64.49.24.58.8 2 .87 2.15.07.14.12.31.02.5-.1.19-.14.31-.29.48l-.43.5c-.14.14-.29.3-.12.59.17.29.74 1.23 1.6 1.99 1.1.98 2.03 1.29 2.32 1.43.29.15.46.12.63-.07.17-.19.73-.85.92-1.15.19-.29.39-.24.65-.14.26.09 1.67.79 1.96.93.29.14.48.22.55.34.07.12.07.69-.18 1.37z"/></svg>'
	};

	function card(type, name, value, title, desc) {
		return '<label class="av-card"><input type="' + type + '" name="' + name + '" value="' + value + '">' +
			'<span class="av-mark">' + ICON.check + '</span><span class="av-card-body">' +
			'<span class="av-card-title">' + title + '</span>' +
			(desc ? '<span class="av-card-desc">' + desc + '</span>' : '') + '</span></label>';
	}

	function actions(step, last) {
		return '<div class="av-actions">' +
			(step > 1 ? '<button type="button" class="av-btn av-back" data-av-back>Voltar</button>' : '') +
			(last
				? '<button type="submit" class="av-btn av-primary">Concluir avaliação ' + ICON.check + '</button>'
				: '<button type="button" class="av-btn av-primary" data-av-next>Continuar ' + ICON.arrow + '</button>') +
			'</div>';
	}

	var MARKUP =
		'<div class="av-backdrop" data-av-close></div>' +
		'<div class="av-shell" role="dialog" aria-modal="true" aria-labelledby="av-title-1">' +
		'<button type="button" class="av-close" data-av-close aria-label="Fechar formulário">&times;</button>' +
		'<form class="av-form" novalidate>' +
		'<div class="av-top"><span class="av-badge">Avaliação da sua operação</span><span class="av-count" aria-live="polite">Etapa 1 de 4</span></div>' +
		'<div class="av-progress" role="progressbar" aria-valuemin="1" aria-valuemax="4" aria-valuenow="1"><span></span></div>' +

		'<div class="av-step" data-step="1"><h3 id="av-title-1">Quantos pacientes você atende por mês?</h3>' +
		'<p class="av-help">Leva menos de um minuto. São 4 perguntas.</p><div class="av-options" role="radiogroup" aria-labelledby="av-title-1">' +
		card('radio', 'whatsapp_volume', 'Até 50 pacientes/mês', 'Até 50 por mês', 'Consultório individual ou começando') +
		card('radio', 'whatsapp_volume', 'Entre 50 e 100 pacientes/mês', 'Entre 50 e 100 por mês', 'Agenda ativa, em crescimento') +
		card('radio', 'whatsapp_volume', 'Mais de 100 pacientes/mês', 'Mais de 100 por mês', 'Vários profissionais ou especialidades') +
		'</div>' + actions(1) + '</div>' +

		'<div class="av-step" data-step="2" hidden><h3 id="av-title-2">Quem responde o WhatsApp do consultório hoje?</h3>' +
		'<p class="av-help">Assim entendemos onde a Aplia entra.</p><div class="av-options" role="radiogroup" aria-labelledby="av-title-2">' +
		card('radio', 'whatsapp_responsible', 'Eu mesmo(a)', 'Eu mesmo(a)', 'Respondo entre um paciente e outro') +
		card('radio', 'whatsapp_responsible', 'Minha secretária', 'Secretária ou recepção', 'Uma pessoa cuida do número') +
		card('radio', 'whatsapp_responsible', 'Equipe comercial', 'Equipe de atendimento', 'Time dedicado a agendamentos') +
		card('radio', 'whatsapp_responsible', 'Ninguém consistente', 'Ninguém fixo', 'As mensagens acumulam e demoram') +
		'</div>' + actions(2) + '</div>' +

		'<div class="av-step" data-step="3" hidden><h3 id="av-title-3">O que mais pesa hoje?</h3>' +
		'<p class="av-help">Pode marcar mais de uma.</p><div class="av-options" role="group" aria-labelledby="av-title-3">' +
		card('checkbox', 'main_pain', 'Fora do horário comercial', 'Paciente sem resposta à noite e no fim de semana') +
		card('checkbox', 'main_pain', 'Recepção sobrecarregada', 'Recepção sobrecarregada', 'Muita pergunta repetida no WhatsApp') +
		card('checkbox', 'main_pain', 'Tráfego sem agilidade', 'Demora para responder quem vem do anúncio') +
		card('checkbox', 'main_pain', 'Secretária não atende bem', 'Atendimento sem padrão', 'Conversas que não viram consulta') +
		'</div>' + actions(3) + '</div>' +

		'<div class="av-step" data-step="4" hidden><h3 id="av-title-4">Para onde mandamos a sua avaliação?</h3>' +
		'<p class="av-help">Vamos te chamar no WhatsApp. Sem spam.</p>' +
		'<label class="av-field"><span>Seu nome</span><input type="text" name="name" autocomplete="name" autocapitalize="words" enterkeyhint="next" placeholder="Como podemos te chamar?" maxlength="120"></label>' +
		'<label class="av-field"><span>WhatsApp com DDD</span><input type="tel" name="whatsapp" inputmode="tel" autocomplete="tel-national" enterkeyhint="next" placeholder="(11) 99999-9999" maxlength="16"></label>' +
		'<label class="av-field"><span>E-mail <small>(opcional)</small></span><input type="email" name="email" inputmode="email" autocomplete="email" autocapitalize="off" enterkeyhint="send" placeholder="voce@clinica.com.br" maxlength="160"></label>' +
		actions(4, true) + '</div>' +

		'<p class="av-feedback" role="alert" aria-live="assertive"></p>' +
		'<p class="av-privacy">Usamos seus dados só para falar com você sobre esta avaliação. Se você aceitar o aviso de cookies, e-mail e telefone também vão à Meta para medir nossos anúncios.</p>' +
		'<div class="av-hidden"></div>' +
		'</form></div>';

	var modal, form, feedback, countEl, bar, lastFocus;
	var current = 1, seen = {}, leadId = null, partialTimer = null, partialSent = false, submitted = false;
	var openedFrom = '';

	function newId() {
		return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2);
	}
	function track(name, params) {
		try { if (typeof window.apliaTrack === 'function') window.apliaTrack(name, params); } catch (e) { }
	}
	function attribution() {
		try { return typeof window.apliaAttribution === 'function' ? window.apliaAttribution() : {}; } catch (e) { return {}; }
	}
	function field(name) { return form.querySelector('[name="' + name + '"]'); }
	function digits(v) { return String(v || '').replace(/\D/g, ''); }

	/* DDD de 11 a 99; celular com 11 dígitos começa com 9; fixo com 10 */
	function phoneOk(v) {
		var d = digits(v);
		if (d.length === 13 && d.slice(0, 2) === '55') d = d.slice(2);
		if (!/^[1-9][1-9]/.test(d)) return false;
		return d.length === 10 || (d.length === 11 && d.charAt(2) === '9');
	}
	function nameOk() { return field('name').value.trim().length >= 2; }
	function emailOk() {
		var v = field('email').value.trim();
		return !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
	}

	function setFeedback(msg, input) {
		feedback.textContent = msg || '';
		feedback.classList.toggle('is-visible', !!msg);
		form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
		if (input) { input.setAttribute('aria-invalid', 'true'); input.focus(); }
	}

	function goTo(step) {
		current = step;
		setFeedback('');
		form.querySelectorAll('.av-step').forEach(function (el) {
			el.hidden = Number(el.getAttribute('data-step')) !== step;
		});
		bar.style.width = (step / TOTAL * 100) + '%';
		bar.parentNode.setAttribute('aria-valuenow', String(step));
		countEl.textContent = 'Etapa ' + step + ' de ' + TOTAL;
		modal.querySelector('.av-shell').setAttribute('aria-labelledby', 'av-title-' + step);
		modal.querySelector('.av-shell').scrollTop = 0;
		if (!seen[step]) { seen[step] = true; track('form_step', { form_id: 'avaliacao', step: step }); }
		if (step === 4) setTimeout(function () { field('name').focus(); }, 120);
	}

	function validate(step) {
		if (step === 1 && !form.querySelector('[name="whatsapp_volume"]:checked')) return setFeedback('Escolha uma opção para continuar.'), false;
		if (step === 2 && !form.querySelector('[name="whatsapp_responsible"]:checked')) return setFeedback('Escolha uma opção para continuar.'), false;
		if (step === 3 && !form.querySelector('[name="main_pain"]:checked')) return setFeedback('Marque pelo menos uma opção.'), false;
		if (step === 4) {
			if (!nameOk()) return setFeedback('Digite seu nome.', field('name')), false;
			if (!phoneOk(field('whatsapp').value)) return setFeedback('Confira o WhatsApp: DDD e número, ex.: (11) 99999-9999.', field('whatsapp')), false;
			if (!emailOk()) return setFeedback('Confira o e-mail ou deixe em branco.', field('email')), false;
		}
		return true;
	}

	function payload(status) {
		var a = attribution();
		var hidden = {};
		form.querySelectorAll('.av-hidden input').forEach(function (i) { if (i.value) hidden[i.name] = i.value; });
		for (var k in hidden) if (!a[k]) a[k] = hidden[k];
		var meta = {
			submitted_at: new Date().toISOString(),
			page_url: location.origin + location.pathname,
			referrer: document.referrer || '',
			cta_location: openedFrom
		};
		ATTR_KEYS.forEach(function (key) { meta[key] = a[key] || ''; });
		return {
			lead_id: leadId,
			status: status,
			name: field('name').value.trim(),
			email: field('email').value.trim(),
			whatsapp: field('whatsapp').value.trim(),
			whatsapp_volume: (form.querySelector('[name="whatsapp_volume"]:checked') || {}).value || '',
			whatsapp_responsible: (form.querySelector('[name="whatsapp_responsible"]:checked') || {}).value || '',
			main_pains: Array.prototype.map.call(form.querySelectorAll('[name="main_pain"]:checked'), function (c) { return c.value; }),
			metadata: meta
		};
	}

	function send(status) {
		try {
			return fetch(ENDPOINT, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
				body: JSON.stringify(payload(status)),
				keepalive: true
			}).then(function (r) {
				if (!r.ok) console.warn('lead-avaliacao respondeu', r.status);
			}).catch(function (err) { console.warn('lead-avaliacao não respondeu:', err); });
		} catch (e) { console.warn('Aviso ao enviar o lead:', e); }
	}

	/* Lead parcial: nome e WhatsApp válidos, mas sem concluir */
	function sendPartial() {
		clearTimeout(partialTimer);
		partialTimer = null;
		if (submitted || partialSent || !nameOk() || !phoneOk(field('whatsapp').value)) return;
		partialSent = true;
		send('parcial');
	}
	function schedulePartial() {
		if (submitted || partialSent) return;
		clearTimeout(partialTimer);
		if (nameOk() && phoneOk(field('whatsapp').value)) partialTimer = setTimeout(sendPartial, PARCIAL_APOS_MS);
	}

	function trackLead(p) {
		var high = p.whatsapp_volume === 'Mais de 100 pacientes/mês';
		var a = attribution();
		track('generate_lead', {
			form_id: 'avaliacao',
			lead_volume: high ? 'volume_alto' : 'volume_padrao',
			cta_location: openedFrom,
			lead_source: a.utm_source || '',
			lead_medium: a.utm_medium || '',
			lead_campaign: a.utm_campaign || ''
		});
		if (typeof window.trackMetaEvent === 'function') {
			var parts = p.name.split(/\s+/);
			var user = { email: p.email, phone: p.whatsapp, firstName: parts[0], lastName: parts.slice(1).join(' '), country: 'br', externalId: leadId };
			window.trackMetaEvent('Lead', {
				customData: { content_name: 'Avaliação da Operação', value: high ? 499 : 249, currency: 'BRL' },
				userData: user
			});
			if (typeof window.rememberLead === 'function') window.rememberLead(user);
		}
	}

	function done(p) {
		var first = p.name.split(/\s+/)[0];
		var consultorMsg = 'Olá! Me chamo ' + p.name + '. Acabei de preencher a avaliação no site da Aplia.\n\n' +
			'• Pacientes/mês: ' + p.whatsapp_volume + '\n• Quem atende hoje: ' + p.whatsapp_responsible + '\n' +
			'• O que mais pesa: ' + p.main_pains.join(', ');
		var demoMsg = 'olá gostaria de marcar uma consulta';
		var box = document.createElement('div');
		box.className = 'av-done';
		box.innerHTML =
			'<div class="av-done-icon">' + ICON.check + '</div>' +
			'<h3 tabindex="-1"></h3>' +
			'<p><span class="av-next">Vamos te chamar no WhatsApp ' + PRAZO_RETORNO + '</span>, no número que você informou, para mostrar como a Aplia funcionaria na sua clínica.</p>' +
			'<p>Enquanto isso, veja como seu paciente seria atendido: mande uma mensagem como se fosse ele.</p>' +
			'<div class="av-done-actions">' +
			'<a class="av-btn av-primary" target="_blank" rel="noopener" data-track="teste_paciente" data-track-location="form_obrigado" href="https://wa.me/' + DEMO_WHATSAPP + '?text=' + encodeURIComponent(demoMsg) + '">Testar como paciente ' + ICON.wa + '</a>' +
			'<a class="av-btn av-secondary" target="_blank" rel="noopener" data-track="fale_conosco" data-track-location="form_obrigado" href="https://wa.me/' + SALES_WHATSAPP + '?text=' + encodeURIComponent(consultorMsg) + '">Falar com a equipe agora</a>' +
			'</div>';
		box.querySelector('h3').textContent = 'Recebido, ' + first + '!';
		form.replaceWith(box);
		modal.querySelector('.av-shell').setAttribute('aria-labelledby', '');
		box.querySelector('h3').focus();
	}

	function submit(e) {
		e.preventDefault();
		if (submitted) return;
		if (current < TOTAL) { next(); return; }
		if (!validate(4)) return;
		submitted = true;
		clearTimeout(partialTimer);
		form.querySelector('[type="submit"]').disabled = true;
		var p = payload('completo');
		send('completo');
		/* rastreamento depois do envio: um erro aqui nunca impede o lead de chegar */
		try { trackLead(p); } catch (err) { console.warn('Aviso no rastreamento do Lead:', err); }
		done(p);
	}

	function next() { if (validate(current)) goTo(current + 1); }

	function maskPhone(e) {
		var d = digits(e.target.value);
		if (d.length > 11 && d.slice(0, 2) === '55') d = d.slice(2);
		d = d.slice(0, 11);
		var v = d;
		if (d.length > 10) v = '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
		else if (d.length > 6) v = '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
		else if (d.length > 2) v = '(' + d.slice(0, 2) + ') ' + d.slice(2);
		else if (d.length) v = '(' + d;
		e.target.value = v;
	}

	/* Área visível real (com o teclado aberto) para o cartão não ficar atrás dele */
	function syncViewport() {
		var vv = window.visualViewport;
		if (vv && modal) modal.style.setProperty('--av-vh', vv.height + 'px');
	}

	function fillHidden() {
		var a = attribution();
		var box = form.querySelector('.av-hidden');
		box.innerHTML = '';
		ATTR_KEYS.forEach(function (k) {
			var i = document.createElement('input');
			i.type = 'hidden'; i.name = k; i.value = a[k] || '';
			box.appendChild(i);
		});
	}

	function build() {
		if (!document.querySelector('link[data-av-css]')) {
			var css = document.createElement('link');
			css.rel = 'stylesheet';
			css.href = '/assets/css/avaliacao-form.css';
			css.setAttribute('data-av-css', '');
			document.head.appendChild(css);
		}
		modal = document.createElement('div');
		modal.className = 'av-modal';
		modal.id = 'avaliacaoModal';
		modal.setAttribute('aria-hidden', 'true');
		modal.innerHTML = MARKUP;
		document.body.appendChild(modal);
		form = modal.querySelector('form');
		feedback = modal.querySelector('.av-feedback');
		countEl = modal.querySelector('.av-count');
		bar = modal.querySelector('.av-progress span');

		modal.addEventListener('click', function (e) {
			if (e.target.closest('[data-av-close]')) close();
			else if (e.target.closest('[data-av-next]')) next();
			else if (e.target.closest('[data-av-back]')) goTo(Math.max(1, current - 1));
		});
		form.addEventListener('submit', submit);
		form.addEventListener('change', function (e) {
			var t = e.target;
			/* navegador sem :has(): marca o cartão por classe */
			if (t.type === 'radio') form.querySelectorAll('[name="' + t.name + '"]').forEach(function (r) { r.closest('.av-card').classList.toggle('is-checked', r.checked); });
			if (t.type === 'checkbox') t.closest('.av-card').classList.toggle('is-checked', t.checked);
			/* escolha única avança sozinha */
			if (t.type === 'radio') setTimeout(function () { if (validate(current)) goTo(current + 1); }, 240);
			else if (t.type === 'checkbox') setFeedback('');
		});
		field('whatsapp').addEventListener('input', maskPhone);
		['name', 'whatsapp'].forEach(function (n) {
			field(n).addEventListener('input', schedulePartial);
			field(n).addEventListener('blur', schedulePartial);
		});
		/* Enter no nome/WhatsApp passa para o próximo campo em vez de enviar */
		form.addEventListener('keydown', function (e) {
			if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
			if (e.target.name === 'name') { e.preventDefault(); field('whatsapp').focus(); }
			else if (e.target.name === 'whatsapp') { e.preventDefault(); field('email').focus(); }
		});
		form.addEventListener('focusin', function (e) {
			if (e.target.tagName === 'INPUT' && e.target.type !== 'radio' && e.target.type !== 'checkbox') {
				setTimeout(function () { try { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (err) { } }, 300);
			}
		});
		if (window.visualViewport) window.visualViewport.addEventListener('resize', syncViewport);
		/* Saiu da página (ex.: abriu o WhatsApp) com contato válido: guarda o parcial já */
		document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') sendPartial(); });
		window.addEventListener('pagehide', sendPartial);
	}

	function open(from) {
		if (!modal) build();
		lastFocus = document.activeElement;
		openedFrom = from || '';
		if (!leadId) leadId = newId();
		if (form.isConnected) fillHidden();
		syncViewport();
		modal.classList.add('is-open');
		modal.setAttribute('aria-hidden', 'false');
		document.documentElement.style.overflow = 'hidden';
		track('form_start', { form_id: 'avaliacao', cta_location: openedFrom });
		if (form.isConnected) {
			if (!seen[current]) goTo(current);
			else { var first = form.querySelector('.av-step:not([hidden]) input'); if (first && current === 4) first.focus(); }
		}
		setTimeout(function () { var c = modal.querySelector('.av-close'); if (c && current !== 4) c.focus({ preventScroll: true }); }, 50);
	}

	function close() {
		if (!modal) return;
		modal.classList.remove('is-open');
		modal.setAttribute('aria-hidden', 'true');
		document.documentElement.style.overflow = '';
		sendPartial();
		if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
	}

	document.addEventListener('click', function (e) {
		var t = e.target.closest && e.target.closest('.js-open-consultor-modal, [data-open-avaliacao], a[href$="#abrir-avaliacao"]');
		if (!t) return;
		e.preventDefault();
		open(t.getAttribute('data-track-location') || t.getAttribute('data-open-avaliacao') || '');
	});
	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape' && modal && modal.classList.contains('is-open')) close();
	});

	window.apliaOpenAvaliacao = open;
})();
