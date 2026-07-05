import os
import sys

# Adiciona o diretório scripts ao path para importar funções do generate_blog.py
sys.path.append(os.path.abspath(os.path.dirname(__file__)))
from generate_blog import get_api_key, create_blog_post_file, update_llms_full_txt, update_sitemap, commit_and_push

# Artigos pré-definidos em blog.html que estão sem arquivo físico correspondente
MISSING_POSTS = [
    {
        "title": "Seu consultório atende fora do horário comercial? Deveria!",
        "description": "60% das marcações acontecem fora do horário comercial. Veja como não perder esses pacientes.",
        "category": "Atendimento",
        "read_time": "4 min de leitura",
        "slug": "seu-consultorio-atende-fora-do-horario-comercial"
    },
    {
        "title": "Secretária virtual para consultório médico: vale a pena?",
        "description": "Comparamos custos, benefícios e quando faz sentido ter uma assistente virtual no seu consultório.",
        "category": "Tecnologia",
        "read_time": "6 min de leitura",
        "slug": "secretaria-virtual-para-consultorio-medico-vale-a-pena"
    },
    {
        "title": "Como reduzir faltas de pacientes nas consultas",
        "description": "Lembretes automáticos podem reduzir em até 40% as faltas. Aprenda a implementar no seu consultório.",
        "category": "Gestão",
        "read_time": "5 min de leitura",
        "slug": "como-reduzir-faltas-de-pacientes-nas-consultas"
    },
    {
        "title": "Inteligência artificial para clínicas: o que muda em 2026",
        "description": "As principais tendências de IA na saúde e como se preparar para o futuro do atendimento médico.",
        "category": "Tendências",
        "read_time": "8 min de leitura",
        "slug": "inteligencia-artificial-para-clinicas-o-que-muda-em-2026"
    }
]

def generate_specific_post(api_key, post_info):
    import urllib.request
    import urllib.error
    import json
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    
    prompt = f"""
Você é um especialista em marketing médico e SEO/GEO local para o mercado brasileiro.
Escreva um artigo de blog otimizado para o blog da 'Aplia Saúde' (plataforma de secretária virtual com IA no WhatsApp).

O artigo DEVE ter os seguintes metadados pré-definidos:
- Título: "{post_info['title']}"
- Descrição meta: "{post_info['description']}"
- Categoria: "{post_info['category']}"
- Tempo de leitura: "{post_info['read_time']}"
- URL (Slug): "{post_info['slug']}"

Escreva o conteúdo detalhado do artigo focado em como clínicas e profissionais da saúde se beneficiam desse tema. Use linguagem profissional, persuasiva e natural, direcionada a médicos, dentistas, psicólogos e gestores de clínicas no Brasil.

Certifique-se de:
1. Incluir dados ou estatísticas realistas sobre atendimento de saúde no Brasil (ex: percentual de faltas, taxas de conversão de leads, estatísticas de uso do WhatsApp por pacientes, referências regulatórias como resoluções do CFM como o CFM 2454/2026 ou conformidade LGPD).
2. Buscar a validação e confirmação de dados simulando ou citando fontes reais de mercado.
3. No final do artigo, crie uma seção estruturada HTML com o cabeçalho '<h2>Referências e Fontes</h2>' e uma lista '<ul>' contendo de 2 a 3 fontes reais ou altamente credíveis que respaldem as informações do artigo (ex: CFM - Conselho Federal de Medicina, estudos de telemedicina de USP/FGV, dados do Sebrae ou OMS).

Gere a resposta em formato JSON estrito, sem formatação markdown (como ```json ou ```) envolvendo o JSON, com a seguinte estrutura de chaves:
{{
  "title": "{post_info['title']}",
  "meta_description": "{post_info['description']}",
  "category": "{post_info['category']}",
  "read_time": "{post_info['read_time']}",
  "slug": "{post_info['slug']}",
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
    
    print(f"[*] Enviando solicitação ao Gemini para o tema: '{post_info['title']}'...")
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode('utf-8')
            res_json = json.loads(res_body)
            generated_text = res_json['candidates'][0]['content']['parts'][0]['text']
            post_data = json.loads(generated_text.strip())
            
            # Força o alinhamento de metadados pré-definidos
            post_data["title"] = post_info["title"]
            post_data["meta_description"] = post_info["description"]
            post_data["category"] = post_info["category"]
            post_data["read_time"] = post_info["read_time"]
            post_data["slug"] = post_info["slug"]
            
            return post_data
    except Exception as e:
        print(f"[!] Erro ao gerar artigo '{post_info['title']}': {e}")
        return None

def main():
    print("=== Gerando Artigos Ausentes do Blog ===")
    
    api_key = get_api_key()
    if not api_key:
        print("[!] ERRO: Chave de API 'GEMINI_API_KEY' não encontrada.")
        print("    Cadastre-a no .env para continuar.")
        sys.exit(1)
        
    generated_count = 0
    
    for post_info in MISSING_POSTS:
        post_path = os.path.join('blog', f"{post_info['slug']}.html")
        if os.path.exists(post_path):
            print(f"[~] Artigo já existe físico, pulando: {post_path}")
            continue
            
        post_data = generate_specific_post(api_key, post_info)
        if post_data:
            create_blog_post_file(post_data)
            update_sitemap(post_data["slug"])
            generated_count += 1
            
    if generated_count > 0:
        # Atualiza o índice do llms-full.txt
        update_llms_full_txt()
        print(f"\n[+] {generated_count} artigos ausentes foram gerados com sucesso!")
        
        # Envia alterações para o GitHub
        commit_and_push(f"Geração de {generated_count} artigos ausentes")
    else:
        print("\n[~] Nenhum artigo ausente precisou ser gerado.")

if __name__ == '__main__':
    main()
