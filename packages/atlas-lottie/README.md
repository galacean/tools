# tool-atlas-lottie

Transform lottie JSON file to atlas format in galacean engine. This tool will generate a folder which contains three files: a processed lottie JSON file, an atlas file and an image.

# Usage in terminal

1. Install

```bash
npm i @galacean/tools-atlas-lottie -g
```

2. Use command in terminal

if lottie file has base64 images:

```bash
galacean-atlas-lottie -s lottieFile.json
```

if lottie file has images in a directory:

```bash
galacean-atlas-lottie -s lottieFile.json -i ./images
```

# Usage in node project

1. Install

```bash
npm i @galacean/tools-atlas-lottie --save
```

2. Call api

```javascript
const lottieTransform = require("@galacean/tools-atlas-lottie");

lottieTransform("lottieFile.json");
```
