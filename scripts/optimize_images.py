import os
import re
from PIL import Image

def optimize_images():
    print("=== Iniciando Otimização de Imagens ===")
    
    img_dir = 'assets/img'
    blog_img_dir = 'assets/img/blog'
    
    # Dicionário para guardar as dimensões das imagens e mapear antigas extensões para .webp
    image_metadata = {}
    
    # Extensões para buscar
    target_extensions = ('.png', '.jpg', '.jpeg')
    
    # Pastas para escanear
    search_dirs = [img_dir, blog_img_dir]
    
    for directory in search_dirs:
        if not os.path.exists(directory):
            continue
            
        print(f"\n[*] Escaneando diretório: {directory}")
        for filename in os.listdir(directory):
            # Ignora favicons para compatibilidade de navegadores antigos
            if 'favicon' in filename:
                print(f"[~] Pulando favicon: {filename}")
                continue
                
            filepath = os.path.join(directory, filename)
            
            # Pula subdiretórios
            if os.path.isdir(filepath):
                continue
                
            if filename.lower().endswith(target_extensions):
                base_name, ext = os.path.splitext(filename)
                webp_filename = base_name + '.webp'
                webp_filepath = os.path.join(directory, webp_filename)
                
                try:
                    # Abre e converte a imagem
                    with Image.open(filepath) as img:
                        width, height = img.size
                        # Salva em formato WebP com qualidade otimizada de 80%
                        img.save(webp_filepath, 'WEBP', quality=80)
                        
                    # Guarda dimensões e mapeamento
                    rel_old_path = os.path.join(directory, filename).replace('\\', '/')
                    rel_new_path = os.path.join(directory, webp_filename).replace('\\', '/')
                    image_metadata[rel_old_path] = {
                        'webp_path': rel_new_path,
                        'width': width,
                        'height': height,
                        'base_name': base_name
                    }
                    
                    # Remove o arquivo original pesado
                    os.remove(filepath)
                    print(f"[+] Convertido e removido original: {filename} -> {webp_filename} ({width}x{height})")
                except Exception as e:
                    print(f"[!] Erro ao processar imagem {filename}: {e}")
                    
    # Atualiza as referências nos arquivos HTML
    print("\n[*] Atualizando referências em arquivos HTML...")
    html_files = []
    
    # Encontra todos os arquivos HTML
    if os.path.exists('index.html'):
        html_files.append('index.html')
    if os.path.exists('blog.html'):
        html_files.append('blog.html')
    if os.path.exists('post-modelo.html'):
        html_files.append('post-modelo.html')
        
    blog_dir = 'blog'
    if os.path.exists(blog_dir):
        for f in os.listdir(blog_dir):
            if f.endswith('.html'):
                html_files.append(os.path.join(blog_dir, f))
                
    for html_file in html_files:
        try:
            with open(html_file, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Substitui links simples (como em tags meta, links open graph, etc.)
            for old_path, meta in image_metadata.items():
                # Substitui caminhos diretos (ex: assets/img/phone.png -> assets/img/phone.webp)
                content = content.replace(old_path, meta['webp_path'])
                
                # Também lida com caminhos relativos de posts dentro de blog/ (ex: ../assets/img/phone.png)
                rel_old = old_path.replace('assets/', '../assets/')
                rel_new = meta['webp_path'].replace('assets/', '../assets/')
                content = content.replace(rel_old, rel_new)
                
            # Regex para encontrar e otimizar tags <img>
            # Encontra <img ... src="path" ...>
            img_tag_pattern = r'<img\s+([^>]*?)src="([^"]+?)"([^>]*?)>'
            
            def optimize_img_tag(match):
                prefix = match.group(1)
                src = match.group(2)
                suffix = match.group(3)
                
                # Reconstrói a tag
                attrs = prefix + " " + suffix
                
                # Verifica se a imagem é abaixo da dobra para colocar lazy loading
                is_below_fold = any(x in src for x in ['step', 'artigo', 'phone'])
                
                # Adiciona lazy loading se for abaixo da dobra e não tiver
                if is_below_fold and 'loading=' not in attrs:
                    attrs += ' loading="lazy"'
                    
                # Adiciona width e height se estiver nas nossas imagens convertidas
                # Encontra o arquivo correspondente nas chaves do metadado
                matching_meta = None
                for old_path, meta in image_metadata.items():
                    if src.endswith(meta['webp_path']) or src.endswith(meta['webp_path'].replace('assets/', '../assets/')):
                        matching_meta = meta
                        break
                        
                if matching_meta:
                    # Adiciona width e height se já não existirem
                    if 'width=' not in attrs:
                        attrs += f' width="{matching_meta["width"]}"'
                    if 'height=' not in attrs:
                        attrs += f' height="{matching_meta["height"]}"'
                        
                # Limpa espaços duplicados
                attrs = re.sub(r'\s+', ' ', attrs).strip()
                
                return f'<img src="{src}" {attrs}>'
                
            updated_content = re.sub(img_tag_pattern, optimize_img_tag, content)
            
            with open(html_file, 'w', encoding='utf-8') as f:
                f.write(updated_content)
            print(f"[+] HTML atualizado: {html_file}")
        except Exception as e:
            print(f"[!] Erro ao atualizar referências no HTML {html_file}: {e}")
            
    print("\n=== Otimização concluída com sucesso! ===")

if __name__ == '__main__':
    optimize_images()
