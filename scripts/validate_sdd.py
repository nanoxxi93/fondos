import os
import sys

def validate_specs():
    specs_dir = "specs"
    if not os.path.exists(specs_dir):
        print(f"Error: No se encontró el directorio {specs_dir}")
        sys.exit(1)

    has_errors = False
    
    # Validar carpetas individuales de features
    for item in os.listdir(specs_dir):
        item_path = os.path.join(specs_dir, item)
        if os.path.isdir(item_path):
            print(f"Validando especificación: {item}")
            
            # Comprobar si los archivos clave de la plantilla SDD existen
            spec_file = os.path.join(item_path, "spec.md")
            plan_file = os.path.join(item_path, "plan.md")
            tasks_file = os.path.join(item_path, "tasks.md")
            checklist_file = os.path.join(item_path, "checklist.md")
            
            required_files = {
                "spec.md": spec_file,
                "plan.md": plan_file,
                "tasks.md": tasks_file,
                "checklist.md": checklist_file
            }
            
            for file_name, file_path in required_files.items():
                if not os.path.exists(file_path):
                    print(f"  [X] Error: Falta archivo {file_name} en {item}")
                    has_errors = True
                else:
                    size = os.path.getsize(file_path)
                    if size < 50:
                        print(f"  [X] Error: El archivo {file_name} en {item} parece estar vacío o incompleto (tamaño < 50 bytes)")
                        has_errors = True

    if has_errors:
        print("\nValidación de Especificaciones FALLIDA. Corrige los errores arriba para integrar el código.")
        sys.exit(1)
    else:
        print("\nValidación de Especificaciones EXITOSA.")

if __name__ == "__main__":
    validate_specs()
