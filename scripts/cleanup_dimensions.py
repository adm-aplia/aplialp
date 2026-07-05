import os
import re

def main():
    print("=== Limpando Dimensões Hardcoded das Imagens WebP ===")
    html_files = ['index.html', 'blog.html', 'post-modelo.html']
    blog_dir = 'blog'
    if os.path.exists(blog_dir):
        for f in os.listdir(blog_dir):
            if f.endswith('.html'):
                html_files.append(os.path.join(blog_dir, f))

    for filepath in html_files:
        if not os.path.exists(filepath):
            continue
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Padrão para encontrar tags <img>
        img_pattern = r'<img\s+([^>]+)>'
        
        def clean_img(match):
            tag = match.group(0)
            # Apenas removemos se for uma imagem convertida em .webp para evitar quebrar pixels de rastreamento
            if '.webp' in tag:
                tag = re.sub(r'\s+width=["\']\d+["\']', '', tag)
                tag = re.sub(r'\s+height=["\']\d+["\']', '', tag)
            return tag

        new_content = re.sub(img_pattern, clean_img, content)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"[+] Dimensões removidas em: {filepath}")

if __name__ == '__main__':
    main()
