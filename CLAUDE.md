# Bitcoin Dashboard

Dashboard web para acompanhar o preço do Bitcoin em tempo real, com gráficos interativos de histórico de preços.

## Como rodar

Abra o arquivo `index.html` diretamente no navegador (duplo clique no arquivo). Não é necessário servidor, instalação ou conta em serviços externos.

## Estrutura de arquivos

```
├── index.html   — Estrutura HTML da página
├── style.css    — Estilos e tema escuro
├── app.js       — Lógica de dados e gráficos
└── CLAUDE.md    — Este arquivo
```

## Arquitetura do app.js

O código segue um fluxo simples:

1. `init()` é chamada ao carregar a página
2. Busca dados em paralelo via `Promise.allSettled`
3. Atualiza os cards com `updateStats()` e os gráficos com `render*Chart()`
4. Agenda refresh automático com `setInterval` a cada 60s

### Funções principais

| Função | O que faz |
|--------|-----------|
| `fetchCurrentStats()` | Busca preço atual, variação 24h, market cap |
| `fetchChartData(days)` | Busca histórico de N dias |
| `fetchRangeData(from, to)` | Busca histórico entre duas datas (timestamp Unix) |
| `renderMainChart(data, label)` | Desenha/atualiza o gráfico principal |
| `renderWeeklyChart(data)` | Desenha o gráfico semanal fixo |
| `renderYearlyChart(data)` | Desenha o gráfico anual fixo |
| `buildChartConfig(opts)` | Retorna configuração reutilizável do Chart.js |
| `updateStats(data)` | Atualiza os 6 cards de estatísticas |

## API utilizada

**CoinGecko** — gratuita, sem autenticação, sem cadastro.

- Limite: ~30 requisições/minuto (suficiente para uso pessoal)
- Dados históricos > 90 dias têm granularidade diária
- Documentação: https://www.coingecko.com/en/api/documentation

## Dependências externas (via CDN)

- **Chart.js 4.4.0** — gráficos interativos

## Limitações conhecidas

- Não funciona offline (requer internet para a API)
- A CoinGecko API pública pode ter instabilidade ocasional — erros são tratados com mensagem no status
- Dados de preço em BRL dependem da disponibilidade da API

## Como adicionar uma nova moeda

1. Substituir `bitcoin` nas URLs de `fetchCurrentStats` e `fetchChartData`
2. O ID da moeda pode ser encontrado em `https://api.coingecko.com/api/v3/coins/list`
