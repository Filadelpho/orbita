# ORBITA · A vida inteira em dia

**Site:** em breve

Plataforma de organização pessoal que junta, num só lugar, tudo o que costuma ficar espalhado em vários apps: tarefas, agenda, hábitos, metas, trabalho, estudos, finanças, saúde, conteúdo e viagens. O projeto tem três partes:

1. **Módulos**: dez áreas da vida, cada uma com suas listas, quadros, gráficos e formulários. A pessoa liga só os módulos que quer usar.
2. **Início**: um painel que cruza os módulos e mostra o que importa hoje, com captura rápida de tarefas e notas.
3. **ORBITA AI**: um assistente que entende frases em português, cria registros e gera relatórios a partir dos dados de todos os módulos.

Tudo roda no navegador, sem servidor de dados e sem nenhuma biblioteca externa.

## Inspiração e diferenciais

A tela de entrada e o Início seguem o layout do [NEXO](https://nexohaven.com.br/): tela dividida com fundo animado de pixels, saudação sobre uma capa, captura rápida e barra de navegação flutuante. O ORBITA parte desse formato e foca em reunir mais áreas da vida e em ligar os dados entre elas:

| | Este projeto |
|---|---|
| **Tudo conectado** | O calendário junta compromissos, tarefas, contas a pagar, posts, viagens e provas. As notificações juntam tarefas atrasadas, contas que vão vencer e hábitos pendentes. |
| **IA que cruza os módulos** | "gastei 45 no ifood" vira um gasto em Finanças; "relatório da semana" junta tarefas, hábitos, humor e gastos. A IA roda no próprio aparelho, sem enviar dados para fora. |
| **Captura rápida** | "comprar presente amanhã !alta #família" vira uma tarefa para amanhã, com prioridade alta e a tag família. Enter salva. |
| **Sem dependências** | JavaScript puro em módulos ES, sem framework, sem build e sem `npm install`. O servidor de desenvolvimento tem cerca de 40 linhas de Node. |
| **Funciona offline** | PWA com service worker: dá para instalar como app e usar sem internet. |
| **Seus dados com você** | Tudo fica no navegador. Dá para exportar e importar um backup em JSON e exportar as finanças em CSV. |
| **Visual minimalista** | Preto com azul, fonte DM Sans, tema claro, escuro ou automático, e capa do Início com pixels animados, fotos do Unsplash ou foto própria. |

## Módulos

| Módulo | O que tem |
|---|---|
| **Início** | Capa personalizável, captura rápida e cartões: como foi hoje (humor e energia), hábitos, tarefas, agenda, tempo de foco (sessões de 25 min), finanças do mês, metas, IA, conteúdos e estudos. |
| **Tarefas e calendário** | Tarefas com prioridade, área, projeto e tags. Calendário mensal que reúne os outros módulos. |
| **Hábitos e metas** | Hábitos com sequência de dias, metas com progresso e projetos pessoais em quadro com arrastar e soltar. |
| **Trabalho e carreira** | Projetos e entregas em quadro, carreira, portfólio e certificações. |
| **Educação** | Faculdade, programação, idiomas, cursos, certificações e leitura. |
| **Finanças** | Receitas e despesas, orçamento por categoria, contas, investimentos, assinaturas e gráficos de 6 meses. |
| **Saúde** | Humor, sono, treinos, alimentação e diário. |
| **Conteúdo** | Ideias, planejamento editorial em quadro, roteiros e métricas. |
| **Viagens e lazer** | Destinos, roteiros e orçamento. |
| **ORBITA AI** | Conversa em português, relatórios (dia, semana, finanças, saúde, estudos), sugestões e organização automática de tarefas atrasadas. |

**Recursos gerais:** busca global e comandos (`Ctrl+K`), atalhos de teclado (`N` adiciona, `T` cria tarefa), notificações, temas e integração com o GitHub (lista seus repositórios públicos).

## Como rodar

Precisa do Node 18 ou mais recente.

```bash
npm start
```

Depois abra http://localhost:5173. O app já vem com dados de exemplo para explorar; dá para apagar tudo em Configurações.

## Estrutura

```
server.js            servidor estático sem dependências
public/
  index.html
  sw.js              cache offline (PWA)
  css/styles.css     design system: cores, componentes e telas
  js/app.js          login, navegação, rotas, busca global, atalhos, backup
  js/views.js        telas de cada módulo e o Início
  js/collections.js  campos de cada módulo, descritos como dados
  js/store.js        estado, persistência e dados de exemplo
  js/ai.js           ORBITA AI: linguagem natural, relatórios e insights
  js/cover.js        capa do Início: animada, Unsplash ou foto própria
  js/pixels.js       fundo animado de pixels
  js/charts.js       gráficos em SVG
  js/ui.js           modais, formulários, avisos e ações
```

## Limitações atuais

- **Dados só no navegador.** Login, verificação em duas etapas e sincronização entre aparelhos ainda precisam de um servidor.
- **Login de demonstração.** Os botões do Google e da Apple na tela de entrada não autenticam de verdade.
- **Integrações.** Só a do GitHub funciona. Google Agenda, Drive, Apple Saúde, Health Connect e Open Finance aparecem na tela, mas por enquanto só guardam a preferência.
- **IA por regras.** A ORBITA AI reconhece padrões de frases em português; não é um modelo de linguagem.

## Créditos

Fotos de capa do [Unsplash](https://unsplash.com/), com o crédito de cada fotógrafo exibido no app.
