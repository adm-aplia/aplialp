import os
import sys
import json
import urllib.request
import urllib.error
from datetime import datetime
import random
import re
from html.parser import HTMLParser

# Temas padrão focados em SEO e GEO (Local SEO) para o mercado de clínicas brasileiras
DEFAULT_TOPICS = [
    "Como reduzir faltas de pacientes em clínicas de São Paulo com automação",
    "Secretária Virtual com IA: O futuro do atendimento médico no Rio de Janeiro",
    "Como a Inteligência Artificial melhora a experiência do paciente em Belo Horizonte",
    "Como pediatras em Curitiba estão otimizando o agendamento de consultas",
    "Zere as faltas de pacientes no consultório em Porto Alegre com lembretes automáticos",
    "Como clínicas de dermatologia em Salvador estão captando mais pacientes pelo WhatsApp",
    "Os impactos da IA no WhatsApp para médicos de ginecologia em Campinas",
    "Como automatizar o pós-consulta de forma humanizada em clínicas de Florianópolis",
    "Como secretárias de clínicas em Fortaleza ganham tempo com assistentes virtuais de IA"
]

def load_env():
    """Carrega variáveis de ambiente de arquivos .env se existirem."""
    env_vars = {}
    # Procura por .env em locais comuns
    search_paths = [
        '.env', 
        '../.env', 
        '../../.env', 
        os.path.expanduser('~/.env'),
        '/Users/nathanmarcelosantosalmeida/Documents/Apps Antigravity/.env'
    ]
    for path in search_paths:
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            k, v = line.split('=', 1)
                            env_vars[k.strip()] = v.strip().strip('"').strip("'")
                print(f"[*] Configurações carregadas de: {path}")
                break
            except Exception as e:
                print(f"[!] Erro ao ler .env em {path}: {e}")
    return env_vars

def get_api_key():
    """Obtém a chave de API do Gemini das variáveis do sistema ou do arquivo .env."""
    key = os.environ.get('GEMINI_API_KEY')
    if not key:
        env = load_env()
        key = env.get('GEMINI_API_KEY')
    return key

def choose_topic():
    """Escolhe o tema com base nos argumentos de linha de comando ou escolhe um aleatório não existente."""
    if len(sys.argv) > 1:
        return " ".join(sys.argv[1:])
    
    # Se não houver argumento, tenta ler os arquivos já gerados para não repetir
    blog_dir = 'blog'
    existing_slugs = []
    if os.path.exists(blog_dir):
        existing_slugs = [f.replace('.html', '') for f in os.listdir(blog_dir) if f.endswith('.html')]

    # Filtra tópicos cujo slug aproximado já não existe
    available_topics = []
    for topic in DEFAULT_TOPICS:
        # Simplifica o slug para comparação
        clean_slug = topic.lower().replace(" ", "-").replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u").replace("ã", "a").replace("õ", "o").replace("ç", "c")
        clean_slug = re.sub(r'[^a-z0-9\-]', '', clean_slug)
        
        # Verifica se existe um slug parecido
        match = False
        for es in existing_slugs:
            if es in clean_slug or clean_slug in es:
                match = True
                break
        if not match:
            available_topics.append(topic)
            
    if available_topics:
        return random.choice(available_topics)
    return random.choice(DEFAULT_TOPICS)

def generate_post_with_gemini(topic, api_key):
    """Consome a API do Gemini 2.5 Flash para gerar o conteúdo do post em formato JSON."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    
    prompt = f"""
Você é um especialista em marketing médico e SEO/GEO local para o mercado brasileiro.
Escreva um artigo de blog otimizado para o blog da 'Aplia Saúde' (plataforma de secretária virtual com IA no WhatsApp).
O tema do artigo é: "{topic}"

O artigo deve focar em como clínicas, consultórios ou profissionais da saúde podem otimizar seu atendimento, reduzir faltas e agilizar o agendamento de consultas usando assistentes de inteligência artificial integrados ao WhatsApp. Use linguagem profissional, persuasiva e natural, direcionada a médicos, dentistas, psicólogos e gestores de clínicas no Brasil.

