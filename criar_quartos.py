#!/usr/bin/env python3
import xmlrpc.client

TOKEN = "wr_77d11ad5-4cc9-4769-a23d-707902b212e3"
LCODE = 1755443938

server = xmlrpc.client.ServerProxy('https://wired.wubook.net/xrws/')

# Criar 3 quartos de teste
quartos = [
    {"nome": "Quarto 101", "camas": 2, "preco": 150.00},
    {"nome": "Quarto 102", "camas": 2, "preco": 150.00},
    {"nome": "Suite 201", "camas": 3, "preco": 250.00}
]

for q in quartos:
    try:
        result = server.new_room(
            TOKEN, LCODE, 
            0,  # woodoo_only
            q["nome"],  # nome
            q["camas"],  # camas
            q["preco"],  # preço padrão
            1,  # disponibilidade
            q["nome"][:3],  # nome curto
            "bb"  # board (bb=breakfast)
        )
        
        if result[0] == 0:
            print(f"✅ Criado: {q['nome']} (ID: {result[1]})")
        else:
            print(f"❌ Erro ao criar {q['nome']}: {result[1]}")
            
    except Exception as e:
        print(f"❌ Erro: {e}")

print("\nVerificando quartos criados...")
result = server.fetch_rooms(TOKEN, LCODE)
if result[0] == 0:
    print(f"Total de quartos: {len(result[1])}")
