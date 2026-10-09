import os
import re
import sys

def check_constitution():
    """
    Ejemplo de validador de Constitución SDD.
    Este script analiza el código fuente en busca de infracciones a las 
    reglas establecidas en specs/constitution.md.
    
    Al ser una plantilla, estas reglas son ejemplos. Debes adaptarlas
    a los principios reales de tu proyecto.
    """
    
    # Directorio donde se encuentra el código fuente
    src_dir = "src"
    
    if not os.path.exists(src_dir):
        print(f"Nota: No se encontró el directorio '{src_dir}'. Saltando validación de código.")
        return

    # Definir las reglas basadas en la constitución
    # Formato: { "Nombre de la regla": { "patron": RegEx, "extensiones": [".js", ".ts", etc], "mensaje": "Mensaje de error" } }
    rules = {
        "Uso de Fetch nativo": {
            "pattern": re.compile(r'import\s+.*from\s+[\'"]axios[\'"]'),
            "extensions": [".js", ".ts", ".jsx", ".tsx"],
            "mensaje": "Infracción de la Constitución: Está prohibido el uso de axios. Utiliza fetch nativo."
        },
        "No dejar logs de consola": {
            "pattern": re.compile(r'console\.log\('),
            "extensions": [".js", ".ts", ".jsx", ".tsx"],
            "mensaje": "Infracción de la Constitución: No se permite código con console.log() en producción."
        },
        "No quemar secretos": {
            "pattern": re.compile(r'(?i)(password|secret|api_key|token)\s*=\s*[\'"][^\'"]+[\'"]'),
            "extensions": [".js", ".ts", ".py", ".cs", ".json", ".env.example"],
            "mensaje": "Infracción de la Constitución: Posible secreto hardcodeado detectado. Usa variables de entorno."
        }
    }

    has_errors = False

    # Recorrer el código fuente
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            file_path = os.path.join(root, file)
            _, ext = os.path.splitext(file)
            
            # Leer el archivo línea por línea si su extensión aplica a alguna regla
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    
                    for line_num, line in enumerate(lines, 1):
                        for rule_name, rule_data in rules.items():
                            # Si la extensión del archivo está en la lista de la regla
                            if ext in rule_data["extensions"]:
                                if rule_data["pattern"].search(line):
                                    print(f"[X] Error en {file_path} (Línea {line_num})")
                                    print(f"    Regla rota: {rule_name}")
                                    print(f"    {rule_data['mensaje']}")
                                    print(f"    Código infractor: {line.strip()}")
                                    print("-" * 40)
                                    has_errors = True
            except Exception as e:
                print(f"No se pudo leer el archivo {file_path}: {e}")

    if has_errors:
        print("\nValidación de la Constitución FALLIDA. Corrige las infracciones.")
        sys.exit(1)
    else:
        print("\nValidación de la Constitución EXITOSA. Todo el código respeta los principios.")

if __name__ == "__main__":
    check_constitution()