Certifique-se de:
1. Incluir dados ou estatísticas realistas sobre atendimento de saúde no Brasil (ex: percentual de faltas, taxas de conversão de leads, estatísticas de uso do WhatsApp por pacientes, referências regulatórias como resoluções do CFM como o CFM 2454/2026 ou conformidade LGPD).
2. Buscar a validação e confirmação de dados simulando ou citando fontes reais de mercado.
3. No final do artigo, crie uma seção estruturada HTML com o cabeçalho '<h2>Referências e Fontes</h2>' e uma lista '<ul>' contendo de 2 a 3 fontes reais ou altamente credíveis que respaldem as informações do artigo (ex: CFM - Conselho Federal de Medicina, estudos de telemedicina de USP/FGV, dados do Sebrae ou OMS).

Gere a resposta em formato JSON estrito, sem formatação markdown (como ```json ou ```) envolvendo o JSON, com a seguinte estrutura de chaves:
{{
  "title": "Título atraente do artigo de blog focado em SEO/GEO",
  "meta_description": "Descrição curta para a meta tag SEO (máximo 150 caracteres)",
  "category": "Uma das seguintes categorias: Gestão, Automação, Atendimento, Tecnologia, Tendências",
  "read_time": "Ex: 5 min de leitura",
  "slug": "url-do-artigo-em-letras-minusculas-sem-acentos-separada-por-hifens",
  "content_html": "O conteúdo completo do artigo formatado em HTML. Use parágrafos <p>, cabeçalhos <h2> para subtítulos, listas <ul> e <li> se necessário. Não inclua a tag <h1> nem tags estruturais como <html>, <body>. Seja profundo, com pelo menos 5 parágrafos de conteúdo rico e focado no tema. E inclua a seção de referências e fontes no final do HTML."
}}
"""

    payload = {
        "contents": [{
            "parts": [{
                "text": prompt
            }]
        }],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
    
    print(f"[*] Enviando solicitação ao Gemini para o tema: '{topic}'...")
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode('utf-8')
            res_json = json.loads(res_body)
            
            # Extrai o texto gerado
            generated_text = res_json['candidates'][0]['content']['parts'][0]['text']
            # Parse do JSON interno gerado pelo modelo
            post_data = json.loads(generated_text.strip())
            return post_data
    except urllib.error.HTTPError as e:
        print(f"[!] Erro HTTP da API do Gemini: {e.code} - {e.read().decode('utf-8')}")
        sys.exit(1)
    except Exception as e:
        print(f"[!] Erro desconhecido durante a geração de conteúdo: {e}")
        sys.exit(1)

def create_blog_post_file(post_data):
    """Cria o arquivo HTML do artigo na pasta blog/ usando o modelo post-modelo.html."""
    template_path = 'post-modelo.html'
    if not os.path.exists(template_path):
        print(f"[!] Erro: Arquivo de modelo '{template_path}' não encontrado.")
        sys.exit(1)
        
    with open(template_path, 'r', encoding='utf-8') as f:
        html = f.read()
        
    # Data atual por extenso em português
    months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
    now = datetime.now()
    date_str = f"{now.day} de {months[now.month - 1]} de {now.year}"
    
    # 1. Substituições de caminhos relativos de ativos e links
    html = html.replace('href="assets/css/style.css"', 'href="../assets/css/style.css"')
    html = html.replace('href="assets/img/favicon.png"', 'href="../assets/img/favicon.png"')
    html = html.replace('src="assets/img/hero.jpg"', 'src="../assets/img/hero.jpg"')
    html = html.replace('src="assets/img/aplia-logo.png"', 'src="../assets/img/aplia-logo.png"')
    html = html.replace('src="assets/img/footer-logo.png"', 'src="../assets/img/footer-logo.png"')
    
    # Substituir links do menu e CTA para voltar um nível
    html = html.replace('href="index.html', 'href="../index.html')
    html = html.replace('href="blog.html"', 'href="../blog.html"')
    
    # 2. Substituições de Metadados e SEO
    html = re.sub(r'<title>.*?</title>', f'<title>{post_data["title"]} | Blog Aplia</title>', html)
    
    meta_desc_regex = r'<meta name="description" content=".*?"\s*/?>'
    new_meta_desc = f'<meta name="description" content="{post_data["meta_description"]}" />'
    html = re.sub(meta_desc_regex, new_meta_desc, html)
    
    # Open Graph Tags se existirem
    html = html.replace('property="og:title" content="Aplia - Assistentes de IA para Profissionais da Saúde"', f'property="og:title" content="{post_data["title"]}"')
    html = html.replace('property="og:description" content="A inteligência artificial no WhatsApp que cuida do agendamento e das dúvidas dos seus pacientes 24/7."', f'property="og:description" content="{post_data["meta_description"]}"')
    html = html.replace('property="og:url" content="https://aplia.com.br/"', f'property="og:url" content="https://aplia.com.br/blog/{post_data["slug"]}.html"')
    html = html.replace('property="og:type" content="website"', 'property="og:type" content="article"')
    
    # 3. Post Hero
    hero_pattern = r'<div class="post-hero">.*?<h1>.*?</h1>.*?<div class="post-meta">.*?</div>.*?</div>'
    new_hero = f"""<div class="post-hero">
        <h1>{post_data["title"]}</h1>
        <div class="post-meta">Publicado em {date_str} | Categoria: {post_data["category"]} | {post_data["read_time"]}</div>
    </div>"""
    html = re.sub(hero_pattern, new_hero, html, flags=re.DOTALL)
    
    # 4. Post Content
    content_start = '    <div class="post-content">'
    content_end = '    </div>\n\n    <!-- FOOTER -->'
    
    start_idx = html.find(content_start)
    end_idx = html.find(content_end)
    
    if start_idx != -1 and end_idx != -1:
        new_content_block = f"""    <div class="post-content">
        <a href="../blog.html" class="back-link">← Voltar para o Blog</a>

        <img src="../assets/img/hero.jpg" alt="{post_data["title"]}">

        {post_data["content_html"]}

        <p><strong>Quer levar essa tecnologia para sua clínica?</strong> <a href="../index.html">Conheça os planos da
                Aplia</a> e comece hoje mesmo.</p>
    </div>"""
        html = html[:start_idx] + new_content_block + html[end_idx + len(content_end) - 23:] # compensa o fechamento de div e tags
    else:
        # Fallback de substituição se a estrutura mudar um pouco
        print("[!] Aviso: Não foi possível identificar as tags exatas do container do post. Fazendo substituição geral de parágrafos.")
    
    # 5. Adiciona dados estruturados JSON-LD (SEO e GEO)
    date_published_iso = now.strftime("%Y-%m-%d")
    schema_data = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": post_data["title"],
      "description": post_data["meta_description"],
      "datePublished": date_published_iso,
      "author": {
        "@type": "Organization",
        "name": "Aplia Saúde",
        "url": "https://aplia.com.br"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Aplia Saúde",
        "logo": {
          "@type": "ImageObject",
          "url": "https://aplia.com.br/assets/img/aplia-logo.png"
        }
      },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": f"https://aplia.com.br/blog/{post_data['slug']}.html"
      }
    }
    json_ld_str = json.dumps(schema_data, indent=2, ensure_ascii=False)
    json_ld_script = f"    <script type=\"application/ld+json\">\n{json_ld_str}\n    </script>"
    html = html.replace('</head>', f'{json_ld_script}\n</head>')

    # Salva o arquivo na pasta blog/
    os.makedirs('blog', exist_ok=True)
    post_filepath = os.path.join('blog', f'{post_data["slug"]}.html')
    
    with open(post_filepath, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"[+] Artigo HTML criado: {post_filepath}")
    return post_filepath

def update_blog_index(post_data):
    """Prende o card do novo artigo no topo da lista na página blog.html."""
    blog_index_path = 'blog.html'
    if not os.path.exists(blog_index_path):
        print(f"[!] Aviso: '{blog_index_path}' não encontrado. Pulando atualização do index de posts.")
        return
        
    with open(blog_index_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Identifica o contêiner grid
    grid_start_tag = '<div class="blog-grid">'
    grid_idx = content.find(grid_start_tag)
    
    if grid_idx == -1:
        print("[!] Erro: Não foi possível encontrar a tag <div class=\"blog-grid\"> em blog.html")
        return
        
    # Cria o card do novo post
    new_card = f"""
                <!-- Artigo: {post_data["title"]} -->
                <article class="blog-card">
                    <img src="assets/img/hero.jpg" alt="{post_data["title"]}">
                    <div class="blog-card-content">
                        <span class="blog-category">{post_data["category"]}</span>
                        <h2><a href="blog/{post_data["slug"]}.html">{post_data["title"]}</a></h2>
                        <p>{post_data["meta_description"]}</p>
                        <div class="blog-meta">
                            <span>{post_data["read_time"]}</span>
                            <a href="blog/{post_data["slug"]}.html" class="read-more">Ler artigo →</a>
                        </div>
                    </div>
                </article>
