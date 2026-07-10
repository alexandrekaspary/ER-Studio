# ER Studio

Editor visual para criar e organizar modelos entidade-relacionamento (ER) de banco de dados. O projeto foi construído com Vite e React e funciona inteiramente no navegador: não há backend obrigatório nem envio automático dos modelos para um servidor.

> **Atenção:** este projeto foi criado com auxílio de IA para testes e prototipagem. Antes de utilizá-lo em um ambiente real, revise o código, as configurações e principalmente o SQL gerado de acordo com as necessidades e regras do seu projeto.

## Principais recursos

- Criação, edição, recolhimento, arraste e exclusão de tabelas.
- Cor e nome por tabela.
- Campos com nome, tipo PostgreSQL, tamanho, valor padrão, nulidade, chave primária, `UNIQUE`, restrição `CHECK` e chave estrangeira.
- Índices por tabela e restrições `UNIQUE` compostas, com ordem de colunas configurável.
- Relações `N:1` geradas a partir das chaves estrangeiras, com ações `ON DELETE` e `ON UPDATE`, e desenhadas no diagrama.
- Comentários e observações para o modelo, tabelas e campos.
- Rotas de relação horizontais e verticais, para manter a leitura mesmo com tabelas na mesma coluna.
- Zoom de 50% a 150%, por botões ou com Ctrl/Cmd + roda do mouse.
- Desfazer e refazer até 100 alterações durante a sessão.
- Barras de tabelas e propriedades recolhíveis em uma rail compacta.
- Rascunho salvo automaticamente no `localStorage` do navegador.
- Importação validada e exportação completa em JSON.
- Pré-visualização, cópia e download de um script SQL para PostgreSQL.

## Requisitos

- Node.js 22 LTS recomendado (Vite 7 requer Node 20.19+ ou 22.12+).
- npm 10+.
- Docker, apenas para executar a imagem de produção.

## Executar localmente

```bash
npm install
npm run dev
```

O Vite exibirá a URL local no terminal, normalmente `http://localhost:5173`.

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento Vite. |
| `npm run build` | Gera os arquivos otimizados em `dist/`. |
| `npm run preview` | Serve localmente o build de produção. |
| `npm test` | Executa os testes do modelo e da serialização JSON. |

## Como usar

1. Clique em **Nova tabela** e informe nome e cor.
2. Selecione a tabela criada para adicionar ou editar campos.
3. Em cada campo, defina tipo, tamanho quando o tipo aceitar esse modificador, valor padrão, nulidade, chave primária, **Valor único** e uma expressão de **Restrição (CHECK)** quando necessário. O editor oculta **Tamanho** em tipos que não o aceitam.
4. Marque **Chave estrangeira**, escolha a tabela e o campo referenciados e defina as ações `ON DELETE` e `ON UPDATE`. A relação aparece automaticamente no diagrama.
5. Use **Comentário** para documentar a tabela ou o campo no PostgreSQL. Use **Observações** para decisões e lembretes mantidos no modelo.
6. Na propriedade da tabela, crie índices comuns ou uma restrição **UNIQUE composta**. A ordem dos campos é preservada no SQL.
7. Arraste as tabelas pelo cabeçalho para posicioná-las. Use o botão no cabeçalho para recolher seus campos.
8. Use os controles de zoom no topo do diagrama para ampliar, reduzir ou restaurar 100%.
9. Use os ícones de painel nas próprias barras laterais para recolhê-las ou reabri-las.

Atalhos disponíveis: `Ctrl + S` (Windows/Linux) ou `Cmd + S` (macOS) exporta o modelo em JSON; `Ctrl/Cmd + Z` desfaz; `Ctrl/Cmd + Shift + Z` ou `Ctrl + Y` refaz. O desfazer/refazer não interfere na edição de texto em inputs e áreas de texto, e cada movimento de tabela ocupa apenas um ponto no histórico.

## Persistência local

O rascunho é atualizado no armazenamento local do navegador, usando a chave `er-studio:model:v1`. Isso facilita retomar o trabalho no mesmo navegador, mas não substitui a exportação do JSON para backup ou compartilhamento.

Na primeira abertura, o editor mostra um aviso simples reforçando essa orientação. A confirmação fica marcada apenas neste navegador, para não interromper os próximos usos.

## Importação e exportação JSON

A exportação inclui o nome do modelo, observações, tabelas, posições, cores, campos, comentários, chaves estrangeiras e uma lista derivada de relações. A importação valida o arquivo antes de substituir o diagrama aberto.

Exemplo reduzido:

