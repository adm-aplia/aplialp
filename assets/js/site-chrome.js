/* Navegação, menu mobile, reveal-on-scroll e acordeão de FAQ — extraído do
   index.html pra ser compartilhado pelas páginas comerciais novas (/precos,
   /funcionalidades, /integracoes, /lgpd, /cfm-2454-2026) sem duplicar o motor
   inteiro da home (chat-demo e modal de qualificação ficam só lá). */
(function () {
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const navOuter = document.getElementById('header');
	if (navOuter) {
		const sentinel = document.createElement('div');
		sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;pointer-events:none';
		document.body.prepend(sentinel);
		new IntersectionObserver(
			([e]) => navOuter.classList.toggle('stuck', !e.isIntersecting),
			{ rootMargin: '-8px 0px 0px 0px' }
		).observe(sentinel);
	}

	const burger = document.getElementById('mobileToggle');
	const sheet = document.getElementById('navSheet');
	if (burger && sheet) {
		function setSheet(open) {
			burger.classList.toggle('open', open);
			sheet.classList.toggle('open', open);
			burger.setAttribute('aria-expanded', String(open));
			burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
			document.body.style.overflow = open ? 'hidden' : '';
		}
		burger.addEventListener('click', () => setSheet(!sheet.classList.contains('open')));
		sheet.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setSheet(false)));
		document.addEventListener('keydown', e => {
			if (e.key === 'Escape' && sheet.classList.contains('open')) setSheet(false);
		});
	}

	const riseObserver = new IntersectionObserver(entries => {
		entries.forEach(entry => {
			if (!entry.isIntersecting) return;
			entry.target.classList.add('visible');
			riseObserver.unobserve(entry.target);
		});
	}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

	document.querySelectorAll('.rise').forEach(el => {
		if (reduceMotion) { el.classList.add('visible'); return; }
		riseObserver.observe(el);
	});

	document.querySelectorAll('#faqList .q').forEach(item => {
		const btn = item.querySelector('button');
		btn.setAttribute('aria-expanded', 'false');
		btn.addEventListener('click', () => {
			const willOpen = !item.classList.contains('open');
			document.querySelectorAll('#faqList .q').forEach(other => {
				other.classList.remove('open');
				other.querySelector('button').setAttribute('aria-expanded', 'false');
			});
			item.classList.toggle('open', willOpen);
			btn.setAttribute('aria-expanded', String(willOpen));
		});
	});
})();
