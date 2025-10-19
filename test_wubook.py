#!/usr/bin/env python3
import xmlrpc.client

# SUAS CREDENCIAIS
TOKEN = "wr_77d11ad5-4cc9-4769-a23d-707902b212e3"
LCODE = 1755443938

# Conectar ao servidor
server = xmlrpc.client.ServerProxy('https://wired.wubook.net/xrws/')

print("Testando API WuBook XML-RPC...")
print("-" * 40)

try:
    # Buscar quartos
    result = server.fetch_rooms(TOKEN, LCODE)
    status = result[0]
    
    if status == 0:
        rooms = result[1]
        print(f"✅ Funcionou! {len(rooms)} quartos encontrados")
        for room in rooms[:3]:  # Mostrar só os 3 primeiros
            print(f"  - {room}")
    else:
        print(f"❌ Erro: {result[1]}")
        
except Exception as e:
    print(f"❌ Erro: {e}")