```json
{
  "version": 1,
  "name": "Modelo comercial",
  "notes": "Modelo usado pela equipe comercial.",
  "tables": [
    {
      "id": "customers",
      "name": "clientes",
      "color": "#1f5f7a",
      "collapsed": false,
      "comment": "Clientes cadastrados no sistema.",
      "notes": "Origem de dados: CRM.",
      "indexes": [],
      "position": { "x": 80, "y": 120 },
      "fields": [
        {
          "id": "customers_id",
          "name": "id",
          "type": "UUID",
          "size": "",
          "defaultValue": "gen_random_uuid()",
          "nullable": false,
          "primaryKey": true,
          "unique": false,
          "checkConstraint": "",
          "comment": "Identificador público do cliente.",
          "notes": "Gerado por pgcrypto.",
          "isForeignKey": false,
          "foreignKey": null
        }
      ]
    },
    {
      "id": "orders",
      "name": "pedidos",
      "color": "#9a5b13",
      "collapsed": false,
      "comment": "Pedidos efetuados pelos clientes.",
      "notes": "",
      "indexes": [
        {
          "id": "idx_orders_customer_id",
          "name": "idx_pedidos_cliente_id",
          "fieldIds": ["orders_customer_id"],
          "unique": false
        }
      ],
      "position": { "x": 480, "y": 200 },
      "fields": [
        {
          "id": "orders_customer_id",
          "name": "cliente_id",
          "type": "UUID",
          "size": "",
          "defaultValue": "",
          "nullable": false,
          "primaryKey": false,
          "unique": true,
          "checkConstraint": "cliente_id IS NOT NULL",
          "comment": "Cliente responsável pelo pedido.",
          "notes": "",
          "isForeignKey": true,
          "foreignKey": {
            "tableId": "customers",
            "fieldId": "customers_id",
            "onDelete": "CASCADE",
            "onUpdate": "NO ACTION"
          }
        }
      ]
    }
  ],
  "relationships": [
    {
      "id": "rel_orders_orders_customer_id",
      "fromTableId": "orders",
      "fromFieldId": "orders_customer_id",
      "toTableId": "customers",
      "toFieldId": "customers_id",
      "cardinality": "N:1",
      "onDelete": "CASCADE",
      "onUpdate": "NO ACTION"
    }
  ]
}
```

### Regras de validação

- A versão suportada é `1`.
- Toda tabela e todo campo precisam de nome. Nomes de tabelas duplicados e nomes de campos duplicados na mesma tabela são recusados sem diferenciar maiúsculas/minúsculas; IDs duplicados também são recusados.
- `unique`, quando informado, precisa ser booleano.
- `checkConstraint`, quando informado, precisa ser um texto com a expressão `CHECK` sem a palavra `CHECK`; campos ausentes em JSONs antigos são normalizados como texto vazio.
- `notes` e `comment`, quando informados, precisam ser textos. Campos ausentes em JSONs antigos são normalizados como texto vazio.
- `indexes` é opcional em cada tabela. Cada item precisa ter nome de até 63 caracteres, IDs de campos da própria tabela e `unique` booleano. Índices comuns aceitam um ou mais campos; uma restrição `UNIQUE` composta exige pelo menos dois.
- Uma FK completa precisa informar `tableId` e `fieldId`, ambos existentes no modelo. As ações `onDelete` e `onUpdate` aceitam `NO ACTION`, `RESTRICT`, `CASCADE`, `SET NULL` e `SET DEFAULT`; quando ausentes, o padrão é `NO ACTION`.
- A lista `relationships` é opcional e aceita modelos legados; quando presente, precisa ser coerente com as FKs dos campos.
- Relações são exportadas como `N:1`. A cardinalidade é derivada da FK e não é configurável nesta versão.
- Um campo marcado como FK, mas sem destino definido, não é uma relação válida; ao importar ele é normalizado como campo comum.

Os testes automatizados cobrem round-trip de exportação/importação, relações legadas, comentários/observações, índices, entradas inválidas, histórico e geração de SQL.

## SQL PostgreSQL

Use **Gerar SQL** no topo da aplicação para conferir o script, copiá-lo ou baixá-lo como `.sql`. O gerador cria todas as tabelas antes de adicionar as chaves estrangeiras, portanto funciona mesmo que a ordem visual das tabelas seja diferente da ordem das referências ou existam referências cíclicas.

O script inclui tipos, tamanhos, `DEFAULT`, `NOT NULL`, `PRIMARY KEY`, `UNIQUE` simples e composto, índices, restrições `CHECK`, chaves estrangeiras, ações `ON DELETE`/`ON UPDATE` e `COMMENT ON TABLE`/`COMMENT ON COLUMN`. As observações são documentação do editor: permanecem no JSON e não alteram o banco.

Na propriedade **Restrição (CHECK)**, informe somente a expressão, por exemplo `quantidade > 0` ou `status IN ('ativo', 'inativo')`. Em PostgreSQL, uma restrição `CHECK` aceita valores `NULL`; marque o campo como não nulo quando a regra também exigir um valor.

## Docker

O `Dockerfile` gera o build com Node 22 e o serve via Nginx.

```bash
docker build -t er-studio .
docker run --rm -p 8080:80 --name er-studio er-studio
```

Abra `http://localhost:8080` no navegador.

## Estrutura do projeto

```text
src/
  App.jsx       # Interface e interações do editor
  history.js    # Histórico de desfazer/refazer
  model.js      # Modelo, validação, importação e exportação JSON
  sql.js        # Geração do script PostgreSQL
  styles.css    # Estilos da aplicação
  main.jsx      # Ponto de entrada React
test/
  history.test.js # Testes do histórico de alterações
  model.test.js # Testes de serialização e validação
  sql.test.js   # Testes da geração de SQL
Dockerfile      # Imagem de produção
nginx.conf      # Configuração do servidor web
```

## Limitações atuais

- O editor não possui autenticação, colaboração em tempo real ou armazenamento remoto.
- As relações são visualizadas como `N:1`; não há editor independente de cardinalidade nesta versão.
