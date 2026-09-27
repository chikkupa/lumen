# Lumen

Folder image viewer with slideshow. Point it at a directory on your machine, flip through images, and play them as a slideshow.

## Features

- Load images from an absolute folder path (server reads the directory)
- Or browse a local folder in the browser
- Full-size viewer with previous / next controls
- Slideshow with configurable interval (1–600 seconds; default 10s)
- Keyboard: ← → to navigate, Space to play/pause
- Thumbnail strip for jumping to any image
- Built-in image generator from a text prompt (plus procedural styles); save into your folder or download PNG
- Model picker: free **Sana** by default; advanced Pollinations models (FLUX, Z-Image Turbo, GPT Image, …) with `POLLINATIONS_API_KEY`

Supported formats: JPG, JPEG, PNG, GIF, WebP, BMP, AVIF, SVG.

## Run locally

```bash
npm install
npm run dev
```

Dev server (this workspace uses port **4321**):

```bash
npx next dev --port 4321
```

Open [http://127.0.0.1:4321](http://127.0.0.1:4321).

## Try the samples

A few sample images ship in `sample-images/`. In the app, click **Sample images**, or load:

```text
/absolute/path/to/this/repo/sample-images
```

## Image generation models

| Model | Provider | Key |
|-------|----------|-----|
| Sana | Pollinations (free) | none |
| GPT Image 1 | OpenAI | `OPENAI_API_KEY` |
| DALL·E 3 | OpenAI | `OPENAI_API_KEY` |
| Z-Image Turbo, FLUX, Seedream, … | Pollinations | `POLLINATIONS_API_KEY` |

```bash
cp .env.example .env.local
# add OPENAI_API_KEY and/or POLLINATIONS_API_KEY, then:
npm run dev
```

- OpenAI keys: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- Pollinations keys: [enter.pollinations.ai/keys](https://enter.pollinations.ai/keys)

## Notes

Folder-path loading uses the Next.js API on the machine running the server. It only lists and serves common image files from the path you provide. Prefer paths you trust on your own computer.