"""
    # Insere o card logo no início da lista do grid
    insert_pos = grid_idx + len(grid_start_tag)
    updated_content = content[:insert_pos] + new_card + content[insert_pos:]
    
    with open(blog_index_path, 'w', encoding='utf-8') as f:
        f.write(updated_content)
    print(f"[+] blog.html atualizado com o novo artigo.")

def update_sitemap(slug):
    """Adiciona a URL do novo artigo no sitemap.xml."""
    sitemap_path = 'sitemap.xml'
    if not os.path.exists(sitemap_path):
        print(f"[!] Aviso: '{sitemap_path}' não encontrado. Pulando sitemap.")
        return
        
    with open(sitemap_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    now_date = datetime.now().strftime("%Y-%m-%d")
    
    # Prepara a nova entrada
    new_url = f"""\t<url>
\t\t<loc>https://aplia.com.br/blog/{slug}.html</loc>
\t\t<lastmod>{now_date}</lastmod>
\t\t<changefreq>weekly</changefreq>\n\t\t<priority>0.6</priority>
\t</url>
</urlset>"""

    # Insere antes da tag de fechamento </urlset>
    if '</urlset>' in content:
        updated_content = content.replace('</urlset>', new_url)
        with open(sitemap_path, 'w', encoding='utf-8') as f:
            f.write(updated_content)
        print(f"[+] sitemap.xml atualizado com o novo artigo.")
    else:
        print("[!] Erro: Tag </urlset> não encontrada no sitemap.xml.")

def update_llms_txt(post_data):
    """Adiciona o link e título do novo artigo no arquivo llms.txt."""
    llms_path = 'llms.txt'
    if not os.path.exists(llms_path):
        print(f"[!] Aviso: '{llms_path}' não encontrado. Pulando llms.txt.")
        return
        
    with open(llms_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    new_link = f'- [{post_data["title"]}](https://aplia.com.br/blog/{post_data["slug"]}.html)\n'
    
    # Adiciona no final do arquivo (ou sob a seção correspondente)
    if content.endswith('\n'):
        updated_content = content + new_link
    else:
        updated_content = content + '\n' + new_link
        
    with open(llms_path, 'w', encoding='utf-8') as f:
        f.write(updated_content)
    print(f"[+] llms.txt atualizado com o novo artigo.")

class HTMLTextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.result = []
        self.in_script_or_style = False

    def handle_starttag(self, tag, attrs):
        if tag in ['script', 'style']:
            self.in_script_or_style = True
        elif tag == 'h2':
            self.result.append('\n\n## ')
        elif tag == 'p':
            self.result.append('\n\n')
        elif tag == 'li':
            self.result.append('\n- ')

    def handle_endtag(self, tag):
        if tag in ['script', 'style']:
            self.in_script_or_style = False

    def handle_data(self, data):
        if not self.in_script_or_style:
            self.result.append(data)

    def get_text(self):
        text = ''.join(self.result).strip()
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text

def update_llms_full_txt():
    """Gera ou atualiza o arquivo llms-full.txt compilando o texto de todos os posts do blog."""
    llms_full_path = 'llms-full.txt'
    blog_dir = 'blog'
    
    if not os.path.exists(blog_dir):
        print("[!] Aviso: Pasta de blog não existe. Pulando llms-full.txt.")
        return
        
    html_files = [f for f in os.listdir(blog_dir) if f.endswith('.html')]
    html_files.sort()
    
    compilation = []
    compilation.append("# Aplia Saúde - Conteúdo Completo do Blog (AI-Friendly)\n")
    compilation.append("Este arquivo reúne todos os artigos do blog da Aplia Saúde em texto limpo, facilitando a indexação e o consumo por agentes de inteligência artificial (GEO).\n")
    compilation.append("---\n")
    
    for filename in html_files:
        filepath = os.path.join(blog_dir, filename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                html_content = f.read()
            
            title_match = re.search(r'<title>(.*?) \| Blog Aplia</title>', html_content)
            title = title_match.group(1) if title_match else filename.replace('.html', '').replace('-', ' ').title()
            
            desc_match = re.search(r'<meta name="description" content="(.*?)"', html_content)
            description = desc_match.group(1) if desc_match else ""
            
            post_url = f"https://aplia.com.br/blog/{filename}"
            
            start_tag = '<div class="post-content">'
            end_tag = '    </div>\n\n    <!-- FOOTER -->'
            
            start_idx = html_content.find(start_tag)
            end_idx = html_content.find(end_tag, start_idx)
            
            if start_idx != -1 and end_idx != -1:
                post_body_html = html_content[start_idx + len(start_tag):end_idx]
                
                post_body_html = re.sub(r'<a[^>]*class="back-link"[^>]*>.*?</a>', '', post_body_html, flags=re.DOTALL)
                post_body_html = re.sub(r'<img[^>]*>', '', post_body_html)
                post_body_html = re.sub(r'<p><strong>Quer levar essa tecnologia.*?</p>', '', post_body_html, flags=re.DOTALL)
                
                parser = HTMLTextExtractor()
                parser.feed(post_body_html)
                clean_text = parser.get_text()
                
                compilation.append(f"## [{title}]({post_url})")
                if description:
                    compilation.append(f"> *{description}*\n")
                compilation.append(clean_text)
                compilation.append("\n---\n")
        except Exception as e:
            print(f"[!] Erro ao processar {filepath} para llms-full.txt: {e}")
            
    with open(llms_full_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(compilation))
    print("[+] llms-full.txt atualizado com todos os artigos.")

def commit_and_push(post_title):
    """Adiciona, commita e empurra as alterações para o GitHub."""
    import subprocess
    print("[*] Commitando e enviando alterações para o GitHub...")
    try:
        subprocess.run(["git", "add", "."], check=True)
        status = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True)
        if not status.stdout.strip():
            print("[~] Nenhuma alteração para commitar.")
            return
            
        commit_msg = f"Publicação automatizada: {post_title}"
        subprocess.run(["git", "commit", "-m", commit_msg], check=True)
        
        # Puxa antes para evitar conflitos
        subprocess.run(["git", "pull", "--rebase"], check=True)
        
        subprocess.run(["git", "push"], check=True)
        print("[+] Commit e Push realizados com sucesso no GitHub!")
    except Exception as e:
        print(f"[!] Erro ao realizar commit/push no Git: {e}")

def main():
    print("=== Gerador e Repetidor de Blog Aplia Saúde ===")
    
    # 1. Carrega API Key
    api_key = get_api_key()
    if not api_key:
        print("[!] ERRO CRÍTICO: Chave de API 'GEMINI_API_KEY' não encontrada.")
        print("    Certifique-se de configurar a variável de ambiente ou criar um arquivo .env")
        print("    contendo: GEMINI_API_KEY=sua_chave_aqui")
        sys.exit(1)
        
    # 2. Define o Tema do Artigo
    topic = choose_topic()
    print(f"[*] Tema escolhido: '{topic}'")
    
    # 3. Gera os Dados via Gemini
    post_data = generate_post_with_gemini(topic, api_key)
    print(f"[+] Conteúdo gerado com sucesso!")
    print(f"    Título: {post_data['title']}")
    print(f"    Slug: {post_data['slug']}")
    print(f"    Categoria: {post_data['category']}")
    print(f"    Tempo de leitura: {post_data['read_time']}")
    
    # 4. Cria o Arquivo HTML
    create_blog_post_file(post_data)
    
    # 5. Atualiza Índice do Blog
    update_blog_index(post_data)
    
    # 6. Atualiza Sitemap
    update_sitemap(post_data["slug"])
    
    # 7. Atualiza llms.txt
    update_llms_txt(post_data)
    
    # 8. Atualiza llms-full.txt
    update_llms_full_txt()
    
    # 9. Envia para o GitHub
    commit_and_push(post_data["title"])
    
    print("=== Processo Concluído com Sucesso! ===")

if __name__ == '__main__':
    main()
