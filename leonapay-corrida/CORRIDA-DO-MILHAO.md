# Corrida do Milhão — spec da página

Página de campanha do **Leona Pay** (Leona Million Challenge). Página estática, uma única URL, sem login e sem área logada. A referência visual aprovada está em `leonapay-corrida/index.html` neste repositório, com os arquivos em `leonapay-corrida/assets/`.

Fonte oficial das regras: post do Instagram da Leona Pay de 17/10/2026 (`leona.pay`, shortcode `Dem9k6ws2-9`). Não inventar número de participantes, faturamento, percentual de meta ou posição no ranking.

## Onde publicar

Alex sugeriu um caminho no estilo `/leonapay-milhao`. O domínio final fica com o dev. A página é do Leona Pay, então o lugar natural é o site `leonapay.com.br`. Confirmar com o Alex antes de subir em `leonaflow.com`.

Enquanto a URL definitiva não existe, a prévia HTML está na pasta `leonapay-corrida/`. Ela não faz parte do app Next.js de parceiros (`src/` e `public/` não devem absorver essa pasta no build do painel).

## Links

Todo botão de conversão aponta para o mesmo lugar, em nova aba ou na mesma, sem UTM obrigatório:

`https://client.leonapay.com.br/registro`

| Elemento | Destino |
|---|---|
| Logo do topo | `https://leonapay.com.br` |
| Criar conta (topo) | cadastro |
| Quero participar (hero e botão fixo) | cadastro |
| Ver regras | âncora `#regras` |
| Como funciona (menu) | âncora `#como-funciona` |
| Link “Leona Pay” no passo 1 | cadastro |
| Criar minha conta (bloco final) | cadastro |
| leonapay.com.br (rodapé) | `https://leonapay.com.br` |
| Documentação | `https://docs.leonapay.com.br/docs` |
| Entrar | `https://client.leonapay.com.br/login` |

## SEO

- `lang`: `pt-BR`
- `<title>`: `Corrida do Milhão | Leona Pay`
- description: `Leona Million Challenge: durante 3 meses, clientes Leona Pay disputam o topo do ranking de faturamento. O 1º lugar leva um iPhone 18 Pro Max.`
- og:title: `Corrida do Milhão | Leona Pay`
- og:description: `Passe de R$ 1 milhão, lidere o ranking e leve um iPhone 18 Pro Max. Ranking aberto até 19/01/2027.`
- og:image: `https://leonapay.com.br/images/link-preview.jpg` (trocar por um print da própria página quando houver)
- theme-color: `#0b0233`
- favicon: o mesmo de `leonapay.com.br`

## Visual

- Fonte: Plus Jakarta Sans, pesos 400, 500, 600, 700 e 800.
- Fundo: `#0b0233`. Texto: `#f5f2ff`. Texto secundário: `#b8b0e2`.
- Destaque (gradiente de texto): `#2ee6d6` → `#22d3ee`.
- Botão principal: pílula, gradiente `#8b2cf5` → `#6d5cf3` (45%) → `#22d3d3`, texto branco, peso 700, seta à direita.
- Botão secundário: borda clara, fundo quase transparente (“Ver regras”).
- Cards: fundo branco a ~4,5% de opacidade, borda branca a 12%, cantos ~22–28px.
- Largura do conteúdo: 1200px. Margem lateral de 20px no celular.
- Menu “Como funciona” e “Regras” só aparece a partir de 720px. No celular fica logo + “Criar conta”.
- Desktop (a partir de 980px): hero em duas colunas, texto à esquerda e iPhones à direita. Regras em duas colunas. FAQ com o título à esquerda, fixo, e as perguntas à direita.
- Celular: uma coluna. Botões do hero em largura cheia. Os 4 fatos em grade 2×2. Os 3 passos empilhados.
- `img` sempre com `height: auto`. Sem isso os iPhones esticam na vertical.
- Entrada suave dos blocos ao rolar (sobe ~24px e aparece). Desligar a animação se o sistema pedir menos movimento.
- Botão fixo “Quero participar” só no celular: aparece depois que os botões do hero saem da tela e some quando o bloco final entra na tela.

## Assets

| Arquivo | Uso |
|---|---|
| `assets/logo-white.png` | Logo oficial. Origem: `https://leonapay.com.br/brand/logo-white.png`. Altura 34px no topo e 30px no rodapé. |
| `assets/phones.webp` | Dois iPhones roxos, frente e verso, fundo transparente. A tela da frente mostra a campanha (troféu, “Corrida do Milhão”, “META DA CORRIDA”, “R$ 1M”, gráfico “Rumo ao milhão” e card “1º / SUA POSIÇÃO / Líder do ranking”). Sem logo da Apple na traseira. |
| `assets/favicon.ico` | Favicon do Leona Pay. |

Halo roxo e turquesa atrás dos aparelhos, dois brilhos pequenos e um selo sobre o aparelho de trás:

- selo: “PRÊMIO 1º LUGAR” / “iPhone 18 Pro Max”
- alt da imagem: `iPhone 18 Pro Max roxo, frente e verso, com a tela da Corrida do Milhão`

No rodapé, a linha legal: `Leona Pay — a API sem fronteiras. Imagens meramente ilustrativas. iPhone é marca registrada da Apple Inc.`

## Conteúdo, de cima para baixo

### 1. Topo fixo

Logo Leona Pay. Links “Como funciona” e “Regras”. Botão “Criar conta”.

### 2. Hero

Pílula com ícone de troféu: `LEONA MILLION CHALLENGE`

Título:

```
CORRIDA DO
MILHÃO.
```

“MILHÃO.” no gradiente turquesa.

