import os
import re

def clean_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # 1. Substitui links de logo que apontam para index.html ou ../index.html pelo root do site "/"
    content = re.sub(r'href="(?:\.\./)?index\.html"', 'href="/"', content)
    
    # 2. Substitui links de âncoras da home (como #como, #price, #faq) para o formato absoluto limpo
    content = re.sub(r'href="(?:\.\./)?index\.html#como"', 'href="/#como"', content)
    content = re.sub(r'href="(?:\.\./)?index\.html#price"', 'href="/#price"', content)
    content = re.sub(r'href="(?:\.\./)?index\.html#faq"', 'href="/#faq"', content)
    
    # 3. Substitui chamadas para blog.html para a URL limpa "/blog"
    content = re.sub(r'href="(?:\.\./)?blog\.html"', 'href="/blog"', content)
    
    # 4. Substitui links de artigos que terminam em .html (como blog/slug.html) por "/blog/slug"
    content = re.sub(r'href="(?:\.\./)?blog/([^"]+)\.html"', r'href="/blog/\1"', content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"[+] URLs limpas em: {filepath}")

def main():
    print("=== Iniciando Limpeza Geral de URLs ===")
    
    html_files = ['index.html', 'blog.html']
    blog_dir = 'blog'
    if os.path.exists(blog_dir):
        for f in os.listdir(blog_dir):
            if f.endswith('.html'):
                html_files.append(os.path.join(blog_dir, f))
                
    for filepath in html_files:
        if os.path.exists(filepath):
            clean_file(filepath)

if __name__ == '__main__':
    main()
