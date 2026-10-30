#!/usr/bin/env python3
"""Copia assets/js/head.js para dentro do <head> de todas as páginas, logo depois
da tag <head> e antes do GTM e do Pixel, entre os marcadores aplia:head.
Inline (e não <script src>) porque precisa rodar antes do GTM sem custar uma
requisição bloqueante a mais no celular. Rode depois de editar head.js (o
deploy também roda). Idempotente: substitui o bloco se ele já existir."""
import re
from pathlib import Path

raiz = Path(__file__).resolve().parent.parent
fonte = (raiz / "assets" / "js" / "head.js").read_text(encoding="utf-8")
# Sem comentários nem indentação: o bloco vai em toda página
codigo = re.sub(r"/\*.*?\*/", "", fonte, flags=re.S)
codigo = "\n".join(l.strip() for l in codigo.splitlines() if l.strip())
bloco = f"<!-- aplia:head (gerado por scripts/inline-head.py) -->\n<script>\n{codigo}\n</script>\n<!-- /aplia:head -->"

padrao = re.compile(r"<!-- aplia:head.*?<!-- /aplia:head -->", re.S)
alterados = 0
for pagina in sorted(list(raiz.glob("*.html")) + list((raiz / "blog").glob("*.html"))):
    texto = pagina.read_text(encoding="utf-8")
    if padrao.search(texto):
        novo = padrao.sub(lambda m: bloco, texto)
    else:
        novo, n = re.subn(r"(<head[^>]*>)", lambda m: m.group(1) + "\n" + bloco, texto, count=1)
        if not n:
            print(f"sem <head>: {pagina.name}")
            continue
    if novo != texto:
        pagina.write_text(novo, encoding="utf-8")
        alterados += 1
print(f"{alterados} página(s) atualizada(s)")