Texto: `Durante 3 meses, os clientes Leona Pay disputam o topo do ranking de faturamento. Quem faturar mais leva um iPhone 18 Pro Max.`

Botões: `Quero participar` e `Ver regras`.

Contagem regressiva, atualizada a cada segundo, fuso `America/Sao_Paulo`:

- Início: `2026-10-19T00:00:00-03:00`
- Fim usado na prévia: `2027-01-19T23:59:59-03:00` (ver pendência abaixo)
- Antes do início: título “A corrida começa em” e a conta vai até o início.
- Durante: título “A corrida termina em”.
- Depois do fim: título “Competição encerrada” e zeros.
- Quatro blocos: dias (sem zero à esquerda), horas, min e seg (sempre 2 dígitos).
- Linha de apoio: `Encerramento: 19/01/2027`.

À direita (embaixo, no celular): os dois iPhones e o selo do prêmio.

### 3. Quatro fatos

1. **3 meses** — de disputa, de 19/10/2026 a 19/01/2027
2. **R$ 1 milhão** — de faturamento mínimo para concorrer (valor no gradiente)
3. **1º lugar** — leva um iPhone 18 Pro Max
4. **Bruto aprovado** — descontados estornos e cancelamentos

### 4. Como funciona

Eyebrow: `COMO FUNCIONA`. Título: `Três passos até o topo do ranking`.

1. **Crie sua conta.** Faça seu cadastro no Leona Pay e configure sua operação.
2. **Venda com o Leona Pay.** Receba de clientes em diferentes países, em uma só plataforma. Cada venda aprovada no período soma no seu faturamento.
3. **Lidere o ranking.** Passe de R$ 1 milhão até 19/01/2027 e termine com o maior faturamento para levar o iPhone 18 Pro Max.

### 5. Frase

```
A pergunta não é quem vai chegar ao milhão primeiro.
É quem vai faturar mais que todos os outros.
```

A primeira linha fica no tom secundário. “mais que todos os outros.” fica no gradiente turquesa. Linhas decorativas roxas e turquesas nas laterais.

### 6. Regras

Eyebrow: `REGULAMENTO`. Título: `Regras da competição`.

As quatro regras, nesta ordem, com o trecho em negrito:

1. O vencedor será o participante com o **maior faturamento acumulado** durante a competição.
2. Para concorrer ao prêmio, é necessário atingir um **faturamento mínimo de R$ 1.000.000,00** no período. O valor não quebra de linha.
3. Será considerado o **faturamento bruto aprovado**, descontados estornos e cancelamentos.
4. Apenas transações realizadas **dentro do período oficial** serão contabilizadas.

Card ao lado:

- Título: `PERÍODO DA COMPETIÇÃO`
- Início: `19/10/2026`
- Encerramento: `19/01/2027`
- Barra de progresso do tempo, não de faturamento. Percentual = tempo decorrido entre início e fim, limitado de 0 a 100. Bolinha na ponta da barra.
- Legenda durante a corrida: `N% da corrida concluída · faltam X de Y dias`. Y é a duração total em dias (93, de 19/10/2026 00:00 a 19/01/2027 23:59:59, horário de Brasília). X é o teto dos dias que faltam.
- Antes do início: `Começa em 19/10/2026.`
- Depois do fim: `Competição encerrada.`
- Premiação: `1º lugar: iPhone 18 Pro Max`

### 7. Perguntas frequentes

Eyebrow: `DÚVIDAS`. Título: `Perguntas frequentes`. Apoio: `Tudo o que você precisa saber para entrar na corrida.`

Acordeão. Fecha começa fechado. O “+” gira 45° quando abre.

1. **Quem pode participar?** Clientes Leona Pay. Crie sua conta e venda pelo Leona Pay durante o período da competição.
2. **Ainda dá tempo de entrar?** Sim. A corrida vai até 19/01/2027, e contam todas as transações aprovadas feitas dentro do período oficial.
3. **O que conta como faturamento?** O faturamento bruto aprovado no período, descontados estornos e cancelamentos.
4. **Existe um valor mínimo para ganhar?** Sim. Para concorrer ao prêmio, é preciso faturar pelo menos R$ 1.000.000,00 no período da competição.
5. **Como o vencedor é definido?** Vence o participante com o maior faturamento acumulado entre 19/10/2026 e 19/01/2027, desde que tenha atingido o mínimo de R$ 1 milhão.

### 8. Chamada final

Card com brilho roxo de um lado e turquesa do outro.

```
Sua corrida começa
no cadastro.
```

“cadastro.” no gradiente. Texto: `Crie sua conta no Leona Pay, venda para o mundo e dispute o iPhone 18 Pro Max.`

Botão: `Criar minha conta`. Apoio: `Ranking aberto até 19/01/2027.`

### 9. Rodapé

Logo, os três links da tabela e a linha legal.

## O que o post oficial não define

Não publicar estas respostas sem o Alex confirmar:

- **Hora do encerramento.** O post só diz a data 19/01/2027. A prévia usa 23:59:59 no horário de Brasília. A contagem, a barra e o “faltam X dias” dependem dessa hora.
- **Quem entra.** O post diz que os clientes Leona Pay disputam. A página trata o cadastro + venda no período como participação automática. Não há inscrição separada.
- **Empate** e **ninguém chegar a R$ 1 milhão.** O post não diz o que acontece. Ficou de fora de propósito.
- **O que é “cliente”.** Conta criada no meio do período entra com o faturamento aprovado só de 19/10/2026 em diante. É o que a regra 4 descreve. Confirmar se conta criada depois do início pode concorrer.
