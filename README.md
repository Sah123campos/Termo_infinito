# Termo Infinito

Jogo de adivinhar palavras de 5 letras em português que **nunca acaba**: acertou, aparecem novas palavras na hora.

## Modos (todos infinitos)

| Modo     | Palavras | Tentativas |
|----------|---------:|-----------:|
| Termo    | 1        | 6          |
| Dueto    | 2        | 7          |
| Quarteto | 4        | 9          |
| Oiteto   | 8        | 13         |
| Dezeto   | 10       | 15         |

## Contra o tempo (opcional)

Toque no relógio no canto superior direito, ligue **Jogar contra o tempo** e escolha quantos minutos quer (1, 3, 5, 10 ou qualquer valor).
Cada palavra acertada vale 1 ponto. No fim aparece quantas palavras você acertou, e o seu recorde fica salvo por modo e por tempo.
Se não quiser, é só deixar desligado e jogar no modo livre.

## Como jogar

- Verde: letra certa no lugar certo.
- Amarelo: a letra existe, mas em outro lugar.
- Cinza: a letra não está na palavra.
- Acentos e cedilha são preenchidos sozinhos.
- Clique numa casa da linha atual (ou use ← →) para mudar a posição do cursor.

## Rodar

É só abrir o `index.html` no navegador. Não precisa instalar nada.

Para publicar online de graça: no GitHub, vá em **Settings → Pages**, escolha a branch `main` e a pasta `/ (root)`.

## Palavras

`js/palavras.js` foi gerado a partir do dicionário pt-BR do Hunspell (VERO) cruzado com uma lista de frequência de uso:
cerca de 1.000 palavras comuns são sorteadas como resposta e cerca de 13.000 são aceitas como tentativa.
