#!/usr/bin/env python3
"""Acrescenta ?v=<hash do conteúdo> nas referências a assets/js/*.js de todas as
páginas. O servidor manda Cache-Control: no-cache para JS, mas o hash garante que
um navegador ou CDN nunca sirva uma versão velha do script depois de um deploy.
Rode depois de editar qualquer arquivo em assets/js (o deploy também roda)."""
import hashlib
import re
from pathlib import Path

raiz = Path(__file__).resolve().parent.parent
js = {f.name: hashlib.sha1(f.read_bytes()).hexdigest()[:8] for f in (raiz / "assets" / "js").glob("*.js")}
padrao = re.compile(r"(assets/js/)([A-Za-z0-9_.-]+\.js)(\?v=[0-9a-f]+)?")

alterados = 0
for pagina in list(raiz.glob("*.html")) + list((raiz / "blog").glob("*.html")):
    texto = pagina.read_text(encoding="utf-8")
    novo = padrao.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={js[m.group(2)]}" if m.group(2) in js else m.group(0), texto)
    if novo != texto:
        pagina.write_text(novo, encoding="utf-8")
        alterados += 1
print(f"{alterados} página(s) atualizada(s); versões: {js}")
