# ER Studio

Editor visual para criar e organizar modelos entidade-relacionamento (ER) de banco de dados. O projeto foi construído com Vite e React e funciona inteiramente no navegador: não há backend obrigatório nem envio automático dos modelos para um servidor.

## Principais recursos

- Criação, edição, recolhimento, arraste e exclusão de tabelas.
- Cor e nome por tabela.
- Campos com nome, tipo PostgreSQL, tamanho, valor padrão, nulidade, chave primária, `UNIQUE` e chave estrangeira.
- Relações `N:1` geradas a partir das chaves estrangeiras, com ações `ON DELETE` e `ON UPDATE`, e desenhadas no diagrama.
- Rotas de relação horizontais e verticais, para manter a leitura mesmo com tabelas na mesma coluna.
- Zoom de 50% a 150%, por botões ou com Ctrl/Cmd + roda do mouse.
- Barras de tabelas e propriedades recolhíveis em uma rail compacta.
- Rascunho salvo automaticamente no `localStorage` do navegador.
- Importação validada e exportação completa em JSON.

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
3. Em cada campo, defina tipo, tamanho, valor padrão, nulidade, chave primária e **Valor único** quando necessário.
4. Marque **Chave estrangeira**, escolha a tabela e o campo referenciados e defina as ações `ON DELETE` e `ON UPDATE`. A relação aparece automaticamente no diagrama.
5. Arraste as tabelas pelo cabeçalho para posicioná-las. Use o botão no cabeçalho para recolher seus campos.
6. Use os controles de zoom no topo do diagrama para ampliar, reduzir ou restaurar 100%.
7. Use os ícones de painel nas próprias barras laterais para recolhê-las ou reabri-las.

Atalho disponível: `Ctrl + S` (Windows/Linux) ou `Cmd + S` (macOS) exporta o modelo em JSON.

## Persistência local

O rascunho é atualizado no armazenamento local do navegador, usando a chave `er-studio:model:v1`. Isso facilita retomar o trabalho no mesmo navegador, mas não substitui a exportação do JSON para backup ou compartilhamento.

Na primeira abertura, o editor mostra um aviso simples reforçando essa orientação. A confirmação fica marcada apenas neste navegador, para não interromper os próximos usos.

## Importação e exportação JSON

A exportação inclui o nome do modelo, tabelas, posições, cores, campos, chaves estrangeiras e uma lista derivada de relações. A importação valida o arquivo antes de substituir o diagrama aberto.

Exemplo reduzido:

```json
{
  "version": 1,
  "name": "Modelo comercial",
  "tables": [
    {
      "id": "customers",
      "name": "clientes",
      "color": "#1f5f7a",
      "collapsed": false,
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
- Toda tabela e todo campo precisam de nome; IDs duplicados são recusados.
- `unique`, quando informado, precisa ser booleano.
- Uma FK completa precisa informar `tableId` e `fieldId`, ambos existentes no modelo. As ações `onDelete` e `onUpdate` aceitam `NO ACTION`, `RESTRICT`, `CASCADE`, `SET NULL` e `SET DEFAULT`; quando ausentes, o padrão é `NO ACTION`.
- A lista `relationships` é opcional e aceita modelos legados; quando presente, precisa ser coerente com as FKs dos campos.
- Relações são exportadas como `N:1`. A cardinalidade é derivada da FK e não é configurável nesta versão.
- Um campo marcado como FK, mas sem destino definido, não é uma relação válida; ao importar ele é normalizado como campo comum.

Os testes automatizados cobrem round-trip de exportação/importação, relações legadas e entradas inválidas.

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
  model.js      # Modelo, validação, importação e exportação JSON
  styles.css    # Estilos da aplicação
  main.jsx      # Ponto de entrada React
test/
  model.test.js # Testes de serialização e validação
Dockerfile      # Imagem de produção
nginx.conf      # Configuração do servidor web
```

## Limitações atuais

- Não há geração automática de SQL.
- O editor não possui autenticação, colaboração em tempo real ou armazenamento remoto.
- As relações são visualizadas como `N:1`; não há editor independente de cardinalidade nesta versão.
