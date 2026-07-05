#!/bin/bash

# Define o caminho do diretório deste projeto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_PATH="$PROJECT_DIR/scripts/generate_blog.py"
LOG_PATH="$PROJECT_DIR/blog_generation.log"

# Verifica se o script existe
if [ ! -f "$SCRIPT_PATH" ]; then
    echo "[!] Erro: Script generate_blog.py não encontrado em $SCRIPT_PATH."
    exit 1
fi

# Localiza o executável python3
PYTHON_BIN=$(which python3)
if [ -z "$PYTHON_BIN" ]; then
    PYTHON_BIN="/usr/bin/python3"
fi

# Define a tarefa cron
# Executa toda segunda-feira às 9h da manhã (0 9 * * 1)
CRON_TIME="0 9 * * 1"
CRON_CMD="cd \"$PROJECT_DIR\" && \"$PYTHON_BIN\" \"$SCRIPT_PATH\" >> \"$LOG_PATH\" 2>&1"

# Cria a entrada no crontab, preservando as entradas existentes
# Evita adicionar duplicatas
(crontab -l 2>/dev/null | grep -v "generate_blog.py"; echo "$CRON_TIME $CRON_CMD") | crontab -

echo "[+] Tarefa semanal configurada no cron com sucesso!"
echo "[*] Agendamento: Toda segunda-feira às 09:00"
echo "[*] Comando agendado: $CRON_CMD"
echo "[*] Logs de execução serão salvos em: $LOG_PATH"
