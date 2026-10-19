import sys
import subprocess
import time

adb_path = r"C:\Users\Ryanr\AppData\Local\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.1\adb.exe"

dots = {
    '1': (263, 1096), '2': (540, 1096), '3': (817, 1096),
    '4': (263, 1373), '5': (540, 1373), '6': (817, 1373),
    '7': (263, 1650), '8': (540, 1650), '9': (817, 1650)
}

def draw_pattern(sequence):
    seq = [c for c in sequence if c in dots]
    if len(seq) < 4:
        print("Erro: O padrão precisa ter pelo menos 4 pontos conectados.")
        return False

    print(f"Desenhando sequencia de pontos: {' -> '.join(seq)}")
    
    first_pt = dots[seq[0]]
    # Build adb command with all motion events
    cmd_parts = [f"input motionevent DOWN {first_pt[0]} {first_pt[1]}"]
    
    for pt_name in seq[1:]:
        pt = dots[pt_name]
        cmd_parts.append(f"input motionevent MOVE {pt[0]} {pt[1]}")
    
    last_pt = dots[seq[-1]]
    cmd_parts.append(f"input motionevent UP {last_pt[0]} {last_pt[1]}")
    
    # Execute on phone
    full_cmd = " && ".join(cmd_parts)
    res = subprocess.run([adb_path, "shell", full_cmd], capture_output=True, text=True)
    print("Resultado ADB:", res.stdout, res.stderr)
    return True

if __name__ == "__main__":
    if len(sys.argv) > 1:
        seq_input = "".join(sys.argv[1:])
    else:
        seq_input = input("Digite a sequencia do padrao (ex: 14789 ou 1 2 3 6 9): ")
    draw_pattern(seq_input)
