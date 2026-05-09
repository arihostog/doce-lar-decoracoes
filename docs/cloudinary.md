# Cloudinary no Doce Lar

O projeto tem uma camada de upload em `src/lib/cloudinaryUpload.js` e usa `src/lib/media.js` como ponto unico para decidir onde salvar arquivos.

Quando o Cloudinary esta configurado, imagens e videos selecionados no painel sao enviados para o Cloudinary e o produto salva a URL publica retornada. Quando nao esta configurado, o projeto usa Base64 no `localStorage` como fallback local de desenvolvimento.

## Chaves necessarias no Cloudinary

Crie ou consulte estes dados no painel do Cloudinary:

- `Cloud name`: identificador da sua conta.
- `Upload preset`: preset do tipo `Unsigned`, criado em `Settings > Upload`.
- `Folder`: opcional, para organizar os arquivos. Exemplo: `doce-lar-produtos`.

Nao coloque `API Secret` no React/Vite. Essa chave e secreta e deve ficar apenas em backend.

## Variaveis de ambiente

Crie um arquivo `.env` na raiz do projeto, usando `.env.example` como base:

```env
VITE_CLOUDINARY_CLOUD_NAME=seu_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=seu_upload_preset_unsigned
VITE_CLOUDINARY_FOLDER=doce-lar-produtos
```

Depois de criar ou alterar o `.env`, reinicie o Vite:

```powershell
npm run dev
```

## Foto principal

No painel `/admin`, abra `Novo produto` ou `Editar`, va ate `Previa da foto principal` e clique em `Selecionar imagem`.

Com Cloudinary configurado, a imagem sera enviada e o campo `Foto principal` recebera automaticamente a URL publica.

## Galeria

No campo `Galeria de fotos`, voce pode colar uma URL por linha ou clicar em `Selecionar imagens` para enviar varias imagens do computador.

Com Cloudinary configurado, cada imagem selecionada sera enviada e as URLs retornarao automaticamente para a galeria.

## Video

No campo `Video do produto`, voce pode colar uma URL de video ou selecionar um arquivo de video do computador.

Com Cloudinary configurado, videos sao enviados como `resource_type: video`, e a URL publica retornada fica salva no produto.
