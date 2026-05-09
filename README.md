# Doce Lar Decorações e Variedades

Aplicativo React + Vite + Tailwind CSS para loja de produtos avulsos de casa, decoração, cozinha, presentes e variedades.

## Supabase como banco principal

O projeto esta preparado para usar Supabase como banco principal e manter `localStorage` apenas como fallback.

Variaveis no arquivo `.env`, na raiz do projeto:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key
```

Depois de criar ou alterar o `.env`, reinicie o Vite com `npm run dev`.

Arquivos principais:

```text
src/lib/supabaseClient.js
src/lib/supabaseStore.js
```

Tabelas esperadas:

- `categories`
- `products`
- `orders`
- `store_settings`

O app usa Supabase para buscar produtos ativos na vitrine, criar/editar/excluir produtos no painel, salvar pedidos antes do WhatsApp, atualizar status dos pedidos e ler/salvar configuracoes da loja.

No painel `/admin`, veja a area `Diagnostico Supabase` para conferir URL, anon key mascarada, modo atual e ultimo erro. Se aparecer `Usando Supabase`, o banco real esta ativo. Se aparecer `Fallback localStorage`, confira `.env`, RLS/permissoes e o erro exibido.

Para migrar dados locais, clique no botao `Migrar dados locais para Supabase` no painel. A migracao envia produtos, pedidos, categorias padrao e configuracoes da loja. Produtos com mesmo `id` ou `sku` sao ignorados para evitar duplicidade.

## Como rodar no Windows

Abra o PowerShell dentro da pasta do projeto:

```powershell
cd "E:\DOCUMENTOS\CODEX\Doce Lar Decorações e Variedades"
```

Instale as dependências, se ainda não tiver instalado:

```powershell
npm install
```

Inicie o servidor de desenvolvimento:

```powershell
npm run dev
```

Depois abra no navegador a URL exibida no terminal. Normalmente será:

```text
http://localhost:5173
```

## Onde trocar o WhatsApp da loja

Edite o arquivo:

```text
src/config/store.js
```

Troque o campo `whatsappNumber`, mantendo o formato com código do país + DDD + número:

```js
whatsappNumber: '5599999999999',
```

Exemplo: `55` + DDD + número.

## Onde alterar os produtos

Os produtos de exemplo ficam em:

```text
src/data/products.js
```

Agora também existe um painel administrativo em `/admin`. Os produtos cadastrados ou editados no painel são salvos no `localStorage` do navegador e aparecem automaticamente na vitrine da loja.

Cada produto usa esta estrutura:

```js
{
  id: 'codigo-do-produto',
  name: 'Nome',
  category: 'Decoração',
  price: 89.9,
  promotionalPrice: 74.9,
  shortDescription: 'Descrição curta',
  fullDescription: 'Descrição completa',
  stock: 8,
  mainPhoto: 'link-da-foto-principal',
  gallery: ['foto-1', 'foto-2'],
  video: { type: 'file', url: '/videos/produto.mp4' },
  status: 'active',
  featured: true,
  promotion: true,
  novelty: false,
}
```

Para vídeo externo, use `type: 'link'` e informe um link incorporável. Para arquivo de vídeo, coloque o arquivo dentro de `public/videos` e use, por exemplo, `/videos/produto.mp4`.

## Categorias

As categorias principais ficam no mesmo arquivo `src/data/products.js`, no array `categories`.

## Painel administrativo

Acesse:

```text
http://localhost:5173/admin
```

Login inicial:

```text
Usuário: admin
Senha: admin123
```

No painel você pode:

- Ver os totais do dashboard.
- Editar as configurações da loja.
- Cadastrar um novo produto pelo botão `Novo produto`.
- Editar produtos existentes.
- Excluir produtos.
- Ativar ou inativar produtos.
- Marcar produto como destaque, promoção ou novidade.
- Informar SKU, custo, preço de venda e observações internas.
- Ver lucro e margem calculados automaticamente.
- Filtrar por categoria e status.
- Duplicar produtos.
- Exportar a lista em CSV, compatível com Excel.
- Acompanhar pedidos salvos antes do envio ao WhatsApp.
- Alterar status dos pedidos e reenviar pelo WhatsApp.

## Configurações da loja

Dentro do painel, use a seção `Configurações da Loja` para editar:

- Nome da loja.
- Subtítulo da loja.
- Número do WhatsApp.
- Instagram.
- Endereço.
- Horário de funcionamento.
- Mensagem padrão do WhatsApp.
- Texto do banner principal.

O WhatsApp deve ser preenchido somente com números:

```text
5598988887777
```

Sem espaços, sem parênteses e sem traços. O número salvo nessa seção é usado automaticamente no botão `Enviar pedido no WhatsApp`.

## Como cadastrar produto

No painel, clique em `Novo produto`, preencha os campos e clique em `Salvar produto`.

Campos administrativos:

- `Código/SKU do produto`: código interno da loja.
- `Custo do produto`: valor pago pela loja.
- `Preço de venda`: valor vendido ao cliente.
- `Preço promocional`: quando preenchido, entra no lugar do preço de venda para cálculo e vitrine.
- `Observações internas`: aparece apenas no painel administrativo.

O painel calcula automaticamente o lucro e a margem percentual com base no custo e no preço de venda/promocional.

Campos de imagem e vídeo:

- `Foto principal`: use uma URL de imagem ou selecione uma imagem do computador.
- `Galeria de fotos`: informe uma URL por linha ou selecione várias imagens do computador.
- `Vídeo do produto`: use uma URL de vídeo ou selecione um vídeo do computador para teste local.

Quando você seleciona um arquivo do computador, esta primeira versão converte o arquivo para Base64 e salva no `localStorage`. Isso é útil apenas para teste local, porque imagens/vídeos em Base64 podem deixar o armazenamento do navegador pesado.

Se a URL da imagem estiver quebrada, a loja mostra uma imagem placeholder para não quebrar o layout. O formulário também mostra prévia da foto principal, galeria e vídeo antes de salvar.

## Onde os dados ficam salvos

Sem banco de dados por enquanto, os dados ficam salvos no `localStorage` do navegador, na chave:

```text
doce-lar-products
```

As configurações da loja ficam na chave:

```text
doce-lar-store-settings
```

Os pedidos ficam na chave:

```text
doce-lar-orders
```

Isso significa que os dados ficam naquele navegador/dispositivo. Se limpar os dados do navegador, o cadastro local pode ser apagado.

## Preparação para banco de dados real

Hoje os produtos usam `localStorage` para facilitar os testes. A camada de armazenamento está em:

```text
src/lib/productStore.js
```

No futuro, esse arquivo pode ser adaptado para Supabase, Firebase, API própria ou outro banco de dados real.

Para trocar Base64 por upload real no futuro, comece pelo arquivo:

```text
src/lib/media.js
```

A função `uploadMediaForStorage` foi deixada como ponto de troca para Cloudinary, Supabase Storage, Firebase Storage ou uma API própria.
